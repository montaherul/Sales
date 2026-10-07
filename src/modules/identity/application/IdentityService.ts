// Application: Identity Service
// Manages users, roles, and organizational scope assignments

import { userRepository } from '../infrastructure/UserRepository';
import { UserEntity } from '../domain/types';
import { RoleType, AUDIT_ACTIONS } from '@/shared/constants';
import { dbQuery } from '@/shared/database/db';

export class IdentityService {
  public static async getUsers(): Promise<UserEntity[]> {
    return await userRepository.getAllUsers();
  }

  public static async createUser(
    fullName: string,
    email: string,
    role: RoleType,
    territoryId?: string,
    phone?: string,
    actorId: string = 'system'
  ): Promise<string> {
    const userId = await userRepository.createUser(fullName, email, role, territoryId, phone);

    // Audit log
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, new_values)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          actorId,
          AUDIT_ACTIONS.CREATE,
          'user_profiles',
          userId,
          JSON.stringify({ fullName, email, role, territoryId }),
        ]
      );
    } catch {}

    return userId;
  }
}
