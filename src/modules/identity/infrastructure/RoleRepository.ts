// Infrastructure: Role Repository
// Data-Access layer handling PostgreSQL queries and stored procedures for roles
// AGENTS1.md Rule 4 & Rule 8 (Data Access Layer)

import { dbQuery } from '@/shared/database/db';
import { PaginationHelper, PaginatedResult } from '@/shared/database/pagination';

export interface RoleFilterOptions {
  page: number;
  pageSize: number;
  search?: string;
  companyId?: string | null;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class RoleRepository {
  /**
   * Queries paginated roles using stored procedure sp_get_roles_paginated.
   */
  public async getPaginatedRoles(options: RoleFilterOptions): Promise<PaginatedResult<any>> {
    return await PaginationHelper.executeFunction(
      'sp_get_roles_paginated',
      [
        options.page,
        options.pageSize,
        options.search || null,
        options.companyId || null,
        options.sortBy || 'name',
        (options.sortOrder || 'asc').toUpperCase(),
      ]
    );
  }

  /**
   * Retrieves role by name.
   */
  public async getRoleByName(name: string): Promise<any | null> {
    const res = await dbQuery('SELECT id, name, description, company_id, is_system_role FROM roles WHERE name = $1 LIMIT 1', [name]);
    return res.rows[0] || null;
  }

  /**
   * Retrieves role by ID.
   */
  public async getRoleById(id: string): Promise<any | null> {
    const res = await dbQuery('SELECT id, name, description, company_id, is_system_role FROM roles WHERE id = $1 LIMIT 1', [id]);
    return res.rows[0] || null;
  }

  /**
   * Retrieves roles by array of IDs.
   */
  public async getRolesByIds(ids: string[]): Promise<Array<{ id: string; name: string; is_system_role: boolean }>> {
    const res = await dbQuery('SELECT id, name, is_system_role FROM roles WHERE id = ANY($1::uuid[])', [ids]);
    return res.rows;
  }

  /**
   * Inserts a new role.
   */
  public async createRole(name: string, description?: string, companyId?: string | null): Promise<any> {
    const res = await dbQuery(
      `INSERT INTO roles (name, description, company_id, is_system_role)
       VALUES ($1, $2, $3, FALSE)
       RETURNING id, name, description, company_id, is_system_role`,
      [name, description || null, companyId || null]
    );
    return res.rows[0];
  }

  /**
   * Updates an existing custom role.
   */
  public async updateRole(id: string, description?: string, companyId?: string | null): Promise<any> {
    const res = await dbQuery(
      `UPDATE roles
       SET description = COALESCE($2, description),
           company_id = $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, description, company_id`,
      [id, description || null, companyId || null]
    );
    return res.rows[0];
  }

  /**
   * Assigns permission keys to a role.
   */
  public async assignPermissionsToRole(roleId: string, permissions: string[]): Promise<void> {
    await dbQuery('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
    for (const perm of permissions) {
      await dbQuery(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT $1, id FROM permissions WHERE name = $2
         ON CONFLICT DO NOTHING`,
        [roleId, perm]
      );
    }
  }

  /**
   * Deletes roles by ID array.
   */
  public async deleteRoles(ids: string[]): Promise<void> {
    await dbQuery(`DELETE FROM roles WHERE id = ANY($1::uuid[]) AND is_system_role = FALSE`, [ids]);
  }
}

export const roleRepository = new RoleRepository();
