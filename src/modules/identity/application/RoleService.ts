// Application: Role Service
// Coordinates role definition, permission matrix assignments, and system-role protections
// AGENTS1.md Rule 4 & Rule 6 (Application / Service Layer)

import { roleRepository, RoleFilterOptions } from '../infrastructure/RoleRepository';
import { UserAuthContext } from '@/shared/authorization';
import { ROLES, AUDIT_ACTIONS } from '@/shared/constants';
import { ForbiddenError, ValidationError, NotFoundError } from '@/shared/errors';
import { PaginationHelper, PaginatedResult } from '@/shared/database/pagination';
import { AuditService } from '@/modules/audit';

export interface CreateRoleDTO {
  name: string;
  description?: string;
  companyId?: string | null;
  permissions?: string[];
}

export interface UpdateRoleDTO {
  id: string;
  description?: string;
  companyId?: string | null;
  permissions?: string[];
}

const CORE_SYSTEM_ROLES = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'RSO', 'TSO', 'CSR'];

export class RoleService {
  /**
   * Retrieves paginated roles with optional company filter.
   */
  public static async getRolesPaginated(
    options: RoleFilterOptions,
    actor: UserAuthContext
  ): Promise<PaginatedResult<any>> {
    const targetCompanyId = actor.role === ROLES.SUPER_ADMIN
      ? (options.companyId && options.companyId !== 'ALL' ? options.companyId : null)
      : (actor.companyId || null);

    return await roleRepository.getPaginatedRoles({
      page: options.page,
      pageSize: options.pageSize,
      search: options.search,
      companyId: targetCompanyId,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
    });
  }

  /**
   * Generates CSV export for roles.
   */
  public static async exportRolesCsv(
    options: RoleFilterOptions,
    actor: UserAuthContext
  ): Promise<string> {
    const result = await this.getRolesPaginated({ ...options, pageSize: -1 }, actor);
    return PaginationHelper.toCsv(result.data, {
      id: 'Role ID',
      name: 'Role Name',
      description: 'Description',
      company_name: 'Company',
      user_count: 'Assigned Users',
      permission_count: 'Active Permissions',
      is_system_role: 'System Protected',
      created_at: 'Created Date',
    });
  }

  /**
   * Creates a new custom role with permissions.
   */
  public static async createRole(dto: CreateRoleDTO, actor: UserAuthContext): Promise<any> {
    if (actor.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN can create roles');
    }

    if (!dto.name || !dto.name.trim()) throw new ValidationError('Role name is required');

    const formattedName = dto.name.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');

    if (CORE_SYSTEM_ROLES.includes(formattedName)) {
      throw new ValidationError(`"${formattedName}" is a reserved system role name`);
    }

    const existing = await roleRepository.getRoleByName(formattedName);
    if (existing) {
      throw new ValidationError(`Role "${formattedName}" already exists`);
    }

    const finalCompanyId = dto.companyId && dto.companyId !== 'ALL' ? dto.companyId : null;
    const newRole = await roleRepository.createRole(formattedName, dto.description, finalCompanyId);

    // Assign permissions
    if (Array.isArray(dto.permissions) && dto.permissions.length > 0) {
      await roleRepository.assignPermissionsToRole(newRole.id, dto.permissions);
    }

    // Centralized Audit Log
    await AuditService.logEvent({
      userId: actor.id,
      companyId: finalCompanyId,
      eventType: AUDIT_ACTIONS.CREATE,
      entityName: 'roles',
      entityId: newRole.id,
      newValues: { name: formattedName, description: dto.description, companyId: finalCompanyId },
    });

    return newRole;
  }

  /**
   * Updates an existing custom role.
   */
  public static async updateRole(dto: UpdateRoleDTO, actor: UserAuthContext): Promise<any> {
    if (actor.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN can modify roles');
    }

    const existing = await roleRepository.getRoleById(dto.id);
    if (!existing) {
      throw new NotFoundError('Role not found');
    }

    if (existing.is_system_role || CORE_SYSTEM_ROLES.includes(existing.name)) {
      throw new ForbiddenError(`System role "${existing.name}" is protected and cannot be modified`);
    }

    const finalCompanyId = dto.companyId && dto.companyId !== 'ALL' ? dto.companyId : null;
    const updated = await roleRepository.updateRole(dto.id, dto.description, finalCompanyId);

    if (Array.isArray(dto.permissions)) {
      await roleRepository.assignPermissionsToRole(dto.id, dto.permissions);
    }

    // Centralized Audit Log
    await AuditService.logEvent({
      userId: actor.id,
      companyId: finalCompanyId,
      eventType: AUDIT_ACTIONS.UPDATE,
      entityName: 'roles',
      entityId: dto.id,
      newValues: { description: dto.description, companyId: finalCompanyId },
    });

    return updated;
  }

  /**
   * Deletes custom roles.
   */
  public static async deleteRoles(ids: string[], actor: UserAuthContext): Promise<number> {
    if (actor.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN can delete roles');
    }

    if (ids.length === 0) {
      throw new ValidationError('At least one Role ID is required');
    }

    // Check system roles
    const roles = await roleRepository.getRolesByIds(ids);
    const systemProtected = roles.filter(
      (r: any) => r.is_system_role || CORE_SYSTEM_ROLES.includes(r.name)
    );

    if (systemProtected.length > 0) {
      throw new ForbiddenError(
        `Cannot delete system roles: ${systemProtected.map((r: any) => r.name).join(', ')}`
      );
    }

    await roleRepository.deleteRoles(ids);

    // Centralized Audit Log
    await AuditService.logEvent({
      userId: actor.id,
      eventType: AUDIT_ACTIONS.DELETE,
      entityName: 'roles',
      entityId: ids.join(','),
      oldValues: { deletedIds: ids },
    });

    return ids.length;
  }
}
