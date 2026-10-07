// Tier 2: Brand & Pricing Controller & Route Handler
// Full CRUD with Server-Side Pagination, Search, Sorting & CSV Export

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
    const type = searchParams.get('type');
    const sortBy = searchParams.get('sortBy') || 'b.sort_order';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc';
    const isExport = searchParams.get('export') === 'csv';

    const cleanSortBy = sortBy.replace(/^b\./, '');
    const actualPageSize = isExport ? -1 : pageSize;
    const filterType = type && type !== 'ALL' ? type : null;

    // PostgreSQL Stored Procedure: sp_get_brands_paginated
    const result = await PaginationHelper.executeFunction(
      'sp_get_brands_paginated',
      [page, actualPageSize, search || null, filterType, cleanSortBy, sortOrder]
    );

    // Handle CSV Export
    if (isExport) {
      const csv = PaginationHelper.toCsv(result.data, {
        id: 'Brand ID',
        name: 'Brand Name',
        type: 'Product Category',
        unit_price: 'Unit Price (BDT)',
        sort_order: 'Display Order',
        is_active: 'Active Status',
        effective_from: 'Effective Date',
      });

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="Brand_Catalog_${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    logger.error('Failed to fetch brands', error, 'BrandController');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch brands' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    if (actor.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN can create brands');
    }

    const body = await request.json();
    const { name, type, unitPrice, sortOrder } = body;

    if (!name || !name.trim()) throw new ValidationError('Brand name is required');
    if (!type) throw new ValidationError('Product type (CIGARETTE or ZARDA) is required');

    const brandRes = await dbQuery(
      `INSERT INTO brands (name, type, sort_order, is_active)
       VALUES ($1, $2, $3, TRUE)
       RETURNING id, name, type, sort_order`,
      [name.trim(), type, sortOrder || 0]
    );

    const newBrand = brandRes.rows[0];

    // Insert unit price if specified
    if (unitPrice !== undefined && unitPrice !== null) {
      await dbQuery(
        `INSERT INTO prices (brand_id, unit_price, effective_from)
         VALUES ($1, $2, CURRENT_DATE)`,
        [newBrand.id, parseFloat(unitPrice) || 0]
      );
    }

    // Audit log
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, new_values)
         VALUES ($1, $2, $3, $4, $5)`,
        [actor.id, AUDIT_ACTIONS.PRICE_UPDATE, 'brands', newBrand.id, JSON.stringify({ name, type, unitPrice })]
      );
    } catch {}

    logger.info(`Brand created: ${newBrand.name} (${newBrand.type})`, 'BrandController');

    return NextResponse.json({
      success: true,
      data: newBrand,
      message: 'Brand created successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create brand' },
      { status: error.statusCode || 400 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    if (actor.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN can update brands');
    }

    const body = await request.json();
    const { id, name, type, unitPrice, sortOrder, isActive } = body;

    if (!id) throw new ValidationError('Brand ID is required');

    await dbQuery(
      `UPDATE brands
       SET name = COALESCE($1, name),
           type = COALESCE($2, type),
           sort_order = COALESCE($3, sort_order),
           is_active = COALESCE($4, is_active)
       WHERE id = $5`,
      [name || null, type || null, sortOrder !== undefined ? sortOrder : null, isActive !== undefined ? isActive : null, id]
    );

    if (unitPrice !== undefined && unitPrice !== null) {
      await dbQuery(
        `INSERT INTO prices (brand_id, unit_price, effective_from)
         VALUES ($1, $2, CURRENT_DATE)`,
        [id, parseFloat(unitPrice) || 0]
      );
    }

    // Audit log
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, new_values)
         VALUES ($1, $2, $3, $4, $5)`,
        [actor.id, AUDIT_ACTIONS.PRICE_UPDATE, 'brands', id, JSON.stringify(body)]
      );
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'Brand updated successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update brand' },
      { status: error.statusCode || 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    if (actor.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN can delete brands');
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const body = await request.json().catch(() => ({}));
    const idsToDelete: string[] = body.ids || (id ? [id] : []);

    if (idsToDelete.length === 0) {
      throw new ValidationError('At least one Brand ID is required');
    }

    await dbQuery(`DELETE FROM brands WHERE id = ANY($1::uuid[])`, [idsToDelete]);

    // Audit log
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, old_values)
         VALUES ($1, $2, $3, $4, $5)`,
        [actor.id, 'DELETE', 'brands', idsToDelete.join(','), JSON.stringify({ deletedIds: idsToDelete })]
      );
    } catch {}

    return NextResponse.json({
      success: true,
      message: `Deleted ${idsToDelete.length} brand(s) successfully`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete brand' },
      { status: error.statusCode || 400 }
    );
  }
}
