// Application: Hierarchy Service
// Coordinates organizational hierarchy workflows, scope boundary validation, and audit logs
// AGENTS1.md Rule 4 & Rule 6 (Application / Service Layer)

import { hierarchyRepository, HierarchyFilterOptions } from '../infrastructure/HierarchyRepository';
import { UserAuthContext } from '@/shared/authorization';
import { ROLES, AUDIT_ACTIONS } from '@/shared/constants';
import { ForbiddenError, ValidationError, NotFoundError } from '@/shared/errors';
import { PaginationHelper, PaginatedResult } from '@/shared/database/pagination';
import { dbQuery } from '@/shared/database/db';
import { logger } from '@/shared/logger';

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
   * Retrieves paginated territories scoped to the actor's tenant context.
   */
  public static async getTerritoriesPaginated(
    options: HierarchyFilterOptions,
    actor: UserAuthContext
  ): Promise<PaginatedResult<any>> {
    let filterCompanyId = options.companyId && options.companyId !== 'ALL' ? options.companyId : null;

    if (actor.role !== ROLES.SUPER_ADMIN) {
      filterCompanyId = actor.companyId || null;
    }

    return await hierarchyRepository.getPaginatedTerritories({
      ...options,
      companyId: filterCompanyId,
    });
  }

  /**
   * Generates CSV export for territories.
   */
  public static async exportTerritoriesCsv(
    options: HierarchyFilterOptions,
    actor: UserAuthContext
  ): Promise<string> {
    const result = await this.getTerritoriesPaginated({ ...options, pageSize: -1 }, actor);
    return PaginationHelper.toCsv(result.data, {
      id: 'Territory ID',
      name: 'Territory Name',
      region_name: 'Region',
      wing_name: 'Wing',
      division_name: 'Division',
      company_name: 'Company Entity',
      sort_order: 'Display Order',
      created_at: 'Created Date',
    });
  }

  /**
   * Retrieves dropdown options for divisions, regions, and territories.
   */
  public static async getHierarchyOptions(actor: UserAuthContext, companyId?: string | null): Promise<any> {
    const targetCompanyId = actor.role === ROLES.SUPER_ADMIN
      ? (companyId && companyId !== 'ALL' ? companyId : null)
      : actor.companyId;

    return await hierarchyRepository.getHierarchyOptions(targetCompanyId);
  }

  /**
   * Creates a new territory with tenant scope validation and audit logging.
   */
  public static async createTerritory(dto: CreateTerritoryDTO, actor: UserAuthContext): Promise<any> {
    if (actor.role !== ROLES.SUPER_ADMIN && actor.role !== ROLES.COMPANY_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN or COMPANY_ADMIN can create territories');
    }

    if (!dto.name || !dto.name.trim()) throw new ValidationError('Territory name is required');
    if (!dto.regionId) throw new ValidationError('Region selection is required');

    // Tenant boundary check for COMPANY_ADMIN
    if (actor.role === ROLES.COMPANY_ADMIN) {
      const regionCompanyId = await hierarchyRepository.getCompanyByRegionId(dto.regionId);
      if (!regionCompanyId || regionCompanyId !== actor.companyId) {
        throw new ForbiddenError('Cannot create territories under regions outside your company');
      }
    }

    const newTerritory = await hierarchyRepository.createTerritory(dto.name, dto.regionId, dto.sortOrder || 0);

    // Audit Logging
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, company_id, event_type, entity_name, entity_id, new_values)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [actor.id, actor.companyId || null, AUDIT_ACTIONS.CREATE, 'territories', newTerritory.id, JSON.stringify(newTerritory)]
      );
    } catch (auditErr) {
      logger.warn('Failed to write territory creation audit log', 'HierarchyService', { auditErr });
    }

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

    // Audit Logging
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, company_id, event_type, entity_name, entity_id, new_values)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [actor.id, actor.companyId || null, AUDIT_ACTIONS.UPDATE, 'territories', dto.id, JSON.stringify(updated)]
      );
    } catch (auditErr) {
      logger.warn('Failed to write territory update audit log', 'HierarchyService', { auditErr });
    }

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

    // Audit Logging
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, company_id, event_type, entity_name, entity_id, old_values)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [actor.id, actor.companyId || null, AUDIT_ACTIONS.DELETE, 'territories', ids.join(','), JSON.stringify({ deletedIds: ids })]
      );
    } catch (auditErr) {
      logger.warn('Failed to write territory deletion audit log', 'HierarchyService', { auditErr });
    }

    return ids.length;
  }
}
