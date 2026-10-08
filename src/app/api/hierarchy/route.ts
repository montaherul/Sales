// Tier 2: Hierarchy Presentation Controller & Route Handler
// Thin HTTP endpoint delegating to HierarchyService
// AGENTS1.md Rule 4 & Rule 5 (Thin Controllers / Separation of Concerns)

import { NextRequest, NextResponse } from 'next/server';
import { HierarchyService } from '@/modules/organization';
import { getAuthenticatedUser } from '@/shared/auth';
import { AppError } from '@/shared/errors';
import { logger } from '@/shared/logger';

export async function GET(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);

    // If options parameter requested, return master options tree
    if (searchParams.get('options') === 'true') {
      const options = await HierarchyService.getHierarchyOptions(actor, searchParams.get('companyId'));
      return NextResponse.json({ success: true, data: options });
    }

    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    const search = searchParams.get('search') || '';
    const companyId = searchParams.get('companyId');
    const regionId = searchParams.get('regionId');
    const sortBy = searchParams.get('sortBy') || 't.sort_order';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc';
    const isExport = searchParams.get('export') === 'csv';

    const filterOptions = {
      page,
      pageSize,
      search,
      companyId,
      regionId,
      sortBy,
      sortOrder,
    };

    if (isExport) {
      const csv = await HierarchyService.exportTerritoriesCsv(filterOptions, actor);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="Territories_Hierarchy_${Date.now()}.csv"`,
        },
      });
    }

    const result = await HierarchyService.getTerritoriesPaginated(filterOptions, actor);
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    const status = error instanceof AppError ? error.statusCode : 500;
    logger.error('Failed to fetch hierarchy', error, 'HierarchyController.GET');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch hierarchy' },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const body = await request.json();

    const created = await HierarchyService.createTerritory(body, actor);

    return NextResponse.json({
      success: true,
      data: created,
      message: 'Territory created successfully',
    });
  } catch (error: any) {
    const status = error instanceof AppError ? error.statusCode : 400;
    logger.warn('Failed to create territory', 'HierarchyController.POST', { error: error.message });
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create territory' },
      { status }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const body = await request.json();

    const updated = await HierarchyService.updateTerritory(body, actor);

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Territory updated successfully',
    });
  } catch (error: any) {
    const status = error instanceof AppError ? error.statusCode : 400;
    logger.warn('Failed to update territory', 'HierarchyController.PUT', { error: error.message });
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update territory' },
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

    const count = await HierarchyService.deleteTerritories(idsToDelete, actor);

    return NextResponse.json({
      success: true,
      message: `Deleted ${count} territory/territories successfully`,
    });
  } catch (error: any) {
    const status = error instanceof AppError ? error.statusCode : 400;
    logger.warn('Failed to delete territories', 'HierarchyController.DELETE', { error: error.message });
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete territories' },
      { status }
    );
  }
}
