// Application: Approval Use Cases
// Orchestrates state transitions, authorization, audit logs, and versioning

import { ApprovalStateMachine, WorkflowAction } from '../domain/ApprovalStateMachine';
import { SubmissionStatus, SUBMISSION_STATUS, AUDIT_ACTIONS } from '@/shared/constants';
import { UserAuthContext } from '@/shared/authorization';
import { dbQuery } from '@/shared/database/db';
import { logger } from '@/shared/logger';
import { NotFoundError } from '@/shared/errors';

export interface WorkflowTransitionDTO {
  submissionId: string;
  action: WorkflowAction;
  reason?: string;
  user: UserAuthContext;
}

export class ApprovalService {
  /**
   * Executes a workflow transition on a submission record.
   */
  public static async executeTransition(dto: WorkflowTransitionDTO): Promise<{
    id: string;
    oldStatus: SubmissionStatus;
    newStatus: SubmissionStatus;
    transitionedAt: string;
  }> {
    // 1. Fetch existing submission status
    const result = await dbQuery(
      `SELECT id, status, territory_id, reporting_date FROM daily_submissions WHERE id = $1 LIMIT 1`,
      [dto.submissionId]
    );

    let oldStatus: SubmissionStatus = SUBMISSION_STATUS.DRAFT;
    if (result.rows.length > 0) {
      oldStatus = result.rows[0].status as SubmissionStatus;
    }

    // 2. State machine evaluation
    const newStatus = ApprovalStateMachine.transition({
      currentStatus: oldStatus,
      action: dto.action,
      userRole: dto.user.role,
      reason: dto.reason,
    });

    // 3. Persist new status
    const now = new Date().toISOString();
    await dbQuery(
      `UPDATE daily_submissions SET status = $1, updated_at = NOW() WHERE id = $2`,
      [newStatus, dto.submissionId]
    );

    // 4. Record approval history log
    try {
      await dbQuery(
        `INSERT INTO approval_history (
          submission_id, action, from_status, to_status, performed_by_user_id, comments
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [dto.submissionId, dto.action, oldStatus, newStatus, dto.user.id, dto.reason || null]
      );
    } catch (err) {
      logger.warn('Could not record approval_history table entry', 'ApprovalService', { err });
    }

    // 5. Centralized Audit Log
    try {
      await dbQuery(
        `INSERT INTO audit_logs (
          user_id, event_type, entity_name, entity_id, old_values, new_values
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          dto.user.id,
          dto.action === 'APPROVE' ? AUDIT_ACTIONS.APPROVE : dto.action === 'REJECT' ? AUDIT_ACTIONS.REJECT : dto.action === 'UNLOCK' ? AUDIT_ACTIONS.UNLOCK : AUDIT_ACTIONS.SUBMIT,
          'daily_submissions',
          dto.submissionId,
          JSON.stringify({ status: oldStatus }),
          JSON.stringify({ status: newStatus, reason: dto.reason }),
        ]
      );
    } catch (auditErr) {
      logger.warn('Audit log write skipped', 'ApprovalService', { auditErr });
    }

    logger.info(
      `Workflow transition successful: ${dto.submissionId} from ${oldStatus} -> ${newStatus} (${dto.action}) by ${dto.user.email}`,
      'ApprovalService'
    );

    return {
      id: dto.submissionId,
      oldStatus,
      newStatus,
      transitionedAt: now,
    };
  }
}
