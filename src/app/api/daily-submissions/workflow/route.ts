import { NextRequest, NextResponse } from 'next/server';
import { SubmissionRepository } from '@/lib/repositories/submission.repository';
import { SubmissionStatus } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { territoryId, reportDate, toStatus, userId, comments, unlockReason } = body;

    if (!territoryId || !reportDate || !toStatus) {
      return NextResponse.json(
        { success: false, error: 'territoryId, reportDate, and toStatus are required' },
        { status: 400 }
      );
    }

    // Enforce business rule: Unlock requires a mandatory reason
    if (toStatus !== 'FINALIZED' && body.isUnlock && !unlockReason?.trim()) {
      return NextResponse.json(
        { success: false, error: 'A non-empty unlockReason is mandatory when unlocking finalized records' },
        { status: 400 }
      );
    }

    const updated = await SubmissionRepository.transitionStatus({
      territoryId,
      reportDate,
      toStatus: toStatus as SubmissionStatus,
      userId: userId || 'current-user-id',
      comments,
      unlockReason,
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error transitioning workflow status:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update workflow state' },
      { status: 500 }
    );
  }
}
