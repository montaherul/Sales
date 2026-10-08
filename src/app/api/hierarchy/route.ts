// Tier 2: Hierarchy Controller & Route Handler
// Full CRUD with Server-Side Pagination, Company-Wise Scoping, Search, Sorting & CSV Export

import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/shared/database/db';
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
    const regionId = searchParams.get('regionId');
    const sortBy = searchParams.get('sortBy') || 't.sort_order';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc';
    const isExport = searchParams.get('export') === 'csv';

    const cleanSortBy = sortBy.replace(/^t\./, '');
    const actualPageSize = isExport ? -1 : pageSize;
    const actor = await getAuthenticatedUser(request);
    let filterCompanyId = actor.role === 'SUPER_ADMIN' 
      ? (companyId && companyId !== 'ALL' ? companyId : null)
      : (actor.companyId || null);

    const filterRegionId = regionId && regionId !== 'ALL' ? regionId : null;

    // PostgreSQL Stored Procedure: sp_get_territories_paginated
    const result = await PaginationHelper.executeFunction(
      'sp_get_territories_paginated',
      [page, actualPageSize, search || null, filterRegionId, filterCompanyId, cleanSortBy, sortOrder]
    );

    // Handle CSV Export
    if (isExport) {
      const csv = PaginationHelper.toCsv(result.data, {
        id: 'Territory ID',
        name: 'Territory Name',
        region_name: 'Region',
        wing_name: 'Wing',
        division_name: 'Division',
        company_name: 'Company Entity',
        sort_order: 'Display Order',
        created_at: 'Created Date',
      });

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="Territories_Hierarchy_${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    logger.error('Failed to fetch hierarchy', error, 'HierarchyController');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch hierarchy' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    if (actor.role !== ROLES.SUPER_ADMIN && actor.role !== ROLES.COMPANY_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN or COMPANY_ADMIN can create territories');
    }

    const body = await request.json();
    const { name, regionId, sortOrder } = body;

    if (!name || !name.trim()) throw new ValidationError('Territory name is required');
    if (!regionId) throw new ValidationError('Region selection is required');

    // Tenant check for COMPANY_ADMIN
    if (actor.role === ROLES.COMPANY_ADMIN) {
      const regRes = await dbQuery(
        `SELECT d.company_id 
         FROM regions r 
         JOIN wings w ON r.wing_id = w.id 
         JOIN divisions d ON w.division_id = d.id 
         WHERE r.id = $1 LIMIT 1`,
        [regionId]
      );
      if (regRes.rows.length === 0 || regRes.rows[0].company_id !== actor.companyId) {
        throw new ForbiddenError('Cannot create territories under regions outside your company');
      }
    }

    const insertResult = await dbQuery(
      `INSERT INTO territories (name, region_id, sort_order)
       VALUES ($1, $2, $3)
       RETURNING id, name, region_id, sort_order, created_at`,
      [name.trim(), regionId, sortOrder || 0]
    );

    const newTerritory = insertResult.rows[0];

    // Audit log
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, company_id, event_type, entity_name, entity_id, new_values)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [actor.id, actor.companyId, AUDIT_ACTIONS.CREATE, 'territories', newTerritory.id, JSON.stringify(newTerritory)]
      );
    } catch (auditErr) {
      logger.warn('Failed to write territory creation audit log', 'HierarchyController.POST', { auditErr });
    }

    logger.info(`Territory created: ${newTerritory.name}`, 'HierarchyController');

    return NextResponse.json({
      success: true,
      data: newTerritory,
      message: 'Territory created successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create territory' },
      { status: error.statusCode || 400 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    if (actor.role !== ROLES.SUPER_ADMIN && actor.role !== ROLES.COMPANY_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN or COMPANY_ADMIN can update territories');
    }

    const body = await request.json();
    const { id, name, regionId, sortOrder } = body;

    if (!id) throw new ValidationError('Territory ID is required');
    if (!name || !name.trim()) throw new ValidationError('Territory name is required');

    // Tenant check for COMPANY_ADMIN
    if (actor.role === ROLES.COMPANY_ADMIN) {
      const terrCheck = await dbQuery(
        `SELECT d.company_id 
         FROM territories t 
         JOIN regions r ON t.region_id = r.id 
         JOIN wings w ON r.wing_id = w.id 
         JOIN divisions d ON w.division_id = d.id 
         WHERE t.id = $1 LIMIT 1`,
        [id]
      );
      if (terrCheck.rows.length === 0 || terrCheck.rows[0].company_id !== actor.companyId) {
        throw new ForbiddenError('You can only update territories within your company');
      }
    }

    const updateResult = await dbQuery(
      `UPDATE territories
       SET name = $1, region_id = COALESCE($2, region_id), sort_order = COALESCE($3, sort_order)
       WHERE id = $4
       RETURNING id, name, region_id, sort_order`,
      [name.trim(), regionId || null, sortOrder !== undefined ? sortOrder : null, id]
    );

    if (updateResult.rows.length === 0) {
      throw new ValidationError('Territory not found');
    }

    const updated = updateResult.rows[0];

    // Audit log
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, company_id, event_type, entity_name, entity_id, new_values)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [actor.id, actor.companyId, AUDIT_ACTIONS.UPDATE, 'territories', updated.id, JSON.stringify(updated)]
      );
    } catch (auditErr) {
      logger.warn('Failed to write territory update audit log', 'HierarchyController.PUT', { auditErr });
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Territory updated successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update territory' },
      { status: error.statusCode || 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    if (actor.role !== ROLES.SUPER_ADMIN && actor.role !== ROLES.COMPANY_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN or COMPANY_ADMIN can delete territories');
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const body = await request.json().catch(() => ({}));
    const idsToDelete: string[] = body.ids || (id ? [id] : []);

    if (idsToDelete.length === 0) {
      throw new ValidationError('At least one Territory ID is required');
    }

    // Tenant check for COMPANY_ADMIN
    if (actor.role === ROLES.COMPANY_ADMIN) {
      const terrCheck = await dbQuery(
        `SELECT t.id, d.company_id 
         FROM territories t 
         JOIN regions r ON t.region_id = r.id 
         JOIN wings w ON r.wing_id = w.id 
         JOIN divisions d ON w.division_id = d.id 
         WHERE t.id = ANY($1::uuid[])`,
        [idsToDelete]
      );
      const foreign = terrCheck.rows.filter(r => r.company_id !== actor.companyId);
      if (foreign.length > 0) {
        throw new ForbiddenError('You can only delete territories within your company');
      }
    }

    await dbQuery(`DELETE FROM territories WHERE id = ANY($1::uuid[])`, [idsToDelete]);

    // Audit log
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, company_id, event_type, entity_name, entity_id, old_values)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [actor.id, actor.companyId, 'DELETE', 'territories', idsToDelete.join(','), JSON.stringify({ deletedIds: idsToDelete })]
      );
    } catch (auditErr) {
      logger.warn('Failed to write territory deletion audit log', 'HierarchyController.DELETE', { auditErr });
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${idsToDelete.length} territory(ies) successfully`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete territory' },
      { status: error.statusCode || 400 }
    );
  }
}
