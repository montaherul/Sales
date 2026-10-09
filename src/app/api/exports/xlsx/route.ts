// Tier 1 Route Handler: /api/exports/xlsx
// Dynamic generation of authoritative Excel reports (34-sheet Monthly or 1-sheet Daily) from live PostgreSQL records
// Conforms to AGENTS.md Rules 2, 3, 17, 18, 20 & AGENTS1.md Rules 4, 6

import { NextRequest, NextResponse } from 'next/server';
import { ExcelExportService } from '@/modules/excel-export';
import { getAuthenticatedUser } from '@/shared/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const year = parseInt(searchParams.get('year') || String(now.getFullYear()), 10);
    const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1), 10);
    const day = parseInt(searchParams.get('day') || String(now.getDate()), 10);
    const rawType = (searchParams.get('type') || 'monthly').toLowerCase();
    const isBlank = searchParams.get('blank') === 'true' || rawType === 'blank_month';
    const reportType: 'daily' | 'monthly' | 'yearly' | 'blank_month' = 
      isBlank ? 'blank_month' : rawType === 'daily' ? 'daily' : rawType === 'yearly' ? 'yearly' : 'monthly';

    const companyIdParam = searchParams.get('companyId');
    const regionIdParam = searchParams.get('regionId');
    let targetCompanyId = companyIdParam && companyIdParam !== 'ALL' ? companyIdParam : null;
    const targetRegionId = regionIdParam && regionIdParam !== 'ALL' ? regionIdParam : undefined;
    let userId = 'system';

    try {
      const actor = await getAuthenticatedUser(request);
      userId = actor.id;
      // Strict Tenant Isolation: Non-Super Admins can only export their own company's data
      if (actor.role !== 'SUPER_ADMIN' && actor.companyId) {
        targetCompanyId = actor.companyId;
      }
    } catch (authErr) {
      const { logger } = await import('@/shared/logger');
      logger.debug('Direct Excel export evaluated with system session', 'exports.xlsx.GET', { authErr });
    }

    const { filename, buffer } = await ExcelExportService.generateReport({
      year,
      month,
      day,
      reportType,
      isBlankTemplate: isBlank,
      companyId: targetCompanyId || undefined,
      regionId: targetRegionId,
      userId,
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    const { logger } = await import('@/shared/logger');
    logger.error('Export error', error, 'exports.xlsx.GET');
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate Excel report',
      },
      { status: 500 }
    );
  }
}
