import { NextRequest, NextResponse } from 'next/server';
import { DailySalesService } from '@/modules/daily-sales';
import { getAuthenticatedUser } from '@/shared/auth';
import { logger } from '@/shared/logger';

export async function GET(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || (actor?.companyId && actor.role !== 'SUPER_ADMIN' ? actor.companyId : null);

    const dates = await DailySalesService.getRecordedDates(companyId);

    return NextResponse.json({
      success: true,
      data: dates,
    });
  } catch (error: any) {
    logger.error('Failed to get recorded submission dates', error, 'DailySubmissionsDatesRoute');
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
