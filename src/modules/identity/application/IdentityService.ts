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
import { AuditService } from '@/modules/audit';
import { logger } from '@/shared/logger';

export interface CreateUserDTO {
  email: string;
  fullName: string;
  roleName: string;
  phone?: string;
  password?: string;
  companyId?: string | null;
  departmentId?: string | null;
  positionId?: string | null;
  supervisorId?: string | null;
  distributorId?: string | null;
  scopeLevel?: string | null;
  territoryId?: string | null;
  regionId?: string | null;
  routeId?: string | null;
}

export interface UpdateUserDTO {
  id: string;
  fullName?: string;
  phone?: string | null;
  roleName?: string;
  isActive?: boolean;
  password?: string;
  companyId?: string | null;
  departmentId?: string | null;
  positionId?: string | null;
  supervisorId?: string | null;
  distributorId?: string | null;
  scopeLevel?: string | null;
  territoryId?: string | null;
  regionId?: string | null;
  routeId?: string | null;
}

export class IdentityService {
  /**
   * Retrieves paginated users with server-side tenant scoping.
   */
  public static async getUsersPaginated(
    options: UserFilterOptions,
    actor: UserAuthContext
  ): Promise<PaginatedResult<any>> {
    if (actor.role !== ROLES.SUPER_ADMIN && actor.role !== ROLES.COMPANY_ADMIN && actor.role !== ROLES.TENANT_ADMIN) {
      throw new ForbiddenError('Insufficient permissions to access User Directory');
    }

    const filterCompanyId = actor.role === ROLES.SUPER_ADMIN
      ? (options.companyId && options.companyId !== 'ALL' ? options.companyId : null)
      : (actor.companyId || null);

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
      role: 'Role',
      company_name: 'Company',
      region_name: 'Region',
      territory_name: 'Territory',
      is_active: 'Active Status',
      created_at: 'Created Date',
    });
  }

  /**
   * Creates a user with hierarchical scope auto-resolution and tenant protection.
   */
  public static async createUser(dto: CreateUserDTO, actor: UserAuthContext): Promise<string> {
    // 1. Role validation
    if (actor.role !== ROLES.SUPER_ADMIN && actor.role !== ROLES.COMPANY_ADMIN && actor.role !== ROLES.TENANT_ADMIN) {
      throw new ForbiddenError('Only Super Admin and Company Administrators can create users');
    }

    if (actor.role !== ROLES.SUPER_ADMIN && dto.roleName === ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Company Administrators cannot create Super Admin accounts');
    }

    if (!dto.email || !dto.email.trim()) throw new ValidationError('Email is required');
    if (!dto.fullName || !dto.fullName.trim()) throw new ValidationError('Full Name is required');
    if (!dto.roleName) throw new ValidationError('Role is required');

    const cleanEmail = dto.email.trim().toLowerCase();

    // 2. Duplicate email check
    const existingUser = await userRepository.getUserByEmail(cleanEmail);
    if (existingUser) {
      throw new ValidationError(`User with email "${cleanEmail}" already exists`);
    }

    // 3. Resolve Role entity
    const role = await userRepository.getRoleByName(dto.roleName);
    if (!role) {
      throw new ValidationError(`Role "${dto.roleName}" does not exist`);
    }

    // 4. Resolve Tenant Company ID
    let finalCompanyId: string | null = null;
    if (actor.role === ROLES.SUPER_ADMIN) {
      finalCompanyId = dto.companyId && dto.companyId !== 'ALL' ? dto.companyId : null;
    } else {
      finalCompanyId = actor.companyId || null;
    }

    // 5. Hierarchical Scope Auto-Resolution
    let finalTerritoryId = dto.territoryId && dto.territoryId !== 'ALL' ? dto.territoryId : null;
    let finalRegionId = dto.regionId && dto.regionId !== 'ALL' ? dto.regionId : null;

    if (finalTerritoryId) {
      const hierarchy = await userRepository.resolveHierarchyFromTerritory(finalTerritoryId);
      if (hierarchy) {
        finalRegionId = hierarchy.regionId;
        if (!finalCompanyId) finalCompanyId = hierarchy.companyId;
      }
    } else if (finalRegionId) {
      const regComp = await userRepository.resolveCompanyFromRegion(finalRegionId);
      if (regComp && !finalCompanyId) finalCompanyId = regComp;
    }

    // 6. Password Hash & Persistence
    const passwordHash = await bcrypt.hash(dto.password || '123', 10);
    const userId = crypto.randomUUID();

    const deptId = dto.departmentId ?? (dto as any).department_id ?? null;
    const posId = dto.positionId ?? (dto as any).position_id ?? null;
    const supId = dto.supervisorId ?? (dto as any).supervisor_id ?? null;
    const distId = dto.distributorId ?? (dto as any).distributor_id ?? null;
    const scpLvl = dto.scopeLevel ?? (dto as any).scope_level ?? null;
    const rtId = dto.routeId ?? (dto as any).route_id ?? null;

    await userRepository.createUser({
      id: userId,
      email: cleanEmail,
      passwordHash,
      fullName: dto.fullName.trim(),
      phone: dto.phone,
      roleId: role.id,
      roleName: dto.roleName,
      companyId: finalCompanyId,
      departmentId: deptId,
      positionId: posId,
      supervisorId: supId,
      distributorId: distId,
      scopeLevel: scpLvl,
      territoryId: finalTerritoryId,
      regionId: finalRegionId,
      routeId: rtId,
    });

    // 7. Centralized Audit Log
    await AuditService.logEvent({
      userId: actor.id,
      companyId: finalCompanyId,
      eventType: AUDIT_ACTIONS.CREATE,
      entityName: 'user_profiles',
      entityId: userId,
      newValues: {
        email: dto.email,
        fullName: dto.fullName,
        role: dto.roleName,
        companyId: finalCompanyId,
        departmentId: deptId,
        positionId: posId,
        supervisorId: supId,
      },
    });

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

    // Tenant boundary check
    if (actor.role !== ROLES.SUPER_ADMIN) {
      if (existing.company_id !== actor.companyId) {
        throw new ForbiddenError('You can only update users within your assigned company');
      }
      if (existing.role === ROLES.SUPER_ADMIN || dto.roleName === ROLES.SUPER_ADMIN) {
        throw new ForbiddenError('Company Administrators cannot modify Super Admin accounts');
      }
    }

    let roleId: string | undefined;
    if (dto.roleName) {
      const role = await userRepository.getRoleByName(dto.roleName);
      if (!role) throw new ValidationError(`Role "${dto.roleName}" does not exist`);
      roleId = role.id;
    }

    let passwordHash: string | undefined;
    if (dto.password && dto.password.trim().length > 0) {
      passwordHash = await bcrypt.hash(dto.password, 10);
    }

    // Hierarchical resolution on scope update
    let finalTerritoryId = dto.territoryId !== undefined ? (dto.territoryId && dto.territoryId !== 'ALL' ? dto.territoryId : null) : existing.territory_id;
    let finalRegionId = dto.regionId !== undefined ? (dto.regionId && dto.regionId !== 'ALL' ? dto.regionId : null) : existing.region_id;
    let finalCompanyId = dto.companyId !== undefined ? (dto.companyId && dto.companyId !== 'ALL' ? dto.companyId : null) : existing.company_id;

    if (dto.territoryId && dto.territoryId !== 'ALL') {
      const hierarchy = await userRepository.resolveHierarchyFromTerritory(dto.territoryId);
      if (hierarchy) {
        finalRegionId = hierarchy.regionId;
        if (actor.role === ROLES.SUPER_ADMIN && !finalCompanyId) finalCompanyId = hierarchy.companyId;
      }
    }

    const deptId = dto.departmentId !== undefined ? dto.departmentId : (dto as any).department_id;
    const posId = dto.positionId !== undefined ? dto.positionId : (dto as any).position_id;
    const supId = dto.supervisorId !== undefined ? dto.supervisorId : (dto as any).supervisor_id;
    const distId = dto.distributorId !== undefined ? dto.distributorId : (dto as any).distributor_id;
    const scpLvl = dto.scopeLevel !== undefined ? dto.scopeLevel : (dto as any).scope_level;
    const rtId = dto.routeId !== undefined ? dto.routeId : (dto as any).route_id;

    await userRepository.updateUser({
      id: dto.id,
      fullName: dto.fullName,
      phone: dto.phone,
      roleId,
      roleName: dto.roleName,
      isActive: dto.isActive,
      newPasswordHash: passwordHash,
      departmentId: deptId,
      positionId: posId,
      supervisorId: supId,
      distributorId: distId,
      scopeLevel: scpLvl,
      territoryId: finalTerritoryId,
      regionId: finalRegionId,
      companyId: finalCompanyId,
      routeId: rtId,
    });

    // Centralized Audit Log
    await AuditService.logEvent({
      userId: actor.id,
      companyId: finalCompanyId || existing.company_id,
      eventType: AUDIT_ACTIONS.UPDATE,
      entityName: 'user_profiles',
      entityId: dto.id,
      oldValues: { fullName: existing.full_name, role: existing.role, isActive: existing.is_active },
      newValues: {
        fullName: dto.fullName,
        role: dto.roleName,
        isActive: dto.isActive,
        departmentId: dto.departmentId,
        positionId: dto.positionId,
        supervisorId: dto.supervisorId,
      },
    });
  }

  /**
   * Deletes users with tenant and system role protection.
   */
  public static async deleteUsers(ids: string[], actor: UserAuthContext): Promise<number> {
    if (actor.role !== ROLES.SUPER_ADMIN && actor.role !== ROLES.COMPANY_ADMIN && actor.role !== ROLES.TENANT_ADMIN) {
      throw new ForbiddenError('Insufficient permissions to delete users');
    }

    if (ids.length === 0) {
      throw new ValidationError('At least one User ID is required');
    }

    // Check target users
    const targetUsers = await userRepository.getUsersForDeletionCheck(ids);

    if (targetUsers.some((u: any) => u.role_name === ROLES.SUPER_ADMIN)) {
      throw new ForbiddenError('Super Admin accounts cannot be deleted');
    }

    if (actor.role !== ROLES.SUPER_ADMIN) {
      const foreignUsers = targetUsers.filter((u: any) => u.company_id !== actor.companyId);
      if (foreignUsers.length > 0) {
        throw new ForbiddenError('You can only delete users within your assigned company');
      }
    }

    await userRepository.deleteUsers(ids);

    // Centralized Audit Log
    await AuditService.logEvent({
      userId: actor.id,
      companyId: actor.companyId || null,
      eventType: AUDIT_ACTIONS.DELETE,
      entityName: 'user_profiles',
      entityId: ids.join(','),
      oldValues: { deletedIds: ids },
    });

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

    // Centralized Audit Log
    await AuditService.logEvent({
      userId: user.id,
      companyId: user.companyId || null,
      eventType: 'AUTH_LOGIN',
      entityName: 'user_profiles',
      entityId: user.id,
      newValues: { email: user.email, role: user.role, timestamp: new Date().toISOString() },
      ipAddress: ipAddress || '127.0.0.1',
    });

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
      throw new ForbiddenError(`Google account (${cleanEmail}) is not pre-registered. Please contact your Super Administrator.`);
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

    // Centralized Audit Log
    await AuditService.logEvent({
      userId: user.id,
      companyId: user.companyId || null,
      eventType: 'AUTH_GOOGLE_SIGNIN',
      entityName: 'user_profiles',
      entityId: user.id,
      newValues: { email: user.email, role: user.role, provider: 'google', timestamp: new Date().toISOString() },
      ipAddress: ipAddress || '127.0.0.1',
    });

    return { sessionUser, user };
  }

  /**
   * Records logout audit event.
   */
  public static async recordLogout(user: { id: string; email: string; role: string }, ipAddress?: string): Promise<void> {
    await AuditService.logEvent({
      userId: user.id,
      eventType: 'AUTH_LOGOUT',
      entityName: 'user_profiles',
      entityId: user.id,
      newValues: { email: user.email, role: user.role },
      ipAddress: ipAddress || '127.0.0.1',
    });
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

    // Centralized Audit Log
    await AuditService.logEvent({
      userId: sessionUser.id,
      companyId: sessionUser.companyId || null,
      eventType: 'AUTH_ONBOARDING_COMPLETE',
      entityName: 'user_profiles',
      entityId: sessionUser.id,
      newValues: { fullName: cleanFullName, phone: cleanPhone, email: sessionUser.email, timestamp: new Date().toISOString() },
    });

    return updatedUser;
  }
}
