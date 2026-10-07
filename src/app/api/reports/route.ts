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

    const report = await ReportingService.getExecutiveKPIs(year, month);

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
