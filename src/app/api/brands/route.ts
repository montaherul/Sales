// Tier 2: Brand & Pricing Presentation Controller & Route Handler
// Thin HTTP endpoint delegating to ProductService
// AGENTS1.md Rule 4 & Rule 5 (Thin Controllers / Separation of Concerns)

import { NextRequest, NextResponse } from 'next/server';
import { ProductService } from '@/modules/product';
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
    const type = searchParams.get('type');
    const sortBy = searchParams.get('sortBy') || 'b.sort_order';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc';
    const isExport = searchParams.get('export') === 'csv';

    const filterOptions = {
      page,
      pageSize,
      search,
      type,
      companyId: searchParams.get('companyId'),
      sortBy,
      sortOrder,
    };

    if (isExport) {
      const csv = await ProductService.exportBrandsCsv(filterOptions, actor);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="Brands_Catalog_${Date.now()}.csv"`,
        },
      });
    }

    const result = await ProductService.getBrandsPaginated(filterOptions, actor);
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    const status = error instanceof AppError ? error.statusCode : 500;
    logger.error('Failed to fetch brands', error, 'BrandController.GET');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch brands' },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const body = await request.json();

    const created = await ProductService.createBrand(body, actor);

    return NextResponse.json({
      success: true,
      message: 'Brand created successfully',
      data: created,
    });
  } catch (error: any) {
    const status = error instanceof AppError ? error.statusCode : 400;
    logger.warn('Failed to create brand', 'BrandController.POST', { error: error.message });
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create brand' },
      { status }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const body = await request.json();

    const updated = await ProductService.updateBrand(body, actor);

    return NextResponse.json({
      success: true,
      message: 'Brand updated successfully',
      data: updated,
    });
  } catch (error: any) {
    const status = error instanceof AppError ? error.statusCode : 400;
    logger.warn('Failed to update brand', 'BrandController.PUT', { error: error.message });
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update brand' },
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

    const count = await ProductService.deleteBrands(idsToDelete, actor);

    return NextResponse.json({
      success: true,
      message: `Deleted ${count} brand(s) successfully`,
    });
  } catch (error: any) {
    const status = error instanceof AppError ? error.statusCode : 400;
    logger.warn('Failed to delete brands', 'BrandController.DELETE', { error: error.message });
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete brands' },
      { status }
    );
  }
}
