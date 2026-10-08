// Tier 1 Route Handler: /api/exports/xlsx
// Dynamic generation of authoritative 34-sheet Excel report from live PostgreSQL records

import { NextRequest, NextResponse } from 'next/server';
import { ExcelExportService } from '@/modules/excel-export';
import { getAuthenticatedUser } from '@/shared/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || '2026', 10);
    const month = parseInt(searchParams.get('month') || '10', 10);
    const day = parseInt(searchParams.get('day') || '6', 10);

    const companyIdParam = searchParams.get('companyId');
    let targetCompanyId = companyIdParam && companyIdParam !== 'ALL' ? companyIdParam : null;
    let userId = 'system';

    try {
      const actor = await getAuthenticatedUser(request);
      userId = actor.id;
      if (actor.role !== 'SUPER_ADMIN' && actor.companyId) {
        targetCompanyId = actor.companyId;
      }
    } catch (authErr) {
      const { logger } = await import('@/shared/logger');
      logger.debug('Direct Excel export evaluated with system session', 'exports.xlsx.GET', { authErr });
    }

    const { filename, buffer } = await ExcelExportService.generateMonthlyReport(
      year,
      month,
      day,
      userId,
      targetCompanyId || undefined
    );

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    console.error('Export error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate 34-sheet Excel report',
      },
      { status: 500 }
    );
  }
}
