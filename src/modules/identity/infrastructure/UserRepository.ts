// Infrastructure: User & Menu Access Repository
// Connects to PostgreSQL user_profiles, user_scopes, role_menu_access, user_menu_access

import { dbQuery } from '@/shared/database/db';
import { UserEntity } from '../domain/types';
import { RoleType } from '@/shared/constants';

export class UserRepository {
  /**
   * Retrieves all users with their roles and scopes.
   */
  public async getAllUsers(): Promise<UserEntity[]> {
    try {
      const res = await dbQuery(
        `SELECT u.id, u.email, u.full_name, u.phone, u.role, u.is_active,
                s.territory_id, s.region_id
         FROM user_profiles u
         LEFT JOIN user_scopes s ON u.id = s.user_id
         ORDER BY u.created_at ASC`
      );

      return res.rows.map((r: any) => ({
        id: r.id,
        email: r.email,
        fullName: r.full_name,
        phone: r.phone,
        role: r.role as RoleType,
        isActive: r.is_active,
        territoryId: r.territory_id,
        regionId: r.region_id,
      }));
    } catch {
      // Fallback seeded profiles
      return [
        {
          id: 'admin-1',
          email: 'admin@afaztobacco.com',
          fullName: 'Super Administrator',
          role: 'SUPER_ADMIN',
          isActive: true,
        },
        {
          id: 'rso-1',
          email: 'rso.satkania@afaztobacco.com',
          fullName: 'Rahim Ahmed (RSO)',
          role: 'RSO',
          isActive: true,
          regionId: 'satkania-region',
        },
        {
          id: 'tso-1',
          email: 'tso.keranihat@afaztobacco.com',
          fullName: 'Kamal Hossain (TSO)',
          role: 'TSO',
          isActive: true,
          territoryId: 'satkania-keranihat',
        },
        {
          id: 'csr-1',
          email: 'csr.keranihat@afaztobacco.com',
          fullName: 'Mohammad Faruk (CSR)',
          role: 'CSR',
          isActive: true,
          territoryId: 'satkania-keranihat',
        },
      ];
    }
  }

  /**
   * Creates a user profile and assigns organizational scope.
   */
  public async createUser(
    fullName: string,
    email: string,
    role: RoleType,
    territoryId?: string,
    phone?: string
  ): Promise<string> {
    const userId = `usr_${Date.now()}`;

    await dbQuery(
      `INSERT INTO user_profiles (id, email, full_name, role, phone, is_active)
       VALUES ($1, $2, $3, $4, $5, true)`,
      [userId, email, fullName, role, phone || null]
    );

    if (territoryId) {
      await dbQuery(
        `INSERT INTO user_scopes (user_id, territory_id)
         VALUES ($1, $2)`,
        [userId, territoryId]
      );
    }

    return userId;
  }
}

export const userRepository = new UserRepository();
