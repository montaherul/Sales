// Tier 2: Role Management Controller & Route Handler
// Full CRUD with Server-Side Pagination, Search, Sorting, CSV Export, and System Role Protection

import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/shared/database/db';
import { PaginationHelper } from '@/shared/database/pagination';
import { getAuthenticatedUser } from '@/shared/auth';
import { ROLES, AUDIT_ACTIONS } from '@/shared/constants';
import { ForbiddenError, ValidationError } from '@/shared/errors';
import { logger } from '@/shared/logger';

const CORE_SYSTEM_ROLES = ['SUPER_ADMIN', 'RSO', 'TSO', 'CSR'];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'name';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc';
    const isExport = searchParams.get('export') === 'csv';
    const isAll = searchParams.get('all') === 'true';

    const actualPageSize = isExport || isAll ? -1 : pageSize;

    // PostgreSQL Stored Procedure: sp_get_roles_paginated
    const result = await PaginationHelper.executeFunction(
      'sp_get_roles_paginated',
      [page, actualPageSize, search || null, sortBy, sortOrder.toUpperCase()]
    );

    // CSV Export Handler
    if (isExport) {
      const csv = PaginationHelper.toCsv(result.data, {
        id: 'Role ID',
        name: 'Role Name',
        description: 'Description',
        user_count: 'Active Users',
        permission_count: 'Assigned Permissions',
        is_system_role: 'System Protected',
        created_at: 'Created Date',
      });

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="Roles_Catalog_${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    logger.error('Failed to fetch roles', error, 'RoleController');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch roles' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    if (actor.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN can create roles');
    }

    const body = await request.json();
    let { name, description } = body;

    if (!name || !name.trim()) {
      throw new ValidationError('Role Name is required');
    }

    // Format role name as uppercase alphanumeric with underscores
    name = name.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');

    // Check duplicate
    const existing = await dbQuery('SELECT id FROM roles WHERE name = $1', [name]);
    if (existing.rows.length > 0) {
      throw new ValidationError(`Role "${name}" already exists`);
    }

    const res = await dbQuery(
      `INSERT INTO roles (name, description)
       VALUES ($1, $2)
       RETURNING id, name, description, created_at`,
      [name, description?.trim() || null]
    );

    const newRole = res.rows[0];

    // Audit log
    await dbQuery(
      `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, new_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [actor.id, AUDIT_ACTIONS.CREATE, 'roles', newRole.id, JSON.stringify(newRole)]
    ).catch(() => {});

    logger.info(`Role created: ${name} by ${actor.email}`, 'RoleController');

    return NextResponse.json({
      success: true,
      message: `Role ${name} created successfully`,
      data: newRole,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create role' },
      { status: error.statusCode || 400 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    if (actor.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN can update roles');
    }

    const body = await request.json();
    const { id, name, description } = body;

    if (!id) throw new ValidationError('Role ID is required');

    // Fetch existing role
    const existing = await dbQuery('SELECT id, name, description FROM roles WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      throw new ValidationError('Role not found');
    }

    const currentRole = existing.rows[0];
    const isCoreRole = CORE_SYSTEM_ROLES.includes(currentRole.name);

    // If core role, forbid changing its name
    let targetName = currentRole.name;
    if (name && name.trim().toUpperCase() !== currentRole.name) {
      if (isCoreRole) {
        throw new ValidationError(`Core system role "${currentRole.name}" cannot be renamed`);
      }
      targetName = name.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    }

    await dbQuery(
      `UPDATE roles
       SET name = $1, description = $2
       WHERE id = $3`,
      [targetName, description !== undefined ? description?.trim() : currentRole.description, id]
    );

    // Audit log
    await dbQuery(
      `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, old_values, new_values)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [actor.id, AUDIT_ACTIONS.UPDATE, 'roles', id, JSON.stringify(currentRole), JSON.stringify({ name: targetName, description })]
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Role ${targetName} updated successfully`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update role' },
      { status: error.statusCode || 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    if (actor.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN can delete roles');
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const body = await request.json().catch(() => ({}));
    const idsToDelete: string[] = body.ids || (id ? [id] : []);

    if (idsToDelete.length === 0) {
      throw new ValidationError('Role ID is required');
    }

    for (const roleId of idsToDelete) {
      const roleRes = await dbQuery('SELECT name FROM roles WHERE id = $1', [roleId]);
      if (roleRes.rows.length === 0) continue;
      const roleName = roleRes.rows[0].name;

      // 1. Protect core system roles
      if (CORE_SYSTEM_ROLES.includes(roleName)) {
        throw new ValidationError(`Core system role "${roleName}" is protected and cannot be deleted.`);
      }

      // 2. Protect roles with active users
      const userCountRes = await dbQuery('SELECT COUNT(*) as count FROM user_profiles WHERE role_id = $1', [roleId]);
      const userCount = parseInt(userCountRes.rows[0].count, 10);
      if (userCount > 0) {
        throw new ValidationError(
          `Cannot delete role "${roleName}" because ${userCount} active user(s) are assigned to it. Reassign these users first.`
        );
      }
    }

    await dbQuery(`DELETE FROM roles WHERE id = ANY($1::uuid[])`, [idsToDelete]);

    // Audit log
    await dbQuery(
      `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, old_values)
       VALUES ($1, 'DELETE', 'roles', $2, $3)`,
      [actor.id, idsToDelete.join(','), JSON.stringify({ deletedIds: idsToDelete })]
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Deleted ${idsToDelete.length} custom role(s) successfully`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete role' },
      { status: error.statusCode || 400 }
    );
  }
}
