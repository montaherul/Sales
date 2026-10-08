// Infrastructure: User Repository
// Data-Access layer handling PostgreSQL queries, stored procedures, and scope persistence
// AGENTS1.md Rule 4 & Rule 8 (Data Access Layer)

import { dbQuery } from '@/shared/database/db';
import { PaginationHelper, PaginatedResult } from '@/shared/database/pagination';
import { UserEntity } from '../domain/types';

export interface UserFilterOptions {
  page: number;
  pageSize: number;
  search?: string;
  companyId?: string | null;
  roleName?: string | null;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateUserData {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string | null;
  roleId: string;
  roleName: string;
  companyId?: string | null;
  territoryId?: string | null;
  regionId?: string | null;
}

export interface UpdateUserData {
  id: string;
  fullName?: string;
  phone?: string | null;
  isActive?: boolean;
  roleId?: string;
  roleName?: string;
  companyId?: string | null;
  territoryId?: string | null;
  regionId?: string | null;
  newPasswordHash?: string;
}

export class UserRepository {
  /**
   * Queries paginated users through authoritative stored procedure.
   */
  public async getPaginatedUsers(options: UserFilterOptions): Promise<PaginatedResult<any>> {
    const cleanSortBy = (options.sortBy || 'created_at').replace(/^u\./, '');
    return await PaginationHelper.executeFunction(
      'sp_get_users_paginated',
      [
        options.page,
        options.pageSize,
        options.search || null,
        options.companyId || null,
        options.roleName || null,
        cleanSortBy,
        options.sortOrder || 'asc',
      ]
    );
  }

  /**
   * Retrieves user by unique ID.
   */
  public async getUserById(id: string): Promise<any | null> {
    const res = await dbQuery(
      `SELECT u.id, u.email, u.full_name, u.phone, r.name as role, u.is_active, s.company_id,
              c.name as company_name, r.name as role_name,
              s.territory_id, s.region_id, t.name as territory_name, reg.name as region_name
       FROM user_profiles u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN user_scopes s ON u.id = s.user_id
       LEFT JOIN companies c ON s.company_id = c.id
       LEFT JOIN territories t ON s.territory_id = t.id
       LEFT JOIN regions reg ON s.region_id = reg.id
       WHERE u.id = $1 LIMIT 1`,
      [id]
    );
    return res.rows[0] || null;
  }

  /**
   * Finds user by email.
   */
  public async getUserByEmail(email: string): Promise<any | null> {
    const res = await dbQuery(
      `SELECT u.id, u.email, u.full_name, u.role_id, s.company_id 
       FROM user_profiles u 
       LEFT JOIN user_scopes s ON u.id = s.user_id
       WHERE u.email = $1 LIMIT 1`,
      [email.toLowerCase().trim()]
    );
    return res.rows[0] || null;
  }

  /**
   * Resolves role record by role name.
   */
  public async getRoleByName(roleName: string): Promise<{ id: string; name: string } | null> {
    const res = await dbQuery(`SELECT id, name FROM roles WHERE name = $1 LIMIT 1`, [roleName]);
    return res.rows[0] || null;
  }

  /**
   * Resolves region and company IDs from territory ID.
   */
  public async resolveHierarchyFromTerritory(territoryId: string): Promise<{ regionId: string; companyId: string } | null> {
    const res = await dbQuery(
      `SELECT t.region_id, r.company_id 
       FROM territories t
       JOIN regions r ON t.region_id = r.id
       WHERE t.id = $1 LIMIT 1`,
      [territoryId]
    );
    if (res.rows.length === 0) return null;
    return {
      regionId: res.rows[0].region_id,
      companyId: res.rows[0].company_id,
    };
  }

  /**
   * Resolves company ID from region ID.
   */
  public async resolveCompanyFromRegion(regionId: string): Promise<string | null> {
    const res = await dbQuery(`SELECT company_id FROM regions WHERE id = $1 LIMIT 1`, [regionId]);
    return res.rows[0]?.company_id || null;
  }

  /**
   * Persists new user and scope assignment in PostgreSQL.
   */
  public async createUser(data: CreateUserData): Promise<string> {
    // 1. Insert user_profile
    await dbQuery(
      `INSERT INTO user_profiles (
        id, email, password_hash, full_name, phone, role_id, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
      [
        data.id,
        data.email.toLowerCase().trim(),
        data.passwordHash,
        data.fullName.trim(),
        data.phone || null,
        data.roleId,
      ]
    );

    // 2. Insert user_scope
    if (data.territoryId || data.regionId || data.companyId) {
      await dbQuery(
        `INSERT INTO user_scopes (user_id, territory_id, region_id, company_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO UPDATE
         SET territory_id = EXCLUDED.territory_id,
             region_id = EXCLUDED.region_id,
             company_id = EXCLUDED.company_id`,
        [data.id, data.territoryId || null, data.regionId || null, data.companyId || null]
      );
    }

    return data.id;
  }

  /**
   * Updates an existing user and their scopes.
   */
  public async updateUser(data: UpdateUserData): Promise<void> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [data.id];

    if (data.fullName !== undefined) {
      params.push(data.fullName.trim());
      setClauses.push(`full_name = $${params.length}`);
    }
    if (data.phone !== undefined) {
      params.push(data.phone || null);
      setClauses.push(`phone = $${params.length}`);
    }
    if (data.isActive !== undefined) {
      params.push(data.isActive);
      setClauses.push(`is_active = $${params.length}`);
    }
    if (data.roleId) {
      params.push(data.roleId);
      setClauses.push(`role_id = $${params.length}`);
    }
    if (data.newPasswordHash) {
      params.push(data.newPasswordHash);
      setClauses.push(`password_hash = $${params.length}`);
    }

    await dbQuery(`UPDATE user_profiles SET ${setClauses.join(', ')} WHERE id = $1`, params);

    // Update scopes
    if (data.territoryId !== undefined || data.regionId !== undefined || data.companyId !== undefined) {
      await dbQuery(
        `INSERT INTO user_scopes (user_id, territory_id, region_id, company_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO UPDATE
         SET territory_id = EXCLUDED.territory_id,
             region_id = EXCLUDED.region_id,
             company_id = EXCLUDED.company_id`,
        [data.id, data.territoryId || null, data.regionId || null, data.companyId || null]
      );
    }
  }

  /**
   * Deletes users by ID array.
   */
  public async deleteUsers(ids: string[]): Promise<void> {
    await dbQuery(`DELETE FROM user_profiles WHERE id = ANY($1::uuid[])`, [ids]);
  }

  /**
   * Retrieves all users for fallback/internal purposes.
   */
  public async getAllUsers(): Promise<UserEntity[]> {
    const res = await dbQuery(
      `SELECT u.id, u.email, u.full_name, u.phone, r.name as role, u.is_active,
              s.territory_id, s.region_id, s.company_id
       FROM user_profiles u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN user_scopes s ON u.id = s.user_id
       ORDER BY u.created_at ASC`
    );

    return res.rows.map((r: any) => ({
      id: r.id,
      email: r.email,
      fullName: r.full_name,
      phone: r.phone,
      role: r.role,
      isActive: r.is_active,
      territoryId: r.territory_id,
      regionId: r.region_id,
    }));
  }

  /**
   * Retrieves user roles and companies for deletion permission checks.
   */
  public async getUsersForDeletionCheck(ids: string[]): Promise<Array<{ id: string; role_name: string; company_id: string | null }>> {
    const res = await dbQuery(
      `SELECT u.id, s.company_id, r.name as role_name 
       FROM user_profiles u 
       LEFT JOIN user_scopes s ON u.id = s.user_id
       LEFT JOIN roles r ON u.role_id = r.id 
       WHERE u.id = ANY($1::uuid[])`,
      [ids]
    );
    return res.rows;
  }

  /**
   * Retrieves user authentication context via stored procedure sp_get_user_for_auth.
   */
  public async getUserForAuth(email: string): Promise<any> {
    const res = await dbQuery('SELECT sp_get_user_for_auth($1) as user_context', [email]);
    return res.rows[0]?.user_context || null;
  }

  /**
   * Updates user last_login_at timestamp.
   */
  public async updateLastLogin(userId: string): Promise<void> {
    await dbQuery('UPDATE user_profiles SET last_login_at = NOW() WHERE id = $1', [userId]);
  }


  /**
   * Completes onboarding by saving password hash and profile details.
   */
  public async completeOnboarding(userId: string, newHash: string, fullName: string, phone: string): Promise<void> {
    await dbQuery(
      `UPDATE user_profiles
       SET password_hash = $1,
           full_name = $2,
           phone = $3,
           must_change_password = FALSE,
           is_onboarded = TRUE,
           updated_at = NOW()
       WHERE id = $4`,
      [newHash, fullName, phone, userId]
    );
  }
}

export const userRepository = new UserRepository();
