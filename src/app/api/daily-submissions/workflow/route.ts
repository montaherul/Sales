// Tier 2 Presentation Controller: Daily Submissions Workflow Route Handler
// Handles HTTP request/response, actor resolution, and delegates to DailySalesService
// AGENTS1.md Rule 4 & Rule 5 (Presentation Layer / Thin Controllers)

import { NextRequest, NextResponse } from 'next/server';
import { DailySalesService } from '@/modules/daily-sales';
import { getAuthenticatedUser } from '@/shared/auth';
import { logger } from '@/shared/logger';

export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const body = await request.json();
    const { territoryId, reportDate, toStatus, comments, unlockReason, isUnlock } = body;

    const updated = await DailySalesService.transitionStatus(
      {
        territoryId,
        reportDate,
        toStatus,
        comments,
        unlockReason,
        isUnlock,
      },
      actor
    );

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    logger.error('Error transitioning workflow status', error, 'DailySubmissionsWorkflowController.POST');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update workflow state' },
      { status: error.statusCode || 500 }
    );
  }
}
