// Domain: Approval State Machine
// Enforces the strict approval lifecycle and immutability invariants

import { SubmissionStatus, SUBMISSION_STATUS, RoleType, ROLES } from '@/shared/constants';
import { StateTransitionError, ValidationError } from '@/shared/errors';

export type WorkflowAction = 'SUBMIT' | 'APPROVE' | 'REJECT' | 'UNLOCK' | 'SAVE_DRAFT';

export interface TransitionContext {
  currentStatus: SubmissionStatus;
  action: WorkflowAction;
  userRole: RoleType;
  reason?: string;
}

export class ApprovalStateMachine {
  /**
   * Evaluates if a state transition is legal and returns next state.
   */
  public static transition(context: TransitionContext): SubmissionStatus {
    const { currentStatus, action, userRole, reason } = context;

    switch (action) {
      case 'SAVE_DRAFT':
        if (currentStatus === SUBMISSION_STATUS.DRAFT || currentStatus === SUBMISSION_STATUS.REJECTED) {
          return SUBMISSION_STATUS.DRAFT;
        }
        throw new StateTransitionError(currentStatus, action, [ROLES.CSR, ROLES.TSO, ROLES.SUPER_ADMIN]);

      case 'SUBMIT':
        if (currentStatus === SUBMISSION_STATUS.DRAFT || currentStatus === SUBMISSION_STATUS.REJECTED) {
          return SUBMISSION_STATUS.SUBMITTED;
        }
        throw new StateTransitionError(currentStatus, action, [ROLES.CSR, ROLES.SUPER_ADMIN]);

      case 'APPROVE':
        if (currentStatus === SUBMISSION_STATUS.SUBMITTED) {
          if (userRole !== ROLES.TSO && userRole !== ROLES.SUPER_ADMIN) {
            throw new StateTransitionError(currentStatus, action, [ROLES.TSO, ROLES.SUPER_ADMIN]);
          }
          return SUBMISSION_STATUS.TSO_APPROVED;
        }

        if (currentStatus === SUBMISSION_STATUS.TSO_APPROVED) {
          if (userRole !== ROLES.RSO && userRole !== ROLES.SUPER_ADMIN) {
            throw new StateTransitionError(currentStatus, action, [ROLES.RSO, ROLES.SUPER_ADMIN]);
          }
          return SUBMISSION_STATUS.RSO_APPROVED;
        }

        if (currentStatus === SUBMISSION_STATUS.RSO_APPROVED) {
          if (userRole !== ROLES.SUPER_ADMIN) {
            throw new StateTransitionError(currentStatus, action, [ROLES.SUPER_ADMIN]);
          }
          return SUBMISSION_STATUS.FINALIZED;
        }

        throw new StateTransitionError(currentStatus, action, ['TSO', 'RSO', 'SUPER_ADMIN']);

      case 'REJECT':
        if (currentStatus === SUBMISSION_STATUS.FINALIZED) {
          throw new ValidationError('Cannot reject a FINALIZED report. Record is immutable; Super Admin must unlock first.');
        }
        if (!reason || reason.trim().length === 0) {
          throw new ValidationError('A rejection reason is mandatory when rejecting a submission.');
        }
        if (userRole !== ROLES.TSO && userRole !== ROLES.RSO && userRole !== ROLES.SUPER_ADMIN) {
          throw new StateTransitionError(currentStatus, action, [ROLES.TSO, ROLES.RSO, ROLES.SUPER_ADMIN]);
        }
        return SUBMISSION_STATUS.REJECTED;

      case 'UNLOCK':
        if (userRole !== ROLES.SUPER_ADMIN) {
          throw new StateTransitionError(currentStatus, action, [ROLES.SUPER_ADMIN]);
        }
        if (!reason || reason.trim().length === 0) {
          throw new ValidationError('A mandatory reason is required to unlock a finalized record.');
        }
        return SUBMISSION_STATUS.DRAFT;

      default:
        throw new ValidationError(`Unknown workflow action: ${action}`);
    }
  }

  /**
   * Determines if a record is immutable.
   */
  public static isImmutable(status: SubmissionStatus): boolean {
    return status === SUBMISSION_STATUS.FINALIZED;
  }
}
