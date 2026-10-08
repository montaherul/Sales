// Application: Menu Access Service
// Coordinates system menu permissions and user overrides
// AGENTS1.md Rule 4 & Rule 6 (Application / Service Layer)

import { menuAccessRepository, MenuAccessMatrixData } from '../infrastructure/MenuAccessRepository';
import { UserAuthContext } from '@/shared/authorization';
import { ROLES, AUDIT_ACTIONS } from '@/shared/constants';
import { ForbiddenError, ValidationError } from '@/shared/errors';
import { dbQuery } from '@/shared/database/db';
import { logger } from '@/shared/logger';

export class MenuAccessService {
  /**
   * Retrieves the full menu permissions matrix with company scoping.
   */
  public static async getMatrix(actor: UserAuthContext, reqCompanyId?: string | null): Promise<MenuAccessMatrixData> {
    let filterCompanyId: string | null = null;
    if (actor.role !== ROLES.SUPER_ADMIN) {
      filterCompanyId = actor.companyId || null;
    } else if (reqCompanyId && reqCompanyId !== 'ALL') {
      filterCompanyId = reqCompanyId;
    }

    return await menuAccessRepository.getMatrixData(filterCompanyId);
  }

  /**
   * Updates Role-Wise Menu Access (RWMA). SUPER_ADMIN only.
   */
  public static async updateRoleMenuAccess(
    actor: UserAuthContext,
    roleName: string,
    menuId: string,
    canView: boolean = true,
    canEdit: boolean = false
  ): Promise<void> {
    if (actor.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN can modify system menu access matrix');
    }

    if (!roleName || !menuId) {
      throw new ValidationError('Role name and menu ID are required');
    }

    await menuAccessRepository.updateRoleMenuAccess(roleName, menuId, canView, canEdit);

    // Audit Log
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, new_values)
         VALUES ($1, 'RWMA_UPDATE', 'role_menu_access', $2, $3)`,
        [actor.id, `${roleName}_${menuId}`, JSON.stringify({ roleName, menuId, canView, canEdit })]
      );
    } catch (auditErr) {
      logger.warn('Failed to log RWMA update', 'MenuAccessService', { auditErr });
    }
  }

  /**
   * Updates User-Wise Menu Access (UWMA). SUPER_ADMIN only.
   */
  public static async updateUserMenuAccess(
    actor: UserAuthContext,
    userId: string,
    menuId: string,
    canView: boolean = true,
    canEdit: boolean = false
  ): Promise<void> {
    if (actor.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN can modify system menu access matrix');
    }

    if (!userId || !menuId) {
      throw new ValidationError('User ID and menu ID are required');
    }

    await menuAccessRepository.updateUserMenuAccess(userId, menuId, canView, canEdit);

    // Audit Log
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, new_values)
         VALUES ($1, 'UWMA_UPDATE', 'user_menu_access', $2, $3)`,
        [actor.id, `${userId}_${menuId}`, JSON.stringify({ userId, menuId, canView, canEdit })]
      );
    } catch (auditErr) {
      logger.warn('Failed to log UWMA update', 'MenuAccessService', { auditErr });
    }
  }
}
