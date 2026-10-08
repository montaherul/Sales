// Tier 2: Audit Logs Controller & Route Handler
// Full Server-Side Pagination, Filtering, Search, Sorting & CSV Export

import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/shared/database/db';
import { PaginationHelper } from '@/shared/database/pagination';
import { logger } from '@/shared/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    const search = searchParams.get('search') || '';
    const eventType = searchParams.get('eventType');
    const entityName = searchParams.get('entityName');
    const sortBy = searchParams.get('sortBy') || 'a.created_at';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';
    const isExport = searchParams.get('export') === 'csv';

    const cleanSortBy = sortBy.replace(/^a\./, '');
    const actualPageSize = isExport ? -1 : pageSize;
    const filterEventType = eventType && eventType !== 'ALL' ? eventType : null;

    const companyIdParam = searchParams.get('companyId');
    const { getAuthenticatedUser } = await import('@/shared/auth');
    const { ForbiddenError } = await import('@/shared/errors');
    const { ROLES } = await import('@/shared/constants');

    const actor = await getAuthenticatedUser(request);
    if (actor.role !== ROLES.SUPER_ADMIN && actor.role !== ROLES.COMPANY_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN or COMPANY_ADMIN can view audit logs');
    }

    let targetCompanyId = actor.role === ROLES.SUPER_ADMIN
      ? (companyIdParam && companyIdParam !== 'ALL' ? companyIdParam : null)
      : actor.companyId;

    // PostgreSQL Stored Procedure: sp_get_audit_logs_paginated
    const result = await PaginationHelper.executeFunction(
      'sp_get_audit_logs_paginated',
      [page, actualPageSize, search || null, filterEventType, null, targetCompanyId, null, null, cleanSortBy, sortOrder]
    );

    // Handle CSV Export
    if (isExport) {
      const csv = PaginationHelper.toCsv(result.data, {
        id: 'Log ID',
        created_at: 'Timestamp',
        event_type: 'Event Type',
        entity_name: 'Target Entity',
        entity_id: 'Record ID',
        user_email: 'Actor Email',
        ip_address: 'IP Address',
      });

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="Audit_Trail_${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    logger.error('Failed to fetch audit logs', error, 'AuditController');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
