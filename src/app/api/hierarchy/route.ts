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

    const baseSelect = `
      SELECT 
        t.id, 
        t.name as territory_name, 
        t.sort_order, 
        t.created_at,
        r.id as region_id,
        r.name as region_name,
        w.name as wing_name,
        d.name as division_name,
        c.id as company_id,
        c.name as company_name
    `;

    const fromClause = `
      FROM territories t
      JOIN regions r ON t.region_id = r.id
      JOIN wings w ON r.wing_id = w.id
      JOIN divisions d ON w.division_id = d.id
      JOIN companies c ON d.company_id = c.id
    `;

    // Handle CSV Export
    if (isExport) {
      const allRows = await dbQuery(`
        ${baseSelect}
        ${fromClause}
        ORDER BY t.sort_order ASC
      `);

      const csv = PaginationHelper.toCsv(allRows.rows, {
        id: 'Territory ID',
        territory_name: 'Territory Name',
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

    const filters: Record<string, any> = {};
    if (companyId && companyId !== 'ALL') {
      filters['c.id'] = companyId;
    }
    if (regionId && regionId !== 'ALL') {
      filters['r.id'] = regionId;
    }

    const result = await PaginationHelper.paginate(
      baseSelect,
      fromClause,
      {
        page,
        pageSize,
        search,
        searchFields: ['t.name', 'r.name', 'w.name', 'd.name', 'c.name'],
        sortBy,
        sortOrder,
        filters,
      },
      't.sort_order'
    );

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
    if (actor.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN can create territories');
    }

    const body = await request.json();
    const { name, regionId, sortOrder } = body;

    if (!name || !name.trim()) throw new ValidationError('Territory name is required');
    if (!regionId) throw new ValidationError('Region selection is required');

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
        `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, new_values)
         VALUES ($1, $2, $3, $4, $5)`,
        [actor.id, AUDIT_ACTIONS.CREATE, 'territories', newTerritory.id, JSON.stringify(newTerritory)]
      );
    } catch {}

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
    if (actor.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN can update territories');
    }

    const body = await request.json();
    const { id, name, regionId, sortOrder } = body;

    if (!id) throw new ValidationError('Territory ID is required');
    if (!name || !name.trim()) throw new ValidationError('Territory name is required');

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
        `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, new_values)
         VALUES ($1, $2, $3, $4, $5)`,
        [actor.id, AUDIT_ACTIONS.UPDATE, 'territories', updated.id, JSON.stringify(updated)]
      );
    } catch {}

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
    if (actor.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN can delete territories');
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const body = await request.json().catch(() => ({}));
    const idsToDelete: string[] = body.ids || (id ? [id] : []);

    if (idsToDelete.length === 0) {
      throw new ValidationError('At least one Territory ID is required');
    }

    await dbQuery(`DELETE FROM territories WHERE id = ANY($1::uuid[])`, [idsToDelete]);

    // Audit log
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, old_values)
         VALUES ($1, $2, $3, $4, $5)`,
        [actor.id, 'DELETE', 'territories', idsToDelete.join(','), JSON.stringify({ deletedIds: idsToDelete })]
      );
    } catch {}

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
