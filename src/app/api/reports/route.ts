// Next.js Route Handler: /api/reports
// Returns executive KPIs and territory performance summaries from ReportingService

import { NextRequest, NextResponse } from 'next/server';
import { ReportingService } from '@/modules/reporting';
import { AppError } from '@/shared/errors';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || '2026', 10);
    const month = parseInt(searchParams.get('month') || '10', 10);
    const companyIdParam = searchParams.get('companyId');

    const { getAuthenticatedUser } = await import('@/shared/auth');
    let targetCompanyId = companyIdParam && companyIdParam !== 'ALL' ? companyIdParam : null;
    try {
      const actor = await getAuthenticatedUser(request);
      if (actor.role !== 'SUPER_ADMIN' && actor.companyId) {
        targetCompanyId = actor.companyId;
      }
    } catch {}

    const report = await ReportingService.getExecutiveKPIs(year, month, targetCompanyId || undefined);

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    const status = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch executive report' },
      { status }
    );
  }
}
