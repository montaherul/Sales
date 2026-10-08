// Application: Identity Service
// Coordinates user management workflows, multi-tenant boundaries, and audit logging
// AGENTS1.md Rule 4 & Rule 6 (Application / Service Layer)

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { userRepository, UserFilterOptions } from '../infrastructure/UserRepository';
import { UserAuthContext } from '@/shared/authorization';
import { ROLES, AUDIT_ACTIONS } from '@/shared/constants';
import { ForbiddenError, ValidationError, NotFoundError } from '@/shared/errors';
import { PaginationHelper, PaginatedResult } from '@/shared/database/pagination';
import { dbQuery } from '@/shared/database/db';
import { logger } from '@/shared/logger';

export interface CreateUserDTO {
  email: string;
  fullName: string;
  roleName: string;
  phone?: string;
  password?: string;
  companyId?: string | null;
  territoryId?: string | null;
  regionId?: string | null;
}

export interface UpdateUserDTO {
  id: string;
  fullName?: string;
  phone?: string | null;
  roleName?: string;
  isActive?: boolean;
  password?: string;
  companyId?: string | null;
  territoryId?: string | null;
  regionId?: string | null;
}

export class IdentityService {
  /**
   * Retrieves paginated users with server-side tenant scoping.
   */
  public static async getUsersPaginated(
    options: UserFilterOptions,
    actor: UserAuthContext
  ): Promise<PaginatedResult<any>> {
    let filterCompanyId = options.companyId && options.companyId !== 'ALL' ? options.companyId : null;

    // Server-side tenant scope enforcement
    if (actor.role !== ROLES.SUPER_ADMIN) {
      filterCompanyId = actor.companyId || null;
    }

    return await userRepository.getPaginatedUsers({
      ...options,
      companyId: filterCompanyId,
    });
  }

  /**
   * Generates CSV export for users within actor scope.
   */
  public static async exportUsersCsv(
    options: UserFilterOptions,
    actor: UserAuthContext
  ): Promise<string> {
    const result = await this.getUsersPaginated({ ...options, pageSize: -1 }, actor);
    return PaginationHelper.toCsv(result.data, {
      id: 'User ID',
      full_name: 'Full Name',
      email: 'Email',
      phone: 'Phone',
      role_name: 'Role',
      company_name: 'Company',
      region_name: 'Region',
      territory_name: 'Territory',
      is_active: 'Active Status',
      created_at: 'Created Date',
    });
  }

  /**
   * Creates a new user with role validation, hierarchy auto-resolution, and audit logging.
   */
  public static async createUser(dto: CreateUserDTO, actor: UserAuthContext): Promise<string> {
    // 1. Authorization check
    if (actor.role !== ROLES.SUPER_ADMIN && actor.role !== ROLES.COMPANY_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN or COMPANY_ADMIN can create users');
    }

    if (!dto.email || !dto.fullName || !dto.roleName) {
      throw new ValidationError('Email, Full Name, and Role are mandatory');
    }

    if (actor.role === ROLES.COMPANY_ADMIN && dto.roleName === ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Company Admin cannot create SUPER_ADMIN users');
    }

    // 2. Resolve Role ID
    const role = await userRepository.getRoleByName(dto.roleName);
    if (!role) {
      throw new ValidationError(`Role "${dto.roleName}" does not exist`);
    }

    // 3. Duplicate Email Check
    const existingUser = await userRepository.getUserByEmail(dto.email);
    if (existingUser) {
      throw new ValidationError(`User with email "${dto.email}" already exists`);
    }

    // 4. Hierarchical Scope Resolution
    let finalCompanyId = dto.companyId || null;
    let finalRegionId = dto.regionId || null;
    const finalTerritoryId = dto.territoryId || null;

    if (actor.role === ROLES.COMPANY_ADMIN) {
      finalCompanyId = actor.companyId || null;
    }

    if (finalTerritoryId) {
      const resolved = await userRepository.resolveHierarchyFromTerritory(finalTerritoryId);
      if (resolved) {
        finalRegionId = resolved.regionId;
        if (!finalCompanyId) finalCompanyId = resolved.companyId;
      }
    } else if (finalRegionId && !finalCompanyId) {
      finalCompanyId = await userRepository.resolveCompanyFromRegion(finalRegionId);
    }

    // 5. Password Hashing
    const rawPassword = dto.password || '123';
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const userId = crypto.randomUUID();

    // 6. Persistence via Repository
    await userRepository.createUser({
      id: userId,
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      phone: dto.phone,
      roleId: role.id,
      roleName: dto.roleName,
      companyId: finalCompanyId,
      territoryId: finalTerritoryId,
      regionId: finalRegionId,
    });

    // 7. Audit Logging
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, new_values, company_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          actor.id,
          AUDIT_ACTIONS.CREATE,
          'user_profiles',
          userId,
          JSON.stringify({
            email: dto.email,
            fullName: dto.fullName,
            role: dto.roleName,
            companyId: finalCompanyId,
          }),
          finalCompanyId,
        ]
      );
    } catch (auditErr) {
      logger.warn('Failed to write user creation audit log', 'IdentityService', { auditErr });
    }

    logger.info(`User created successfully: ${dto.email} (${dto.roleName}) by ${actor.email}`, 'IdentityService');
    return userId;
  }

  /**
   * Updates an existing user with tenant boundary validation and audit logging.
   */
  public static async updateUser(dto: UpdateUserDTO, actor: UserAuthContext): Promise<void> {
    const existing = await userRepository.getUserById(dto.id);
    if (!existing) {
      throw new NotFoundError('User not found');
    }

    // Authorization & Scope Enforcement
    if (actor.role !== ROLES.SUPER_ADMIN) {
      if (existing.company_id !== actor.companyId) {
        throw new ForbiddenError('You can only modify users within your assigned company');
      }
      if (existing.role_name === ROLES.SUPER_ADMIN) {
        throw new ForbiddenError('Cannot modify Super Admin accounts');
      }
      if (dto.roleName === ROLES.SUPER_ADMIN) {
        throw new ForbiddenError('Cannot elevate user to Super Admin');
      }
    }

    let roleId: string | undefined = undefined;
    if (dto.roleName) {
      const role = await userRepository.getRoleByName(dto.roleName);
      if (!role) throw new ValidationError(`Role "${dto.roleName}" does not exist`);
      roleId = role.id;
    }

    // Hierarchical resolution
    let finalCompanyId = dto.companyId;
    let finalRegionId = dto.regionId;
    const finalTerritoryId = dto.territoryId;

    if (finalTerritoryId) {
      const resolved = await userRepository.resolveHierarchyFromTerritory(finalTerritoryId);
      if (resolved) {
        finalRegionId = resolved.regionId;
        if (!finalCompanyId) finalCompanyId = resolved.companyId;
      }
    }

    let newPasswordHash: string | undefined = undefined;
    if (dto.password && dto.password.trim().length > 0) {
      newPasswordHash = await bcrypt.hash(dto.password.trim(), 10);
    }

    // Update via Repository
    await userRepository.updateUser({
      id: dto.id,
      fullName: dto.fullName,
      phone: dto.phone,
      isActive: dto.isActive,
      roleId,
      roleName: dto.roleName,
      companyId: finalCompanyId,
      territoryId: finalTerritoryId,
      regionId: finalRegionId,
      newPasswordHash,
    });

    // Audit Logging
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, old_values, new_values, company_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          actor.id,
          AUDIT_ACTIONS.UPDATE,
          'user_profiles',
          dto.id,
          JSON.stringify({
            fullName: existing.full_name,
            role: existing.role_name,
            companyId: existing.company_id,
          }),
          JSON.stringify({
            fullName: dto.fullName,
            role: dto.roleName,
            companyId: finalCompanyId,
          }),
          finalCompanyId || existing.company_id,
        ]
      );
    } catch (auditErr) {
      logger.warn('Failed to write user update audit log', 'IdentityService', { auditErr });
    }
  }

  /**
   * Deletes users with cross-tenant guards and self-deletion prevention.
   */
  public static async deleteUsers(ids: string[], actor: UserAuthContext): Promise<number> {
    if (ids.length === 0) {
      throw new ValidationError('At least one User ID is required');
    }

    if (ids.includes(actor.id)) {
      throw new ForbiddenError('You cannot delete your own account');
    }

    // Check target users
    const targetUsersRes = await dbQuery(
      `SELECT u.id, u.role, u.company_id, r.name as role_name 
       FROM user_profiles u 
       LEFT JOIN roles r ON u.role_id = r.id 
       WHERE u.id = ANY($1::uuid[])`,
      [ids]
    );

    const targetUsers = targetUsersRes.rows;

    if (targetUsers.some((u: any) => u.role_name === ROLES.SUPER_ADMIN || u.role === ROLES.SUPER_ADMIN)) {
      throw new ForbiddenError('Super Admin accounts cannot be deleted');
    }

    if (actor.role !== ROLES.SUPER_ADMIN) {
      const foreignUsers = targetUsers.filter((u: any) => u.company_id !== actor.companyId);
      if (foreignUsers.length > 0) {
        throw new ForbiddenError('You can only delete users within your assigned company');
      }
    }

    await userRepository.deleteUsers(ids);

    // Audit Logging
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, old_values, company_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          actor.id,
          AUDIT_ACTIONS.DELETE,
          'user_profiles',
          ids.join(','),
          JSON.stringify({ deletedIds: ids }),
          actor.companyId || null,
        ]
      );
    } catch (auditErr) {
      logger.warn('Failed to write user delete audit log', 'IdentityService', { auditErr });
    }

    return ids.length;
  }

  /**
   * Authenticates user with email and password credentials.
   */
  public static async authenticateCredentials(email: string, password: string, ipAddress?: string): Promise<{ sessionUser: any; user: any }> {
    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await userRepository.getUserForAuth(cleanEmail);

    if (!user) {
      throw new ValidationError('Invalid email or password');
    }

    if (!user.isActive) {
      throw new ForbiddenError('Your account is deactivated. Please contact your Super Administrator.');
    }

    const isPasswordValid = bcrypt.compareSync(password, user.passwordHash || '');
    if (!isPasswordValid) {
      throw new ValidationError('Invalid email or password');
    }

    await userRepository.updateLastLogin(user.id);

    const sessionUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      companyId: user.companyId,
      companyName: user.companyName,
      regionId: user.regionId,
      regionName: user.regionName,
      territoryId: user.territoryId,
      territoryName: user.territoryName,
      mustChangePassword: user.mustChangePassword,
      isOnboarded: user.isOnboarded,
    };

    // Audit log
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, new_values, ip_address)
         VALUES ($1, 'AUTH_LOGIN', 'user_profiles', $1, $2, $3)`,
        [
          user.id,
          JSON.stringify({ email: user.email, role: user.role, timestamp: new Date().toISOString() }),
          ipAddress || '127.0.0.1',
        ]
      );
    } catch (auditErr) {
      logger.warn('Audit log failed for login', 'IdentityService', { auditErr });
    }

    return { sessionUser, user };
  }

  /**
   * Authenticates verified Google user.
   */
  public static async authenticateGoogle(email: string, ipAddress?: string): Promise<{ sessionUser: any; user: any }> {
    if (!email) {
      throw new ValidationError('Google authentication email is required');
    }

    const cleanEmail = email.trim().toLowerCase();
    let user = await userRepository.getUserForAuth(cleanEmail);

    if (!user) {
      logger.info(`Auto-provisioning verified Google user via bridge: ${cleanEmail}`, 'IdentityService');
      user = await userRepository.autoProvisionGoogleUser(cleanEmail);
      if (!user) {
        throw new ForbiddenError(`Google account (${cleanEmail}) could not be provisioned. Please contact your Super Administrator.`);
      }
    }

    if (!user.isActive) {
      throw new ForbiddenError('Your account is deactivated. Please contact your Super Administrator.');
    }

    await userRepository.updateLastLogin(user.id);

    const sessionUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      companyId: user.companyId,
      companyName: user.companyName,
      regionId: user.regionId,
      regionName: user.regionName,
      territoryId: user.territoryId,
      territoryName: user.territoryName,
      mustChangePassword: user.mustChangePassword,
      isOnboarded: user.isOnboarded,
    };

    // Audit log
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, new_values, ip_address)
         VALUES ($1, 'AUTH_GOOGLE_SIGNIN', 'user_profiles', $1, $2, $3)`,
        [
          user.id,
          JSON.stringify({ email: user.email, role: user.role, provider: 'google', timestamp: new Date().toISOString() }),
          ipAddress || '127.0.0.1',
        ]
      );
    } catch (auditErr) {
      logger.warn('Audit log failed for Google login', 'IdentityService', { auditErr });
    }

    return { sessionUser, user };
  }

  /**
   * Records logout audit event.
   */
  public static async recordLogout(user: { id: string; email: string; role: string }, ipAddress?: string): Promise<void> {
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, new_values, ip_address)
         VALUES ($1, 'AUTH_LOGOUT', 'user_profiles', $1, $2, $3)`,
        [
          user.id,
          JSON.stringify({ email: user.email, role: user.role }),
          ipAddress || '127.0.0.1',
        ]
      );
    } catch (auditErr) {
      logger.warn('Audit log failed for logout', 'IdentityService', { auditErr });
    }
  }

  /**
   * Completes initial user onboarding and sets new password.
   */
  public static async completeOnboarding(
    sessionUser: any,
    newPassword: string,
    fullName?: string,
    phone?: string
  ): Promise<any> {
    if (!newPassword || newPassword.length < 3) {
      throw new ValidationError('Password must be at least 3 characters long.');
    }

    const cleanFullName = (fullName || sessionUser.fullName || '').trim();
    const cleanPhone = (phone || sessionUser.phone || '').trim();
    const newHash = bcrypt.hashSync(newPassword, 10);

    await userRepository.completeOnboarding(sessionUser.id, newHash, cleanFullName, cleanPhone);

    const updatedUser = {
      ...sessionUser,
      fullName: cleanFullName,
      phone: cleanPhone,
      mustChangePassword: false,
      isOnboarded: true,
    };

    // Audit log
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, new_values)
         VALUES ($1, 'AUTH_ONBOARDING_COMPLETE', 'user_profiles', $1, $2)`,
        [
          sessionUser.id,
          JSON.stringify({ fullName: cleanFullName, phone: cleanPhone, email: sessionUser.email, timestamp: new Date().toISOString() }),
        ]
      );
    } catch (auditErr) {
      logger.warn('Audit log failed for onboarding', 'IdentityService', { auditErr });
    }

    return updatedUser;
  }
}
