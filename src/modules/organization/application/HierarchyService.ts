// Application: Hierarchy Service
// Coordinates organizational hierarchy workflows, territory scoping, and audit logs
// AGENTS1.md Rule 4 & Rule 6 (Application / Service Layer)

import { hierarchyRepository, TerritoryFilterOptions } from '../infrastructure/HierarchyRepository';
import { UserAuthContext } from '@/shared/authorization';
import { ROLES, AUDIT_ACTIONS } from '@/shared/constants';
import { ForbiddenError, ValidationError, NotFoundError } from '@/shared/errors';
import { PaginationHelper, PaginatedResult } from '@/shared/database/pagination';
import { AuditService } from '@/modules/audit';

export interface CreateTerritoryDTO {
  name: string;
  regionId: string;
  sortOrder?: number;
}

export interface UpdateTerritoryDTO {
  id: string;
  name: string;
  regionId?: string;
  sortOrder?: number;
}

export class HierarchyService {
  /**
   * Retrieves paginated territories with tenant scoping for non-Super Admins.
   */
  public static async getTerritoriesPaginated(
    options: Omit<TerritoryFilterOptions, 'companyId'> & { companyIdParam?: string | null },
    actor: UserAuthContext
  ): Promise<PaginatedResult<any>> {
    const targetCompanyId = actor.role === ROLES.SUPER_ADMIN
      ? (options.companyIdParam && options.companyIdParam !== 'ALL' ? options.companyIdParam : null)
      : (actor.companyId || null);

    return await hierarchyRepository.getPaginatedTerritories({
      page: options.page,
      pageSize: options.pageSize,
      search: options.search,
      regionId: options.regionId,
      companyId: targetCompanyId,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
    });
  }

  /**
   * Generates CSV export for territories.
   */
  public static async exportTerritoriesCsv(
    options: Omit<TerritoryFilterOptions, 'companyId'> & { companyIdParam?: string | null },
    actor: UserAuthContext
  ): Promise<string> {
    const result = await this.getTerritoriesPaginated({ ...options, pageSize: -1 }, actor);
    return PaginationHelper.toCsv(result.data, {
      id: 'Territory ID',
      name: 'Territory Name',
      region_name: 'Region',
      wing_name: 'Wing',
      division_name: 'Division',
      company_name: 'Company',
      sort_order: 'Order',
    });
  }

  /**
   * Retrieves full hierarchy options (divisions, wings, regions) for form dropdowns.
   */
  public static async getHierarchyOptions(actor: UserAuthContext, companyIdParam?: string | null): Promise<any> {
    const targetCompanyId = actor.role === ROLES.SUPER_ADMIN
      ? (companyIdParam && companyIdParam !== 'ALL' ? companyIdParam : null)
      : (actor.companyId || null);

    return await hierarchyRepository.getHierarchyOptions(targetCompanyId);
  }

  /**
   * Creates a new territory within permitted company scope.
   */
  public static async createTerritory(dto: CreateTerritoryDTO, actor: UserAuthContext): Promise<any> {
    if (actor.role !== ROLES.SUPER_ADMIN && actor.role !== ROLES.COMPANY_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN or COMPANY_ADMIN can create territories');
    }

    if (!dto.name || !dto.name.trim()) throw new ValidationError('Territory name is required');
    if (!dto.regionId) throw new ValidationError('Region is required');

    // Tenant check for COMPANY_ADMIN
    if (actor.role === ROLES.COMPANY_ADMIN) {
      const regionCompanyId = await hierarchyRepository.getCompanyByRegionId(dto.regionId);
      if (regionCompanyId !== actor.companyId) {
        throw new ForbiddenError('You can only create territories inside your company regions');
      }
    }

    const newTerritory = await hierarchyRepository.createTerritory(dto.name, dto.regionId, dto.sortOrder || 0);

    // Centralized Audit Log
    await AuditService.logEvent({
      userId: actor.id,
      companyId: actor.companyId || null,
      eventType: AUDIT_ACTIONS.CREATE,
      entityName: 'territories',
      entityId: newTerritory.id,
      newValues: newTerritory,
    });

    return newTerritory;
  }

  /**
   * Updates an existing territory.
   */
  public static async updateTerritory(dto: UpdateTerritoryDTO, actor: UserAuthContext): Promise<any> {
    if (actor.role !== ROLES.SUPER_ADMIN && actor.role !== ROLES.COMPANY_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN or COMPANY_ADMIN can update territories');
    }

    if (!dto.id) throw new ValidationError('Territory ID is required');
    if (!dto.name || !dto.name.trim()) throw new ValidationError('Territory name is required');

    if (actor.role === ROLES.COMPANY_ADMIN) {
      const territoryCompanyId = await hierarchyRepository.getCompanyByTerritoryId(dto.id);
      if (!territoryCompanyId || territoryCompanyId !== actor.companyId) {
        throw new ForbiddenError('You can only update territories within your company');
      }
    }

    const updated = await hierarchyRepository.updateTerritory(dto.id, dto.name, dto.regionId, dto.sortOrder);
    if (!updated) {
      throw new NotFoundError('Territory not found');
    }

    // Centralized Audit Log
    await AuditService.logEvent({
      userId: actor.id,
      companyId: actor.companyId || null,
      eventType: AUDIT_ACTIONS.UPDATE,
      entityName: 'territories',
      entityId: dto.id,
      newValues: updated,
    });

    return updated;
  }

  /**
   * Deletes territories with tenant boundary validation.
   */
  public static async deleteTerritories(ids: string[], actor: UserAuthContext): Promise<number> {
    if (actor.role !== ROLES.SUPER_ADMIN && actor.role !== ROLES.COMPANY_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN or COMPANY_ADMIN can delete territories');
    }

    if (ids.length === 0) {
      throw new ValidationError('At least one Territory ID is required');
    }

    if (actor.role === ROLES.COMPANY_ADMIN) {
      for (const id of ids) {
        const territoryCompanyId = await hierarchyRepository.getCompanyByTerritoryId(id);
        if (territoryCompanyId !== actor.companyId) {
          throw new ForbiddenError('You can only delete territories within your company');
        }
      }
    }

    await hierarchyRepository.deleteTerritories(ids);

    // Centralized Audit Log
    await AuditService.logEvent({
      userId: actor.id,
      companyId: actor.companyId || null,
      eventType: AUDIT_ACTIONS.DELETE,
      entityName: 'territories',
      entityId: ids.join(','),
      oldValues: { deletedIds: ids },
    });

    return ids.length;
  }
}
