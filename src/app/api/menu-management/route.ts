import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, getDbPool } from '@/lib/db';
import { SubmissionRepository } from '@/lib/repositories/submission.repository';

export async function GET() {
  try {
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

      // 3. Fetch user menu access (UWMA) with user profiles
      const uwmaRes = await dbQuery(`
        SELECT uma.user_id, u.email, u.full_name, r.name as role_name, uma.menu_id, uma.can_view, uma.can_edit
        FROM user_menu_access uma
        JOIN user_profiles u ON uma.user_id = u.id
        JOIN roles r ON u.role_id = r.id;
      `);

      // 4. Fetch all user profiles for selection
      const usersRes = await dbQuery(`
        SELECT u.id, u.email, u.full_name, r.name as role_name, u.is_active
        FROM user_profiles u
        JOIN roles r ON u.role_id = r.id
        ORDER BY u.full_name;
      `);

      return NextResponse.json({
        success: true,
        data: {
          menus: menusRes.rows,
          rwma: rwmaRes.rows,
          uwma: uwmaRes.rows,
          users: usersRes.rows,
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
        modifiedBy || 'admin@afaztobacco.com',
        'role_menu_access',
        `${roleName}_${menuId}`,
        undefined,
        { roleName, menuId, canView, canEdit }
      );

      return NextResponse.json({
        success: true,
        message: `Updated RWMA for role ${roleName} on menu ${menuId}.`,
      });
    } else if (type === 'UWMA') {
      // User-Wise Menu Access update
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
        modifiedBy || 'admin@afaztobacco.com',
        'user_menu_access',
        `${userId}_${menuId}`,
        undefined,
        { userId, menuId, canView, canEdit }
      );

      return NextResponse.json({
        success: true,
        message: `Updated UWMA for user on menu ${menuId}.`,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid type (expected RWMA or UWMA)' }, { status: 400 });
  } catch (error: any) {
    console.error('Menu management POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update menu permissions' },
      { status: 500 }
    );
  }
}
