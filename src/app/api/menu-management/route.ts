import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, getDbPool } from '@/lib/db';
import { SubmissionRepository } from '@/lib/repositories/submission.repository';
import { getAuthenticatedUser } from '@/shared/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const actor = await getAuthenticatedUser(request);

    let filterCompanyId: string | null = null;
    if (actor.role !== 'SUPER_ADMIN') {
      filterCompanyId = actor.companyId || null;
    } else if (companyId && companyId !== 'ALL') {
      filterCompanyId = companyId;
    }

    if (getDbPool()) {
      // 1. Fetch system menus
      const menusRes = await dbQuery(`
        SELECT id, title, category, icon, description, sort_order
        FROM system_menus
        ORDER BY sort_order ASC;
      `);

      // 2. Fetch role menu access (RWMA)
      const rwmaRes = await dbQuery(`
        SELECT role_name, menu_id, can_view, can_edit
        FROM role_menu_access;
      `);

      // 3. Fetch user menu access (UWMA) with user profiles scoped to company
      const uwmaSql = filterCompanyId
        ? `SELECT uma.user_id, u.email, u.full_name, r.name as role_name, uma.menu_id, uma.can_view, uma.can_edit
           FROM user_menu_access uma
           JOIN user_profiles u ON uma.user_id = u.id
           JOIN roles r ON u.role_id = r.id
           LEFT JOIN user_scopes us ON u.id = us.user_id
           WHERE us.company_id = $1;`
        : `SELECT uma.user_id, u.email, u.full_name, r.name as role_name, uma.menu_id, uma.can_view, uma.can_edit
           FROM user_menu_access uma
           JOIN user_profiles u ON uma.user_id = u.id
           JOIN roles r ON u.role_id = r.id;`;
      const uwmaParams = filterCompanyId ? [filterCompanyId] : [];
      const uwmaRes = await dbQuery(uwmaSql, uwmaParams);

      // 4. Fetch all user profiles for selection (scoped to company)
      const usersSql = filterCompanyId
        ? `SELECT u.id, u.email, u.full_name, r.name as role_name, u.is_active
           FROM user_profiles u
           JOIN roles r ON u.role_id = r.id
           LEFT JOIN user_scopes us ON u.id = us.user_id
           WHERE us.company_id = $1
           ORDER BY u.full_name;`
        : `SELECT u.id, u.email, u.full_name, r.name as role_name, u.is_active
           FROM user_profiles u
           JOIN roles r ON u.role_id = r.id
           ORDER BY u.full_name;`;
      const usersParams = filterCompanyId ? [filterCompanyId] : [];
      const usersRes = await dbQuery(usersSql, usersParams);

      return NextResponse.json({
        success: true,
        data: {
          menus: menusRes.rows,
          rwma: rwmaRes.rows,
          uwma: uwmaRes.rows,
          users: usersRes.rows,
          activeScopeCompanyId: filterCompanyId,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        menus: [],
        rwma: [],
        uwma: [],
        users: [],
        activeScopeCompanyId: filterCompanyId,
      },
    });
  } catch (error: any) {
    console.error('Menu management GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch menu access data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    if (actor.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Only SUPER_ADMIN can modify system menu access matrix' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { type, roleName, userId, menuId, canView, canEdit, modifiedBy } = body;

    if (!getDbPool()) {
      return NextResponse.json({ success: true, message: 'Simulated update.' });
    }

    if (type === 'RWMA') {
      // Role-Wise Menu Access update
      if (!roleName || !menuId) {
        return NextResponse.json({ success: false, error: 'Missing roleName or menuId' }, { status: 400 });
      }

      await dbQuery(`
        INSERT INTO role_menu_access (role_name, menu_id, can_view, can_edit)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (role_name, menu_id) DO UPDATE
        SET can_view = EXCLUDED.can_view, can_edit = EXCLUDED.can_edit;
      `, [roleName, menuId, canView ?? true, canEdit ?? false]);

      await SubmissionRepository.recordAuditLog(
        'RWMA_UPDATE',
        modifiedBy || actor.email || 'admin@afaztobacco.com',
        'role_menu_access',
        `${roleName}_${menuId}`,
        undefined,
        { roleName, menuId, canView, canEdit }
      );

      return NextResponse.json({
        success: true,
        message: `Updated RWMA for role ${roleName} on menu ${menuId}.`,
      });
    }

    if (type === 'UWMA') {
      // User-Wise Menu Access override update
      if (!userId || !menuId) {
        return NextResponse.json({ success: false, error: 'Missing userId or menuId' }, { status: 400 });
      }

      await dbQuery(`
        INSERT INTO user_menu_access (user_id, menu_id, can_view, can_edit)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, menu_id) DO UPDATE
        SET can_view = EXCLUDED.can_view, can_edit = EXCLUDED.can_edit;
      `, [userId, menuId, canView ?? true, canEdit ?? false]);

      await SubmissionRepository.recordAuditLog(
        'UWMA_UPDATE',
        modifiedBy || actor.email || 'admin@afaztobacco.com',
        'user_menu_access',
        `${userId}_${menuId}`,
        undefined,
        { userId, menuId, canView, canEdit }
      );

      return NextResponse.json({
        success: true,
        message: `Updated UWMA for user ${userId} on menu ${menuId}.`,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid update type' }, { status: 400 });
  } catch (error: any) {
    console.error('Menu management POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update menu permissions' },
      { status: 500 }
    );
  }
}
