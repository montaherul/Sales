// Application: Menu Access Service
// Coordinates system menu permissions and user overrides
// AGENTS1.md Rule 4 & Rule 6 (Application / Service Layer)

import { menuAccessRepository, MenuAccessMatrixData } from '../infrastructure/MenuAccessRepository';
import { UserAuthContext } from '@/shared/authorization';
import { ROLES } from '@/shared/constants';
import { ForbiddenError, ValidationError } from '@/shared/errors';
import { AuditService } from '@/modules/audit';

export class MenuAccessService {
  /**
   * Retrieves the full menu permissions matrix with company scoping.
   */
  public static async getMatrix(actor: UserAuthContext, reqCompanyId?: string | null): Promise<MenuAccessMatrixData> {
    if (actor.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN can view menu access configuration');
    }

    const filterCompanyId = reqCompanyId && reqCompanyId !== 'ALL' ? reqCompanyId : null;
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

    // Centralized Audit Log
    await AuditService.logEvent({
      userId: actor.id,
      eventType: 'RWMA_UPDATE',
      entityName: 'role_menu_access',
      entityId: `${roleName}_${menuId}`,
      newValues: { roleName, menuId, canView, canEdit },
    });
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

    // Centralized Audit Log
    await AuditService.logEvent({
      userId: actor.id,
      eventType: 'UWMA_UPDATE',
      entityName: 'user_menu_access',
      entityId: `${userId}_${menuId}`,
      newValues: { userId, menuId, canView, canEdit },
    });
  }
}
