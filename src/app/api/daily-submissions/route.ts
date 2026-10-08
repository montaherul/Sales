// Tier 2 Presentation Controller: Daily Submissions Route Handler
// Handles HTTP request/response, actor resolution, and delegates to DailySalesService
// AGENTS1.md Rule 4 & Rule 5 (Presentation Layer / Thin Controllers)

import { NextRequest, NextResponse } from 'next/server';
import { DailySalesService } from '@/modules/daily-sales';
import { getAuthenticatedUser } from '@/shared/auth';
import { logger } from '@/shared/logger';

export async function GET(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    const search = searchParams.get('search') || '';
    const date = searchParams.get('date') || searchParams.get('reportingDate');
    const territoryId = searchParams.get('territoryId');
    const status = searchParams.get('status');
    const companyId = searchParams.get('companyId');
    const sortBy = searchParams.get('sortBy') || 's.reporting_date';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';
    const isExport = searchParams.get('export') === 'csv';

    // Direct single date/territory lookup
    if (date && territoryId && !searchParams.get('page') && !searchParams.get('pageSize')) {
      const records = await DailySalesService.getSubmissionsByDateAndTerritory(date, territoryId);
      return NextResponse.json({ success: true, data: records });
    }

    const cleanSortBy = sortBy.replace(/^s\./, '');
    const filterStatus = status && status !== 'ALL' ? status : null;

    if (isExport) {
      const csv = await DailySalesService.exportSubmissionsCsv(
        {
          page: 1,
          pageSize: -1,
          search,
          date,
          territoryId,
          status: filterStatus,
          companyIdParam: companyId,
          sortBy: cleanSortBy,
          sortOrder,
        },
        actor
      );

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="Daily_Submissions_${Date.now()}.csv"`,
        },
      });
    }

    const result = await DailySalesService.getSubmissionsPaginated(
      {
        page,
        pageSize,
        search,
        date,
        territoryId,
        status: filterStatus,
        companyIdParam: companyId,
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
    logger.error('Failed to query daily submissions', error, 'DailySubmissionsController.GET');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch submissions' },
      { status: error.statusCode || 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const body = await request.json();
    const saved = await DailySalesService.saveOperationalSubmission(body.record, actor, body.changeReason);

    return NextResponse.json({
      success: true,
      data: saved,
    });
  } catch (error: any) {
    logger.error('Error saving submission', error, 'DailySubmissionsController.POST');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save submission' },
      { status: error.statusCode || 500 }
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

    const count = await DailySalesService.deleteSubmissions(idsToDelete, actor);

    return NextResponse.json({
      success: true,
      message: `Deleted ${count} submission(s) successfully`,
    });
  } catch (error: any) {
    logger.error('Failed to delete submission', error, 'DailySubmissionsController.DELETE');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete submission' },
      { status: error.statusCode || 400 }
    );
  }
}
