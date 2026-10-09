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
    const pageParam = searchParams.get('page');
    const pageSizeParam = searchParams.get('pageSize');
    const date = searchParams.get('date') || searchParams.get('reportingDate');
    const page = parseInt(pageParam || '1', 10);
    // If date is provided without explicit pagination, return all records (-1) for dynamic dashboard calculations
    const pageSize = pageSizeParam ? parseInt(pageSizeParam, 10) : (date && !pageParam ? -1 : 10);
    const search = searchParams.get('search') || '';
    const territoryId = searchParams.get('territoryId');
    const status = searchParams.get('status');
    const companyId = searchParams.get('companyId');
    const sortBy = searchParams.get('sortBy') || 's.reporting_date';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';
    const isExport = searchParams.get('export') === 'csv';

    // Direct single date/territory lookup
    if (date && territoryId && !pageParam && !pageSizeParam) {
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

    const mappedItems = (result.data || []).map((r: any) => ({
      ...r,
      id: r.id || r.submission_id,
      submissionId: r.id || r.submission_id,
      territoryId: r.territory_id || r.territoryId,
      territoryName: r.territory_name || r.territoryName,
      regionName: r.region_name || r.regionName,
      companyName: r.company_name || r.companyName,
      reportDate: r.reporting_date || r.reportDate,
      reportingDate: r.reporting_date || r.reportDate,
      dayNumber: r.day_number ?? r.dayNumber,
      status: r.status,
      isLocked: r.is_locked ?? r.isLocked ?? false,
      remarks: r.remarks || '',
      emptyPackets: parseInt(r.empty_packets ?? r.emptyPackets ?? 0, 10),
      totalCigaretteSales: parseFloat(r.total_cigarette_sales ?? r.totalCigaretteSales ?? 0),
      totalCigaretteStock: parseFloat(r.total_cigarette_stock ?? r.totalCigaretteStock ?? 0),
      totalZardaSalesValue: parseFloat(r.total_zarda_sales_value ?? r.totalZardaSalesValue ?? 0),
      totalZardaStockValue: parseFloat(r.total_zarda_stock_value ?? r.totalZardaStockValue ?? 0),
      cigaretteSales: r.cigaretteSales || {
        wilson: parseFloat(r.c_wilson_sales ?? 0),
        shahara: parseFloat(r.c_shahara_sales ?? 0),
        express: parseFloat(r.c_express_sales ?? 0),
        nexus: parseFloat(r.c_nexus_sales ?? 0),
        sb: parseFloat(r.c_sb_sales ?? 0),
        sm: parseFloat(r.c_sm_sales ?? 0),
      },
      cigaretteStock: r.cigaretteStock || {
        wilson: parseFloat(r.c_wilson_stock ?? 0),
        shahara: parseFloat(r.c_shahara_stock ?? 0),
        express: parseFloat(r.c_express_stock ?? 0),
        nexus: parseFloat(r.c_nexus_stock ?? 0),
        sb: parseFloat(r.c_sb_stock ?? 0),
        sm: parseFloat(r.c_sm_stock ?? 0),
      },
      zardaSales: r.zardaSales || {
        slb: parseFloat(r.z_slb_sales ?? 0),
        qty_22_25: parseInt(r.z_22_25_sales ?? 0, 10),
        qty_99_14: parseInt(r.z_99_14_sales ?? 0, 10),
        qty_33_15: parseInt(r.z_33_15_sales ?? 0, 10),
      },
      zardaStock: r.zardaStock || {
        slb: parseFloat(r.z_slb_stock ?? 0),
        qty_22_25: parseInt(r.z_22_25_stock ?? 0, 10),
        qty_99_14: parseInt(r.z_99_14_stock ?? 0, 10),
        qty_33_15: parseInt(r.z_33_15_stock ?? 0, 10),
      },
    }));

    return NextResponse.json({
      success: true,
      ...result,
      data: mappedItems,
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
