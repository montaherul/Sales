// Tier 2: Company Controller & Route Handler
// Full CRUD with server-side pagination, search, sorting, multi-selection delete, and CSV export

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
    const sortBy = searchParams.get('sortBy') || 'c.created_at';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';
    const isExport = searchParams.get('export') === 'csv';

    const cleanSortBy = sortBy.replace(/^c\./, '');
    const actualPageSize = isExport ? -1 : pageSize;

    // PostgreSQL Stored Procedure: sp_get_companies_paginated
    const result = await PaginationHelper.executeFunction(
      'sp_get_companies_paginated',
      [page, actualPageSize, search || null, cleanSortBy, sortOrder]
    );

    // Handle CSV Export
    if (isExport) {
      const csv = PaginationHelper.toCsv(result.data, {
        id: 'Company ID',
        name: 'Company Name',
        code: 'Company Code',
        division_count: 'Total Divisions',
        territory_count: 'Total Territories',
        user_count: 'Assigned Users',
        created_at: 'Created Date',
      });

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="Companies_Export_${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    logger.error('Failed to fetch companies', error, 'CompanyController');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch companies' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (user.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN can create companies');
    }

    const body = await request.json();
    const { name, code } = body;

    if (!name || name.trim().length === 0) {
      throw new ValidationError('Company name is required');
    }

    const companyCode = (code || name.substring(0, 4)).toUpperCase().trim();

    const insertResult = await dbQuery(
      `INSERT INTO companies (name, code)
       VALUES ($1, $2)
       RETURNING id, name, code, created_at`,
      [name.trim(), companyCode]
    );

    const newCompany = insertResult.rows[0];

    // Audit log
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, new_values)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, AUDIT_ACTIONS.CREATE, 'companies', newCompany.id, JSON.stringify(newCompany)]
      );
    } catch {}

    logger.info(`Company created: ${newCompany.name} (${newCompany.code})`, 'CompanyController');

    return NextResponse.json({
      success: true,
      data: newCompany,
      message: 'Company created successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create company' },
      { status: error.statusCode || 400 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (user.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN can update companies');
    }

    const body = await request.json();
    const { id, name, code } = body;

    if (!id) throw new ValidationError('Company ID is required for update');
    if (!name || name.trim().length === 0) throw new ValidationError('Company name is required');

    const updateResult = await dbQuery(
      `UPDATE companies
       SET name = $1, code = $2
       WHERE id = $3
       RETURNING id, name, code, created_at`,
      [name.trim(), (code || '').toUpperCase().trim(), id]
    );

    if (updateResult.rows.length === 0) {
      throw new ValidationError('Company not found');
    }

    const updated = updateResult.rows[0];

    // Audit log
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, new_values)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, AUDIT_ACTIONS.UPDATE, 'companies', updated.id, JSON.stringify(updated)]
      );
    } catch {}

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Company updated successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update company' },
      { status: error.statusCode || 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (user.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN can delete companies');
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const body = await request.json().catch(() => ({}));
    const idsToDelete: string[] = body.ids || (id ? [id] : []);

    if (idsToDelete.length === 0) {
      throw new ValidationError('At least one Company ID is required for deletion');
    }

    await dbQuery(`DELETE FROM companies WHERE id = ANY($1::uuid[])`, [idsToDelete]);

    // Audit log
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, old_values)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, 'DELETE', 'companies', idsToDelete.join(','), JSON.stringify({ deletedIds: idsToDelete })]
      );
    } catch {}

    return NextResponse.json({
      success: true,
      message: `Deleted ${idsToDelete.length} company(ies) successfully`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete company' },
      { status: error.statusCode || 400 }
    );
  }
}
