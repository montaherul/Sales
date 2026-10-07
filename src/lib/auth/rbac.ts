// RBAC and Data Scope Authorization Layer
import { RoleType, UserProfile, UserScope } from '../types';

export const ROLE_HIERARCHY: Record<RoleType, number> = {
  SUPER_ADMIN: 100,
  RSO: 50,
  TSO: 30,
  CSR: 10,
};

export type PermissionCode =
  | 'sales.create'
  | 'sales.read'
  | 'sales.update.draft'
  | 'sales.submit'
  | 'sales.approve.tso'
  | 'sales.reject.tso'
  | 'sales.approve.rso'
  | 'sales.reject.rso'
  | 'sales.finalize'
  | 'sales.unlock'
  | 'master.org.manage'
  | 'master.targets.manage'
  | 'master.prices.manage'
  | 'users.manage'
  | 'reports.export'
  | 'reports.import'
  | 'drive.upload'
  | 'audit.view';

export const ROLE_PERMISSIONS: Record<RoleType, PermissionCode[]> = {
  SUPER_ADMIN: [
    'sales.create',
    'sales.read',
    'sales.update.draft',
    'sales.submit',
    'sales.approve.tso',
    'sales.reject.tso',
    'sales.approve.rso',
    'sales.reject.rso',
    'sales.finalize',
    'sales.unlock',
    'master.org.manage',
    'master.targets.manage',
    'master.prices.manage',
    'users.manage',
    'reports.export',
    'reports.import',
    'drive.upload',
    'audit.view',
  ],
  RSO: [
    'sales.read',
    'sales.approve.rso',
    'sales.reject.rso',
    'reports.export',
  ],
  TSO: [
    'sales.create',
    'sales.read',
    'sales.update.draft',
    'sales.submit',
    'sales.approve.tso',
    'sales.reject.tso',
    'reports.export',
  ],
  CSR: [
    'sales.create',
    'sales.read',
    'sales.update.draft',
    'sales.submit',
  ],
};

/**
 * Checks whether a given role holds a specific permission code.
 */
export function hasPermission(role: RoleType, permission: PermissionCode): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

/**
 * Validates whether a user is authorized to view or mutate data for a specific territory.
 */
export function canAccessTerritory(user: UserProfile, territoryId: string, regionId?: string): boolean {
  if (user.role === 'SUPER_ADMIN') {
    return true;
  }

  if (user.role === 'RSO') {
    if (!regionId) return false;
    return user.scopes.some((scope: UserScope) => scope.regionId === regionId);
  }

  if (user.role === 'TSO' || user.role === 'CSR') {
    return user.scopes.some((scope: UserScope) => scope.territoryId === territoryId);
  }

  return false;
}

/**
 * Validates whether a user can perform Google Drive uploads (Strictly SUPER_ADMIN).
 */
export function canUploadToDrive(user: UserProfile): boolean {
  return user.role === 'SUPER_ADMIN' && hasPermission(user.role, 'drive.upload');
}
