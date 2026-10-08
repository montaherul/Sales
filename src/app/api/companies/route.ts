// Tier 2: Company Presentation Controller & Route Handler
// Thin HTTP endpoint delegating to CompanyService
// AGENTS1.md Rule 4 & Rule 5 (Thin Controllers / Separation of Concerns)

import { NextRequest, NextResponse } from 'next/server';
import { CompanyService } from '@/modules/organization';
import { getAuthenticatedUser } from '@/shared/auth';
import { AppError } from '@/shared/errors';
import { logger } from '@/shared/logger';

export async function GET(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'c.created_at';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';
    const isExport = searchParams.get('export') === 'csv';

    const filterOptions = {
      page,
      pageSize,
      search,
      sortBy,
      sortOrder,
    };

    if (isExport) {
      const csv = await CompanyService.exportCompaniesCsv(filterOptions, actor);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="Companies_Export_${Date.now()}.csv"`,
        },
      });
    }

    const result = await CompanyService.getCompaniesPaginated(filterOptions, actor);
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    const status = error instanceof AppError ? error.statusCode : 500;
    logger.error('Failed to fetch companies', error, 'CompanyController.GET');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch companies' },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const body = await request.json();

    const created = await CompanyService.createCompany(body, actor);

    return NextResponse.json({
      success: true,
      message: 'Company created successfully',
      data: created,
    });
  } catch (error: any) {
    const status = error instanceof AppError ? error.statusCode : 400;
    logger.warn('Failed to create company', 'CompanyController.POST', { error: error.message });
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create company' },
      { status }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ success: false, error: 'Company ID is required' }, { status: 400 });
    }

    const updated = await CompanyService.updateCompany(body, actor);

    return NextResponse.json({
      success: true,
      message: 'Company updated successfully',
      data: updated,
    });
  } catch (error: any) {
    const status = error instanceof AppError ? error.statusCode : 400;
    logger.warn('Failed to update company', 'CompanyController.PUT', { error: error.message });
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update company' },
      { status }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const body = await request.json().catch(() => ({}));
    const idsToDelete: string[] = body.ids || (id ? [id] : []);

    const count = await CompanyService.deleteCompanies(idsToDelete, actor);

    return NextResponse.json({
      success: true,
      message: `Deleted ${count} company/companies successfully`,
    });
  } catch (error: any) {
    const status = error instanceof AppError ? error.statusCode : 400;
    logger.warn('Failed to delete companies', 'CompanyController.DELETE', { error: error.message });
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete companies' },
      { status }
    );
  }
}
