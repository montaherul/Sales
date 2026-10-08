// Tier 2 Presentation Controller: Audit Logs Route Handler
// Handles HTTP request/response, actor resolution, and delegates to AuditService
// AGENTS1.md Rule 4 & Rule 5 (Presentation Layer / Thin Controllers)

import { NextRequest, NextResponse } from 'next/server';
import { AuditService } from '@/modules/audit';
import { getAuthenticatedUser } from '@/shared/auth';
import { logger } from '@/shared/logger';

export async function GET(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    const search = searchParams.get('search') || '';
    const eventType = searchParams.get('eventType');
    const entityName = searchParams.get('entityName');
    const sortBy = searchParams.get('sortBy') || 'a.created_at';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';
    const isExport = searchParams.get('export') === 'csv';
    const companyIdParam = searchParams.get('companyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const cleanSortBy = sortBy.replace(/^a\./, '');
    const filterEventType = eventType && eventType !== 'ALL' ? eventType : null;
    const filterEntityName = entityName && entityName !== 'ALL' ? entityName : null;

    if (isExport) {
      const csv = await AuditService.exportAuditLogsCsv(
        {
          page: 1,
          pageSize: -1,
          search,
          eventType: filterEventType,
          entityName: filterEntityName,
          companyIdParam,
          startDate,
          endDate,
          sortBy: cleanSortBy,
          sortOrder,
        },
        actor
      );

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="Audit_Trail_${Date.now()}.csv"`,
        },
      });
    }

    const result = await AuditService.getAuditLogsPaginated(
      {
        page,
        pageSize,
        search,
        eventType: filterEventType,
        entityName: filterEntityName,
        companyIdParam,
        startDate,
        endDate,
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
    logger.error('Failed to fetch audit logs', error, 'AuditController.GET');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch audit logs' },
      { status: error.statusCode || 500 }
    );
  }
}
