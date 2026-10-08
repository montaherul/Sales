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

    // Company scope verification
    const { getAuthenticatedUser } = await import('@/shared/auth');
    const { dbQuery } = await import('@/lib/db');
    const actor = await getAuthenticatedUser(request);
    if (actor.role !== 'SUPER_ADMIN' && actor.companyId) {
      const terrCheck = await dbQuery(
        `SELECT d.company_id 
         FROM territories t 
         JOIN regions r ON t.region_id = r.id 
         JOIN wings w ON r.wing_id = w.id 
         JOIN divisions d ON w.division_id = d.id 
         WHERE t.id = $1 LIMIT 1`,
        [territoryId]
      );
      if (terrCheck.rows.length > 0 && terrCheck.rows[0].company_id !== actor.companyId) {
        return NextResponse.json(
          { success: false, error: 'Cannot transition submissions from another company' },
          { status: 403 }
        );
      }
    }

    const updated = await SubmissionRepository.transitionStatus({
      territoryId,
      reportDate,
      toStatus: toStatus as SubmissionStatus,
      userId: actor.id,
      comments,
      unlockReason,
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    const { logger } = await import('@/shared/logger');
    logger.error('Error transitioning workflow status', error, 'DailySubmissionsWorkflowRoute');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update workflow state' },
      { status: 500 }
    );
  }
}
