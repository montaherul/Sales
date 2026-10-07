// Comprehensive Authorization Architecture
// Authorization = Authentication + Role + Permission + Organizational Scope + Record State

import { RoleType, ROLES, SubmissionStatus, SUBMISSION_STATUS } from '../constants';
import { ForbiddenError, StateTransitionError } from '../errors';

export type Permission =
  | 'daily_entry.create'
  | 'daily_entry.edit_draft'
  | 'daily_entry.submit'
  | 'daily_entry.approve_tso'
  | 'daily_entry.approve_rso'
  | 'daily_entry.reject'
  | 'daily_entry.unlock'
  | 'daily_entry.view'
  | 'reports.view'
  | 'reports.export'
  | 'reports.import'
  | 'drive.upload'
  | 'admin.manage_users'
  | 'admin.manage_roles'
  | 'admin.manage_hierarchy'
  | 'admin.manage_menus'
  | 'audit.view';

export interface UserAuthContext {
  id: string;
  email: string;
  role: RoleType;
  companyId?: string | null;
  companyName?: string | null;
  territoryId?: string | null;
  regionId?: string | null;
  permissions: Permission[];
}

// Default role permission mapping
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleType, Permission[]> = {
  [ROLES.SUPER_ADMIN]: [
    'daily_entry.create',
    'daily_entry.edit_draft',
    'daily_entry.submit',
    'daily_entry.approve_tso',
    'daily_entry.approve_rso',
    'daily_entry.reject',
    'daily_entry.unlock',
    'daily_entry.view',
    'reports.view',
    'reports.export',
    'reports.import',
    'drive.upload',
    'admin.manage_users',
    'admin.manage_roles',
    'admin.manage_hierarchy',
    'admin.manage_menus',
    'audit.view',
  ],
  [ROLES.RSO]: [
    'daily_entry.view',
    'daily_entry.approve_rso',
    'daily_entry.reject',
    'reports.view',
    'reports.export',
    'audit.view',
  ],
  [ROLES.TSO]: [
    'daily_entry.create',
    'daily_entry.edit_draft',
    'daily_entry.view',
    'daily_entry.approve_tso',
    'daily_entry.reject',
    'reports.view',
    'reports.export',
  ],
  [ROLES.CSR]: [
    'daily_entry.create',
    'daily_entry.edit_draft',
    'daily_entry.submit',
    'daily_entry.view',
  ],
};

/**
 * Checks if a user has a specific permission.
 */
export function hasPermission(user: UserAuthContext, permission: Permission): boolean {
  if (user.role === ROLES.SUPER_ADMIN) return true;
  return user.permissions.includes(permission) || (DEFAULT_ROLE_PERMISSIONS[user.role] || []).includes(permission);
}

/**
 * Validates organizational scope.
 * - SUPER_ADMIN: Can access all regions/territories
 * - RSO: Can access any territory within assigned region
 * - TSO: Can access only assigned territory
 * - CSR: Can access only assigned operational scope
 */
export function validateOrganizationalScope(
  user: UserAuthContext,
  targetTerritoryId: string,
  targetRegionId?: string,
  targetCompanyId?: string
): void {
  if (user.role === ROLES.SUPER_ADMIN) {
    return; // Super Admin has global scope
  }

  // Cross-company isolation
  if (user.companyId && targetCompanyId && user.companyId !== targetCompanyId) {
    throw new ForbiddenError(
      `Company scope violation: User company (${user.companyId}) does not match target company (${targetCompanyId})`
    );
  }

  if (user.role === ROLES.RSO) {
    if (user.regionId && targetRegionId && user.regionId !== targetRegionId) {
      throw new ForbiddenError(`RSO scope violation: User region (${user.regionId}) does not match target region (${targetRegionId})`);
    }
    return;
  }

  if (user.role === ROLES.TSO || user.role === ROLES.CSR) {
    if (user.territoryId && user.territoryId !== targetTerritoryId) {
      throw new ForbiddenError(
        `Territory scope violation: User is assigned to territory '${user.territoryId}', cannot access '${targetTerritoryId}'`
      );
    }
  }
}

/**
 * Validates whether the user's role can transition a record from its current state.
 */
export function validateWorkflowTransition(
  user: UserAuthContext,
  currentStatus: SubmissionStatus,
  action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'UNLOCK' | 'SAVE_DRAFT'
): SubmissionStatus {
  // SUPER_ADMIN can unlock FINALIZED records with reason
  if (action === 'UNLOCK') {
    if (user.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN is permitted to unlock finalized records');
    }
    return SUBMISSION_STATUS.DRAFT;
  }

  if (action === 'SAVE_DRAFT') {
    if (currentStatus !== SUBMISSION_STATUS.DRAFT && currentStatus !== SUBMISSION_STATUS.REJECTED) {
      throw new StateTransitionError(currentStatus, action, [ROLES.CSR, ROLES.TSO, ROLES.SUPER_ADMIN]);
    }
    return SUBMISSION_STATUS.DRAFT;
  }

  if (action === 'SUBMIT') {
    if (currentStatus !== SUBMISSION_STATUS.DRAFT && currentStatus !== SUBMISSION_STATUS.REJECTED) {
      throw new StateTransitionError(currentStatus, action, [ROLES.CSR, ROLES.SUPER_ADMIN]);
    }
    return SUBMISSION_STATUS.SUBMITTED;
  }

  if (action === 'APPROVE') {
    if (currentStatus === SUBMISSION_STATUS.SUBMITTED) {
      if (user.role !== ROLES.TSO && user.role !== ROLES.SUPER_ADMIN) {
        throw new ForbiddenError('Only TSO or SUPER_ADMIN can approve a SUBMITTED daily entry');
      }
      return SUBMISSION_STATUS.TSO_APPROVED;
    }

    if (currentStatus === SUBMISSION_STATUS.TSO_APPROVED) {
      if (user.role !== ROLES.RSO && user.role !== ROLES.SUPER_ADMIN) {
        throw new ForbiddenError('Only RSO or SUPER_ADMIN can approve a TSO_APPROVED daily entry');
      }
      return SUBMISSION_STATUS.RSO_APPROVED;
    }

    if (currentStatus === SUBMISSION_STATUS.RSO_APPROVED) {
      if (user.role !== ROLES.SUPER_ADMIN) {
        throw new ForbiddenError('Only SUPER_ADMIN can perform final report finalization');
      }
      return SUBMISSION_STATUS.FINALIZED;
    }

    throw new StateTransitionError(currentStatus, action, ['TSO', 'RSO', 'SUPER_ADMIN']);
  }

  if (action === 'REJECT') {
    if (currentStatus === SUBMISSION_STATUS.FINALIZED) {
      throw new ForbiddenError('Cannot reject a FINALIZED record. Super Admin must unlock first.');
    }
    if (user.role !== ROLES.TSO && user.role !== ROLES.RSO && user.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Insufficient role to reject submissions');
    }
    return SUBMISSION_STATUS.REJECTED;
  }

  throw new ForbiddenError(`Invalid action '${action}' for submission state '${currentStatus}'`);
}
