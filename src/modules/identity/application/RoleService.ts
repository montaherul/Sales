// Application: Role Service
// Coordinates role administration, permissions, system role invariants, and audit logs
// AGENTS1.md Rule 4 & Rule 6 (Application / Service Layer)

import { roleRepository, RoleFilterOptions } from '../infrastructure/RoleRepository';
import { UserAuthContext } from '@/shared/authorization';
import { ROLES, AUDIT_ACTIONS } from '@/shared/constants';
import { ForbiddenError, ValidationError, NotFoundError } from '@/shared/errors';
import { PaginationHelper, PaginatedResult } from '@/shared/database/pagination';
import { dbQuery } from '@/shared/database/db';
import { logger } from '@/shared/logger';

const CORE_SYSTEM_ROLES = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'RSO', 'TSO', 'CSR'];

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

export class RoleService {
  /**
   * Retrieves paginated roles scoped to the actor's tenant context.
   */
  public static async getRolesPaginated(
    options: RoleFilterOptions,
    actor: UserAuthContext
  ): Promise<PaginatedResult<any>> {
    let filterCompanyId = options.companyId && options.companyId !== 'ALL' ? options.companyId : null;

    if (actor.role !== ROLES.SUPER_ADMIN) {
      filterCompanyId = actor.companyId || null;
    }

    return await roleRepository.getPaginatedRoles({
      ...options,
      companyId: filterCompanyId,
    });
  }

  /**
   * Exports roles as CSV.
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
      company_name: 'Assigned Company',
      user_count: 'Active Users',
      permission_count: 'Assigned Permissions',
      is_system_role: 'System Protected',
      created_at: 'Created Date',
    });
  }

  /**
   * Creates a new custom role.
   */
  public static async createRole(dto: CreateRoleDTO, actor: UserAuthContext): Promise<any> {
    if (actor.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN can create roles');
    }

    if (!dto.name || !dto.name.trim()) {
      throw new ValidationError('Role Name is required');
    }

    const formattedName = dto.name.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');

    const existing = await roleRepository.getRoleByName(formattedName);
    if (existing) {
      throw new ValidationError(`Role "${formattedName}" already exists`);
    }

    const finalCompanyId = dto.companyId && dto.companyId !== 'ALL' ? dto.companyId : null;
    const newRole = await roleRepository.createRole(formattedName, dto.description, finalCompanyId);

    // Assign permissions if provided
    if (Array.isArray(dto.permissions) && dto.permissions.length > 0) {
      for (const perm of dto.permissions) {
        await dbQuery(
          `INSERT INTO role_permissions (role_id, permission_id)
           SELECT $1, id FROM permissions WHERE name = $2
           ON CONFLICT DO NOTHING`,
          [newRole.id, perm]
        );
      }
    }

    // Audit Logging
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, new_values, company_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          actor.id,
          AUDIT_ACTIONS.CREATE,
          'roles',
          newRole.id,
          JSON.stringify({ name: formattedName, description: dto.description, companyId: finalCompanyId }),
          finalCompanyId,
        ]
      );
    } catch (auditErr) {
      logger.warn('Failed to write role creation audit log', 'RoleService', { auditErr });
    }

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
      await dbQuery('DELETE FROM role_permissions WHERE role_id = $1', [dto.id]);
      for (const perm of dto.permissions) {
        await dbQuery(
          `INSERT INTO role_permissions (role_id, permission_id)
           SELECT $1, id FROM permissions WHERE name = $2
           ON CONFLICT DO NOTHING`,
          [dto.id, perm]
        );
      }
    }

    // Audit Logging
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, new_values, company_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          actor.id,
          AUDIT_ACTIONS.UPDATE,
          'roles',
          dto.id,
          JSON.stringify({ description: dto.description, companyId: finalCompanyId }),
          finalCompanyId,
        ]
      );
    } catch (auditErr) {
      logger.warn('Failed to write role update audit log', 'RoleService', { auditErr });
    }

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
    const rolesRes = await dbQuery('SELECT id, name, is_system_role FROM roles WHERE id = ANY($1::uuid[])', [ids]);
    const systemProtected = rolesRes.rows.filter(
      (r: any) => r.is_system_role || CORE_SYSTEM_ROLES.includes(r.name)
    );

    if (systemProtected.length > 0) {
      throw new ForbiddenError(
        `Cannot delete system roles: ${systemProtected.map((r: any) => r.name).join(', ')}`
      );
    }

    await roleRepository.deleteRoles(ids);

    // Audit Logging
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, old_values)
         VALUES ($1, $2, $3, $4, $5)`,
        [actor.id, AUDIT_ACTIONS.DELETE, 'roles', ids.join(','), JSON.stringify({ deletedIds: ids })]
      );
    } catch (auditErr) {
      logger.warn('Failed to write role delete audit log', 'RoleService', { auditErr });
    }

    return ids.length;
  }
}
