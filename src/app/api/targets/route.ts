// Tier 2: Target Controller & Route Handler
// Full CRUD with Server-Side Pagination, Filtering, Search, Sorting & CSV Export

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
    const territoryId = searchParams.get('territoryId');
    const year = parseInt(searchParams.get('year') || '2026', 10);
    const month = parseInt(searchParams.get('month') || '10', 10);
    const sortBy = searchParams.get('sortBy') || 'tg.target_quantity';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';
    const isExport = searchParams.get('export') === 'csv';

    const baseSelect = `
      SELECT 
        tg.id, 
        tg.territory_id, 
        tg.brand_id, 
        tg.year, 
        tg.month, 
        tg.target_quantity, 
        tg.route_count, 
        tg.outlet_count, 
        tg.created_at,
        t.name as territory_name,
        b.name as brand_name,
        b.type as brand_type
    `;

    const fromClause = `
      FROM targets tg
      JOIN territories t ON tg.territory_id = t.id
      JOIN brands b ON tg.brand_id = b.id
    `;

    // Handle CSV Export
    if (isExport) {
      const allRows = await dbQuery(`
        ${baseSelect}
        ${fromClause}
        WHERE tg.year = $1 AND tg.month = $2
        ORDER BY t.name, b.name ASC
      `, [year, month]);

      const csv = PaginationHelper.toCsv(allRows.rows, {
        id: 'Target ID',
        territory_name: 'Territory',
        brand_name: 'Brand',
        brand_type: 'Type',
        target_quantity: 'Target Volume',
        route_count: 'Routes',
        outlet_count: 'Outlets',
        year: 'Year',
        month: 'Month',
      });

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="Targets_${year}_${month}_${Date.now()}.csv"`,
        },
      });
    }

    const filters: Record<string, any> = {
      'tg.year': year,
      'tg.month': month,
    };
    if (territoryId && territoryId !== 'ALL') {
      filters['tg.territory_id'] = territoryId;
    }

    const result = await PaginationHelper.paginate(
      baseSelect,
      fromClause,
      {
        page,
        pageSize,
        search,
        searchFields: ['t.name', 'b.name'],
        sortBy,
        sortOrder,
        filters,
      },
      'tg.target_quantity'
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    logger.error('Failed to fetch targets', error, 'TargetController');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch targets' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    if (actor.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN can configure targets');
    }

    const body = await request.json();
    const { territoryId, brandId, year, month, targetQuantity, routeCount, outletCount } = body;

    if (!territoryId || !brandId) throw new ValidationError('Territory and Brand are required');

    const upsertRes = await dbQuery(
      `INSERT INTO targets (territory_id, brand_id, year, month, target_quantity, route_count, outlet_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (territory_id, brand_id, year, month)
       DO UPDATE SET target_quantity = EXCLUDED.target_quantity,
                     route_count = EXCLUDED.route_count,
                     outlet_count = EXCLUDED.outlet_count
       RETURNING id, territory_id, brand_id, target_quantity`,
      [
        territoryId,
        brandId,
        year || 2026,
        month || 10,
        parseFloat(targetQuantity) || 0,
        routeCount || 0,
        outletCount || 0,
      ]
    );

    const saved = upsertRes.rows[0];

    // Audit log
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, new_values)
         VALUES ($1, $2, $3, $4, $5)`,
        [actor.id, AUDIT_ACTIONS.TARGET_UPDATE, 'targets', saved.id, JSON.stringify(body)]
      );
    } catch {}

    return NextResponse.json({
      success: true,
      data: saved,
      message: 'Target saved successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save target' },
      { status: error.statusCode || 400 }
    );
  }
}

export async function PUT(request: NextRequest) {
  return POST(request);
}

export async function DELETE(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    if (actor.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN can delete targets');
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const body = await request.json().catch(() => ({}));
    const idsToDelete: string[] = body.ids || (id ? [id] : []);

    if (idsToDelete.length === 0) {
      throw new ValidationError('At least one Target ID is required');
    }

    await dbQuery(`DELETE FROM targets WHERE id = ANY($1::uuid[])`, [idsToDelete]);

    // Audit log
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, old_values)
         VALUES ($1, $2, $3, $4, $5)`,
        [actor.id, 'DELETE', 'targets', idsToDelete.join(','), JSON.stringify({ deletedIds: idsToDelete })]
      );
    } catch {}

    return NextResponse.json({
      success: true,
      message: `Deleted ${idsToDelete.length} target(s) successfully`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete target' },
      { status: error.statusCode || 400 }
    );
  }
}
