// Tier 2 Presentation Controller: Target Route Handler
// Handles HTTP request/response, actor resolution, and delegates to TargetService
// AGENTS1.md Rule 4 & Rule 5 (Presentation Layer / Thin Controllers)

import { NextRequest, NextResponse } from 'next/server';
import { TargetService } from '@/modules/target';
import { getAuthenticatedUser } from '@/shared/auth';
import { logger } from '@/shared/logger';

export async function GET(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    const search = searchParams.get('search') || '';
    const territoryId = searchParams.get('territoryId');
    const now = new Date();
    const year = parseInt(searchParams.get('year') || String(now.getFullYear()), 10);
    const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1), 10);
    const sortBy = searchParams.get('sortBy') || 'tg.target_quantity';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';
    const isExport = searchParams.get('export') === 'csv';
    const companyIdParam = searchParams.get('companyId');

    const cleanSortBy = sortBy.replace(/^tg\./, '');
    const filterTerritoryId = territoryId && territoryId !== 'ALL' ? territoryId : null;

    if (isExport) {
      const csv = await TargetService.exportTargetsCsv(
        {
          page: 1,
          pageSize: -1,
          search,
          year,
          month,
          territoryId: filterTerritoryId,
          companyIdParam,
          sortBy: cleanSortBy,
          sortOrder,
        },
        actor
      );

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="Targets_${year}_${month}_${Date.now()}.csv"`,
        },
      });
    }

    const result = await TargetService.getTargetsPaginated(
      {
        page,
        pageSize,
        search,
        year,
        month,
        territoryId: filterTerritoryId,
        companyIdParam,
        sortBy: cleanSortBy,
        sortOrder,
      },
      actor
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    logger.error('Failed to fetch targets', error, 'TargetController.GET');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch targets' },
      { status: error.statusCode || 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const body = await request.json();
    const saved = await TargetService.upsertTarget(body, actor);

    return NextResponse.json({
      success: true,
      data: saved,
      message: 'Target saved successfully',
    });
  } catch (error: any) {
    logger.error('Failed to save target', error, 'TargetController.POST');
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
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const body = await request.json().catch(() => ({}));
    const idsToDelete: string[] = body.ids || (id ? [id] : []);

    const count = await TargetService.deleteTargets(idsToDelete, actor);

    return NextResponse.json({
      success: true,
      message: `Deleted ${count} target(s) successfully`,
    });
  } catch (error: any) {
    logger.error('Failed to delete target', error, 'TargetController.DELETE');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete target' },
      { status: error.statusCode || 400 }
    );
  }
}
