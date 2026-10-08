// Application: Organization Service
// Orchestrates tenant organizational hierarchies, positions, reporting trees, and audit trails

import { organizationRepository } from '../infrastructure/OrganizationRepository';
import { Department, Position, Distributor } from '../domain/OrganizationSpecification';
import { UserAuthContext } from '@/shared/auth';
import { ForbiddenError, ValidationError, NotFoundError } from '@/shared/errors';
import { AuditService } from '@/modules/audit';
import { AUDIT_ACTIONS, ROLES } from '@/shared/constants';
import { logger } from '@/shared/logger';

export class OrganizationService {
  private static canManageTenant(actor: UserAuthContext, targetCompanyId?: string | null): boolean {
    if (actor.role === ROLES.SUPER_ADMIN) return true;
    if ((actor.role === 'COMPANY_ADMIN' || actor.role === 'TENANT_ADMIN') && actor.companyId === targetCompanyId) {
      return true;
    }
    return false;
  }

  // ==========================================
  // DEPARTMENTS
  // ==========================================

  public static async getDepartments(
    companyIdParam: string | null | undefined,
    actor: UserAuthContext
  ): Promise<Department[]> {
    const effectiveCompanyId = actor.role === ROLES.SUPER_ADMIN
      ? (companyIdParam && companyIdParam !== 'ALL' ? companyIdParam : null)
      : (actor.companyId || null);

    return await organizationRepository.getDepartments(effectiveCompanyId);
  }

  public static async createDepartment(
    data: { companyId?: string; name: string; code?: string; description?: string; head_user_id?: string },
    actor: UserAuthContext
  ): Promise<Department> {
    const targetCompanyId = actor.role === ROLES.SUPER_ADMIN ? data.companyId : actor.companyId;
    if (!targetCompanyId) {
      throw new ValidationError('Company ID is required to create a department');
    }

    if (!this.canManageTenant(actor, targetCompanyId)) {
      throw new ForbiddenError('You do not have permission to create departments for this company');
    }

    const dept = await organizationRepository.createDepartment(targetCompanyId, {
      name: data.name,
      code: data.code,
      description: data.description,
      head_user_id: data.head_user_id,
    });

    await AuditService.logEvent({
      userId: actor.id,
      companyId: targetCompanyId,
      eventType: AUDIT_ACTIONS.CREATE,
      entityName: 'departments',
      entityId: dept.id,
      newValues: dept,
    });

    return dept;
  }

  public static async updateDepartment(
    id: string,
    data: { name?: string; code?: string; description?: string; head_user_id?: string; is_active?: boolean },
    actor: UserAuthContext
  ): Promise<Department> {
    const existing = await organizationRepository.getDepartmentById(id);
    if (!existing) {
      throw new NotFoundError('Department', id);
    }

    if (!this.canManageTenant(actor, existing.company_id)) {
      throw new ForbiddenError('You do not have permission to modify this department');
    }

    const updated = await organizationRepository.updateDepartment(id, data);

    await AuditService.logEvent({
      userId: actor.id,
      companyId: existing.company_id,
      eventType: AUDIT_ACTIONS.UPDATE,
      entityName: 'departments',
      entityId: id,
      newValues: data,
    });

    return updated;
  }

  public static async deleteDepartment(id: string, actor: UserAuthContext): Promise<void> {
    const existing = await organizationRepository.getDepartmentById(id);
    if (!existing) {
      throw new NotFoundError('Department', id);
    }

    if (!this.canManageTenant(actor, existing.company_id)) {
      throw new ForbiddenError('You do not have permission to delete this department');
    }

    await organizationRepository.deleteDepartment(id);

    await AuditService.logEvent({
      userId: actor.id,
      companyId: existing.company_id,
      eventType: AUDIT_ACTIONS.DELETE,
      entityName: 'departments',
      entityId: id,
    });
  }

  // ==========================================
  // POSITIONS
  // ==========================================

  public static async getPositions(
    companyIdParam: string | null | undefined,
    departmentId: string | null | undefined,
    actor: UserAuthContext
  ): Promise<Position[]> {
    const effectiveCompanyId = actor.role === ROLES.SUPER_ADMIN
      ? (companyIdParam && companyIdParam !== 'ALL' ? companyIdParam : null)
      : (actor.companyId || null);

    return await organizationRepository.getPositions(effectiveCompanyId, departmentId);
  }

  public static async createPosition(
    data: {
      companyId?: string;
      department_id: string;
      name: string;
      code?: string;
      level?: number;
      parent_position_id?: string;
      default_role_id?: string;
      description?: string;
    },
    actor: UserAuthContext
  ): Promise<Position> {
    const targetCompanyId = actor.role === ROLES.SUPER_ADMIN ? data.companyId : actor.companyId;
    if (!targetCompanyId) {
      throw new ValidationError('Company ID is required to create a position');
    }

    if (!this.canManageTenant(actor, targetCompanyId)) {
      throw new ForbiddenError('You do not have permission to create positions for this company');
    }

    const pos = await organizationRepository.createPosition(targetCompanyId, data);

    await AuditService.logEvent({
      userId: actor.id,
      companyId: targetCompanyId,
      eventType: AUDIT_ACTIONS.CREATE,
      entityName: 'positions',
      entityId: pos.id,
      newValues: pos,
    });

    return pos;
  }

  public static async updatePosition(
    id: string,
    data: {
      department_id?: string;
      name?: string;
      code?: string;
      level?: number;
      parent_position_id?: string | null;
      default_role_id?: string | null;
      description?: string;
      is_active?: boolean;
    },
    actor: UserAuthContext
  ): Promise<Position> {
    const existing = await organizationRepository.getPositionById(id);
    if (!existing) {
      throw new NotFoundError('Position', id);
    }

    if (!this.canManageTenant(actor, existing.company_id)) {
      throw new ForbiddenError('You do not have permission to modify this position');
    }

    const updated = await organizationRepository.updatePosition(id, data);

    await AuditService.logEvent({
      userId: actor.id,
      companyId: existing.company_id,
      eventType: AUDIT_ACTIONS.UPDATE,
      entityName: 'positions',
      entityId: id,
      newValues: data,
    });

    return updated;
  }

  public static async deletePosition(id: string, actor: UserAuthContext): Promise<void> {
    const existing = await organizationRepository.getPositionById(id);
    if (!existing) {
      throw new NotFoundError('Position', id);
    }

    if (!this.canManageTenant(actor, existing.company_id)) {
      throw new ForbiddenError('You do not have permission to delete this position');
    }

    await organizationRepository.deletePosition(id);

    await AuditService.logEvent({
      userId: actor.id,
      companyId: existing.company_id,
      eventType: AUDIT_ACTIONS.DELETE,
      entityName: 'positions',
      entityId: id,
    });
  }

  // ==========================================
  // DISTRIBUTORS
  // ==========================================

  public static async getDistributors(
    companyIdParam: string | null | undefined,
    territoryId: string | null | undefined,
    actor: UserAuthContext
  ): Promise<Distributor[]> {
    const effectiveCompanyId = actor.role === ROLES.SUPER_ADMIN
      ? (companyIdParam && companyIdParam !== 'ALL' ? companyIdParam : null)
      : (actor.companyId || null);

    return await organizationRepository.getDistributors(effectiveCompanyId, territoryId);
  }

  public static async createDistributor(
    data: {
      companyId?: string;
      name: string;
      code?: string;
      proprietor_name?: string;
      phone?: string;
      email?: string;
      address?: string;
      territory_id?: string;
      status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    },
    actor: UserAuthContext
  ): Promise<Distributor> {
    const targetCompanyId = actor.role === ROLES.SUPER_ADMIN ? data.companyId : actor.companyId;
    if (!targetCompanyId) {
      throw new ValidationError('Company ID is required to create a distributor');
    }

    if (!this.canManageTenant(actor, targetCompanyId)) {
      throw new ForbiddenError('You do not have permission to create distributors for this company');
    }

    const dist = await organizationRepository.createDistributor(targetCompanyId, data);

    await AuditService.logEvent({
      userId: actor.id,
      companyId: targetCompanyId,
      eventType: AUDIT_ACTIONS.CREATE,
      entityName: 'distributors',
      entityId: dist.id,
      newValues: dist,
    });

    return dist;
  }

  public static async updateDistributor(
    id: string,
    data: {
      name?: string;
      code?: string;
      proprietor_name?: string;
      phone?: string;
      email?: string;
      address?: string;
      territory_id?: string | null;
      status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    },
    actor: UserAuthContext
  ): Promise<Distributor> {
    const distList = await organizationRepository.getDistributors();
    const existing = distList.find(d => d.id === id);
    if (!existing) {
      throw new NotFoundError('Distributor', id);
    }

    if (!this.canManageTenant(actor, existing.company_id)) {
      throw new ForbiddenError('You do not have permission to modify this distributor');
    }

    const updated = await organizationRepository.updateDistributor(id, data);

    await AuditService.logEvent({
      userId: actor.id,
      companyId: existing.company_id,
      eventType: AUDIT_ACTIONS.UPDATE,
      entityName: 'distributors',
      entityId: id,
      newValues: data,
    });

    return updated;
  }

  public static async deleteDistributor(id: string, actor: UserAuthContext): Promise<void> {
    const distList = await organizationRepository.getDistributors();
    const existing = distList.find(d => d.id === id);
    if (!existing) {
      throw new NotFoundError('Distributor', id);
    }

    if (!this.canManageTenant(actor, existing.company_id)) {
      throw new ForbiddenError('You do not have permission to delete this distributor');
    }

    await organizationRepository.deleteDistributor(id);

    await AuditService.logEvent({
      userId: actor.id,
      companyId: existing.company_id,
      eventType: AUDIT_ACTIONS.DELETE,
      entityName: 'distributors',
      entityId: id,
    });
  }

  // ==========================================
  // TEMPLATE PROVISIONER
  // ==========================================

  public static async provisionTemplate(
    companyId: string,
    actor: UserAuthContext
  ): Promise<any> {
    if (!this.canManageTenant(actor, companyId)) {
      throw new ForbiddenError('You do not have permission to provision templates for this company');
    }

    const result = await organizationRepository.provisionTemplate(companyId);

    await AuditService.logEvent({
      userId: actor.id,
      companyId: companyId,
      eventType: AUDIT_ACTIONS.CREATE,
      entityName: 'tenant_template',
      entityId: companyId,
      newValues: { action: 'provision_fmcg_template' },
    });

    return result;
  }
}
