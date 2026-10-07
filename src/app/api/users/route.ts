// Tier 2: User Controller & Route Handler
// Full CRUD with Server-Side Pagination, Company-Wise Scoping, Search, Sorting & CSV Export

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { dbQuery, getDbPool } from '@/shared/database/db';
import { PaginationHelper } from '@/shared/database/pagination';
import { getAuthenticatedUser } from '@/shared/auth';
import { ROLES, AUDIT_ACTIONS } from '@/shared/constants';
import { ForbiddenError, ValidationError } from '@/shared/errors';
import { logger } from '@/shared/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    const search = searchParams.get('search') || '';
    const companyId = searchParams.get('companyId');
    const roleName = searchParams.get('roleName');
    const sortBy = searchParams.get('sortBy') || 'u.created_at';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc';
    const isExport = searchParams.get('export') === 'csv';

    const cleanSortBy = sortBy.replace(/^u\./, '');
    const actualPageSize = isExport ? -1 : pageSize;
    const filterCompanyId = companyId && companyId !== 'ALL' ? companyId : null;
    const filterRoleName = roleName && roleName !== 'ALL' ? roleName : null;

    // PostgreSQL Stored Procedure: sp_get_users_paginated
    const result = await PaginationHelper.executeFunction(
      'sp_get_users_paginated',
      [page, actualPageSize, search || null, filterCompanyId, filterRoleName, cleanSortBy, sortOrder]
    );

    // Handle CSV Export
    if (isExport) {
      const csv = PaginationHelper.toCsv(result.data, {
        id: 'User ID',
        full_name: 'Full Name',
        email: 'Email',
        phone: 'Phone',
        role_name: 'Role',
        company_name: 'Company',
        region_name: 'Region',
        territory_name: 'Territory',
        is_active: 'Active Status',
        created_at: 'Created Date',
      });

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="Users_Directory_${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    logger.error('Failed to fetch users', error, 'UserController');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    if (actor.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN can create users');
    }

    const body = await request.json();
    const { email, fullName, phone, roleName, companyId, territoryId, regionId } = body;

    if (!email || !fullName || !roleName) {
      throw new ValidationError('Email, Full Name, and Role are mandatory');
    }

    // Lookup role ID
    const roleRes = await dbQuery('SELECT id FROM roles WHERE name = $1 LIMIT 1', [roleName]);
    const roleId = roleRes.rows[0]?.id;
    if (!roleId) {
      throw new ValidationError(`Invalid role: ${roleName}`);
    }

    // Hash initial password (default '123')
    const initialPassword = body.password || '123';
    const passwordHash = bcrypt.hashSync(initialPassword, 10);

    // Insert user_profile with hashed password and onboarding flag
    const userRes = await dbQuery(
      `INSERT INTO user_profiles (email, full_name, phone, role_id, is_active, password_hash, must_change_password, is_onboarded)
       VALUES ($1, $2, $3, $4, TRUE, $5, TRUE, FALSE)
       ON CONFLICT (email) DO UPDATE
       SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone, role_id = EXCLUDED.role_id, updated_at = NOW()
       RETURNING id, email, full_name, role_id`,
      [email.trim().toLowerCase(), fullName.trim(), phone || null, roleId, passwordHash]
    );

    const userId = userRes.rows[0].id;

    // Resolve organizational scope hierarchically
    let finalCompanyId = companyId && companyId !== 'ALL' ? companyId : null;
    let finalRegionId = regionId && regionId !== 'ALL' ? regionId : null;
    let finalTerritoryId = territoryId && territoryId !== 'ALL' ? territoryId : null;

    if (finalTerritoryId) {
      const terrInfo = await dbQuery(
        `SELECT t.region_id, d.company_id 
         FROM territories t 
         JOIN regions r ON t.region_id = r.id 
         JOIN wings w ON r.wing_id = w.id 
         JOIN divisions d ON w.division_id = d.id 
         WHERE t.id = $1 LIMIT 1`,
        [finalTerritoryId]
      );
      if (terrInfo.rows.length > 0) {
        if (!finalRegionId) finalRegionId = terrInfo.rows[0].region_id;
        if (!finalCompanyId) finalCompanyId = terrInfo.rows[0].company_id;
      }
    } else if (finalRegionId && !finalCompanyId) {
      const regInfo = await dbQuery(
        `SELECT d.company_id 
         FROM regions r 
         JOIN wings w ON r.wing_id = w.id 
         JOIN divisions d ON w.division_id = d.id 
         WHERE r.id = $1 LIMIT 1`,
        [finalRegionId]
      );
      if (regInfo.rows.length > 0) {
        finalCompanyId = regInfo.rows[0].company_id;
      }
    }

    // Assign organizational scope (Company + Region + Territory)
    await dbQuery(`DELETE FROM user_scopes WHERE user_id = $1`, [userId]);
    await dbQuery(
      `INSERT INTO user_scopes (user_id, company_id, region_id, territory_id)
       VALUES ($1, $2, $3, $4)`,
      [userId, finalCompanyId, finalRegionId, finalTerritoryId]
    );

    // Audit log
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, new_values)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          actor.id,
          AUDIT_ACTIONS.CREATE,
          'user_profiles',
          userId,
          JSON.stringify({ email, fullName, roleName, companyId: finalCompanyId, territoryId: finalTerritoryId, regionId: finalRegionId }),
        ]
      );
    } catch {}

    logger.info(`User created/scoped: ${email} (${roleName})`, 'UserController');

    return NextResponse.json({
      success: true,
      message: `User ${email} created successfully`,
      data: { userId },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create user' },
      { status: error.statusCode || 400 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    if (actor.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN can update users');
    }

    const body = await request.json();
    const { id, email, fullName, phone, roleName, companyId, territoryId, regionId, isActive } = body;

    if (!id) throw new ValidationError('User ID is required');

    // Lookup role ID if roleName provided
    let roleId: string | undefined;
    if (roleName) {
      const roleRes = await dbQuery('SELECT id FROM roles WHERE name = $1 LIMIT 1', [roleName]);
      roleId = roleRes.rows[0]?.id;
    }

    await dbQuery(
      `UPDATE user_profiles
       SET full_name = COALESCE($1, full_name),
           phone = COALESCE($2, phone),
           role_id = COALESCE($3, role_id),
           is_active = COALESCE($4, is_active),
           updated_at = NOW()
       WHERE id = $5`,
      [fullName || null, phone || null, roleId || null, isActive !== undefined ? isActive : null, id]
    );

    // Update scopes hierarchically
    if (companyId !== undefined || territoryId !== undefined || regionId !== undefined) {
      let finalCompanyId = companyId && companyId !== 'ALL' ? companyId : null;
      let finalRegionId = regionId && regionId !== 'ALL' ? regionId : null;
      let finalTerritoryId = territoryId && territoryId !== 'ALL' ? territoryId : null;

      if (finalTerritoryId) {
        const terrInfo = await dbQuery(
          `SELECT t.region_id, d.company_id 
           FROM territories t 
           JOIN regions r ON t.region_id = r.id 
           JOIN wings w ON r.wing_id = w.id 
           JOIN divisions d ON w.division_id = d.id 
           WHERE t.id = $1 LIMIT 1`,
          [finalTerritoryId]
        );
        if (terrInfo.rows.length > 0) {
          if (!finalRegionId) finalRegionId = terrInfo.rows[0].region_id;
          if (!finalCompanyId) finalCompanyId = terrInfo.rows[0].company_id;
        }
      } else if (finalRegionId && !finalCompanyId) {
        const regInfo = await dbQuery(
          `SELECT d.company_id 
           FROM regions r 
           JOIN wings w ON r.wing_id = w.id 
           JOIN divisions d ON w.division_id = d.id 
           WHERE r.id = $1 LIMIT 1`,
          [finalRegionId]
        );
        if (regInfo.rows.length > 0) {
          finalCompanyId = regInfo.rows[0].company_id;
        }
      }

      await dbQuery(`DELETE FROM user_scopes WHERE user_id = $1`, [id]);
      await dbQuery(
        `INSERT INTO user_scopes (user_id, company_id, region_id, territory_id)
         VALUES ($1, $2, $3, $4)`,
        [id, finalCompanyId, finalRegionId, finalTerritoryId]
      );
    }

    // Audit log
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, new_values)
         VALUES ($1, $2, $3, $4, $5)`,
        [actor.id, AUDIT_ACTIONS.UPDATE, 'user_profiles', id, JSON.stringify(body)]
      );
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'User updated successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update user' },
      { status: error.statusCode || 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    if (actor.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN can delete users');
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const body = await request.json().catch(() => ({}));
    const idsToDelete: string[] = body.ids || (id ? [id] : []);

    if (idsToDelete.length === 0) {
      throw new ValidationError('At least one User ID is required');
    }

    await dbQuery(`DELETE FROM user_profiles WHERE id = ANY($1::uuid[])`, [idsToDelete]);

    // Audit log
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, old_values)
         VALUES ($1, $2, $3, $4, $5)`,
        [actor.id, 'DELETE', 'user_profiles', idsToDelete.join(','), JSON.stringify({ deletedIds: idsToDelete })]
      );
    } catch {}

    return NextResponse.json({
      success: true,
      message: `Deleted ${idsToDelete.length} user(s) successfully`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete user' },
      { status: error.statusCode || 400 }
    );
  }
}
