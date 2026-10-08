// Application: Approval Use Cases
// Orchestrates state transitions, authorization, audit logs, and versioning

import { ApprovalStateMachine, WorkflowAction } from '../domain/ApprovalStateMachine';
import { SubmissionStatus, SUBMISSION_STATUS, AUDIT_ACTIONS } from '@/shared/constants';
import { UserAuthContext, validateOrganizationalScope } from '@/shared/authorization';
import { dbQuery } from '@/shared/database/db';
import { logger } from '@/shared/logger';
import { NotFoundError } from '@/shared/errors';
import { AuditService } from '@/modules/audit';

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
    // 1. Fetch existing submission status with hierarchy scoping info
    const result = await dbQuery(
      `SELECT ds.id, ds.status, ds.territory_id, t.region_id, r.company_id 
       FROM daily_submissions ds
       LEFT JOIN territories t ON ds.territory_id = t.id
       LEFT JOIN regions r ON t.region_id = r.id
       WHERE ds.id = $1 LIMIT 1`,
      [dto.submissionId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError(`Submission with ID '${dto.submissionId}' was not found`);
    }

    const row = result.rows[0];
    const oldStatus: SubmissionStatus = row.status as SubmissionStatus;

    // 2. Enforce server-side organizational and tenant scope
    validateOrganizationalScope(dto.user, row.territory_id, row.region_id, row.company_id);

    // 3. State machine evaluation
    const newStatus = ApprovalStateMachine.transition({
      currentStatus: oldStatus,
      action: dto.action,
      userRole: dto.user.role,
      reason: dto.reason,
    });

    // 4. Persist new status and lifecycle flags
    const now = new Date().toISOString();
    await dbQuery(
      `UPDATE daily_submissions 
       SET status = $1, 
           finalized_at = CASE WHEN $1 = 'FINALIZED' THEN NOW() ELSE finalized_at END,
           is_locked = CASE WHEN $1 = 'FINALIZED' THEN TRUE WHEN $1 = 'DRAFT' THEN FALSE ELSE is_locked END,
           unlock_reason = CASE WHEN $2 = 'UNLOCK' THEN $3 ELSE unlock_reason END,
           updated_at = NOW() 
       WHERE id = $4`,
      [newStatus, dto.action, dto.reason || null, dto.submissionId]
    );

    // 5. Record approval history log with correct schema columns
    try {
      await dbQuery(
        `INSERT INTO approval_history (
          submission_id, from_status, to_status, action_by, comments
        ) VALUES ($1, $2, $3, $4, $5)`,
        [dto.submissionId, oldStatus, newStatus, dto.user.id, dto.reason || null]
      );
    } catch (err) {
      logger.warn('Could not record approval_history table entry', 'ApprovalService', { err });
    }

    // 6. Centralized Audit Log with company_id
    await AuditService.logEvent({
      userId: dto.user.id,
      companyId: row.company_id || dto.user.companyId || null,
      eventType: dto.action === 'APPROVE' ? AUDIT_ACTIONS.APPROVE : dto.action === 'REJECT' ? AUDIT_ACTIONS.REJECT : dto.action === 'UNLOCK' ? AUDIT_ACTIONS.UNLOCK : AUDIT_ACTIONS.SUBMIT,
      entityName: 'daily_submissions',
      entityId: dto.submissionId,
      oldValues: { status: oldStatus },
      newValues: { status: newStatus, reason: dto.reason },
    });

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
