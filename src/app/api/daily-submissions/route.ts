// Tier 2: Daily Submissions Controller & Route Handler
// Full Server-Side Pagination, Filtering, Search, Sorting, CSV Export & CRUD

import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/shared/database/db';
import { PaginationHelper } from '@/shared/database/pagination';
import { SubmissionRepository } from '@/lib/repositories/submission.repository';
import { DailyOperationalRecord } from '@/lib/types';
import { getAuthenticatedUser } from '@/shared/auth';
import { AUDIT_ACTIONS } from '@/shared/constants';
import { ValidationError } from '@/shared/errors';
import { logger } from '@/shared/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    const search = searchParams.get('search') || '';
    const date = searchParams.get('date');
    const territoryId = searchParams.get('territoryId');
    const status = searchParams.get('status');
    const companyId = searchParams.get('companyId');
    const sortBy = searchParams.get('sortBy') || 's.reporting_date';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';
    const isExport = searchParams.get('export') === 'csv';

    // If simple query for specific date and territory without pagination params
    if (date && territoryId && !searchParams.get('page') && !searchParams.get('pageSize')) {
      const records = await SubmissionRepository.getSubmissions({ date, territoryId });
      return NextResponse.json({ success: true, data: records });
    }

    const cleanSortBy = sortBy.replace(/^s\./, '');
    const actualPageSize = isExport ? -1 : pageSize;
    const filterTerritoryId = territoryId && territoryId !== 'ALL' ? territoryId : null;
    const filterStatus = status && status !== 'ALL' ? status : null;
    const filterCompanyId = companyId && companyId !== 'ALL' ? companyId : null;
    const filterDate = date || null;

    // PostgreSQL Stored Procedure: sp_get_daily_submissions_paginated
    const result = await PaginationHelper.executeFunction(
      'sp_get_daily_submissions_paginated',
      [page, actualPageSize, search || null, filterDate, filterTerritoryId, filterStatus, filterCompanyId, cleanSortBy, sortOrder]
    );

    // Handle CSV Export
    if (isExport) {
      const csv = PaginationHelper.toCsv(result.data, {
        id: 'Submission ID',
        reporting_date: 'Reporting Date',
        territory_name: 'Territory',
        region_name: 'Region',
        status: 'Status',
        total_cigarette_sales: 'Cigarette Sales (Mio)',
        total_cigarette_stock: 'Closing Stock (Mio)',
        total_zarda_sales_value: 'Zarda Sales (BDT)',
        empty_packets: 'Empty Packets',
        remarks: 'Remarks',
      });

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="Daily_Submissions_${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    logger.error('Failed to query daily submissions', error, 'DailySubmissionsController');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch submissions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const record: DailyOperationalRecord = body.record;
    const userId = body.userId || 'current-user-id';
    const changeReason = body.changeReason;

    if (!record || !record.territoryId || !record.reportDate) {
      return NextResponse.json(
        { success: false, error: 'territoryId and reportDate are required' },
        { status: 400 }
      );
    }

    const saved = await SubmissionRepository.saveSubmission(record, userId, changeReason);

    return NextResponse.json({
      success: true,
      data: saved,
    });
  } catch (error: any) {
    console.error('Error saving submission:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save submission' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const body = await request.json().catch(() => ({}));
    const idsToDelete: string[] = body.ids || (id ? [id] : []);

    if (idsToDelete.length === 0) {
      throw new ValidationError('At least one Submission ID is required for deletion');
    }

    await dbQuery(`DELETE FROM daily_submissions WHERE id = ANY($1::uuid[])`, [idsToDelete]);

    // Audit log
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, old_values)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, AUDIT_ACTIONS.UPDATE, 'daily_submissions', idsToDelete.join(','), JSON.stringify({ deletedIds: idsToDelete })]
      );
    } catch {}

    return NextResponse.json({
      success: true,
      message: `Deleted ${idsToDelete.length} submission(s) successfully`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete submission' },
      { status: error.statusCode || 400 }
    );
  }
}
