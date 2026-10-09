// Application: Target Service
// Coordinates target settings, monthly quotas, territory scoping, and audit logs
// AGENTS1.md Rule 4 & Rule 6 (Application / Service Layer)

import { targetRepository, TargetFilterOptions } from '../infrastructure/TargetRepository';
import { TerritoryBrandTargetItem } from '../domain/types';
import { UserAuthContext } from '@/shared/authorization';
import { ROLES, AUDIT_ACTIONS } from '@/shared/constants';
import { ForbiddenError, ValidationError } from '@/shared/errors';
import { PaginationHelper, PaginatedResult } from '@/shared/database/pagination';
import { AuditService } from '@/modules/audit';

export interface UpsertTargetDTO {
  territoryId: string;
  brandId: string;
  year?: number;
  month?: number;
  targetQuantity: number;
  routeCount?: number;
  outletCount?: number;
}

export class TargetService {
  /**
   * Retrieves paginated targets with company scoping.
   */
  public static async getTargetsPaginated(
    options: Omit<TargetFilterOptions, 'companyId'> & { companyIdParam?: string | null },
    actor: UserAuthContext
  ): Promise<PaginatedResult<any>> {
    const targetCompanyId = actor.role === ROLES.SUPER_ADMIN
      ? (options.companyIdParam && options.companyIdParam !== 'ALL' ? options.companyIdParam : null)
      : (actor.companyId || null);

    return await targetRepository.getPaginatedTargets({
      page: options.page,
      pageSize: options.pageSize,
      search: options.search,
      year: options.year,
      month: options.month,
      territoryId: options.territoryId,
      companyId: targetCompanyId,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
    });
  }

  /**
   * Generates CSV export for targets.
   */
  public static async exportTargetsCsv(
    options: Omit<TargetFilterOptions, 'companyId'> & { companyIdParam?: string | null },
    actor: UserAuthContext
  ): Promise<string> {
    const result = await this.getTargetsPaginated({ ...options, pageSize: -1 }, actor);
    return PaginationHelper.toCsv(result.data, {
      id: 'Target ID',
      territory_name: 'Territory',
      company_name: 'Company',
      brand_name: 'Brand',
      brand_type: 'Type',
      target_quantity: 'Target Volume',
      route_count: 'Routes',
      outlet_count: 'Outlets',
      year: 'Year',
      month: 'Month',
    });
  }

  /**
   * Upserts territory target quota.
   */
  public static async upsertTarget(dto: UpsertTargetDTO, actor: UserAuthContext): Promise<any> {
    if (actor.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN can configure targets');
    }

    if (!dto.territoryId || !dto.brandId) {
      throw new ValidationError('Territory and Brand are required');
    }

    // Resolve company from territory
    const targetCompId = await targetRepository.resolveCompanyFromTerritory(dto.territoryId) || actor.companyId;

    if (actor.role === ROLES.COMPANY_ADMIN && targetCompId !== actor.companyId) {
      throw new ForbiddenError('Cannot configure targets for territories outside your company');
    }

    const saved = await targetRepository.upsertTarget({
      territoryId: dto.territoryId,
      brandId: dto.brandId,
      year: dto.year || 2026,
      month: dto.month || 10,
      targetQuantity: parseFloat(dto.targetQuantity as any) || 0,
      routeCount: dto.routeCount || 0,
      outletCount: dto.outletCount || 0,
      companyId: targetCompId,
    });

    // Centralized Audit Log
    await AuditService.logEvent({
      userId: actor.id,
      companyId: targetCompId,
      eventType: AUDIT_ACTIONS.TARGET_UPDATE,
      entityName: 'targets',
      entityId: saved.id,
      newValues: dto,
    });

    return saved;
  }

  /**
   * Deletes targets with tenant authorization check.
   */
  public static async deleteTargets(ids: string[], actor: UserAuthContext): Promise<number> {
    if (actor.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN can delete targets');
    }

    if (!ids || ids.length === 0) {
      throw new ValidationError('At least one Target ID is required');
    }

    if (actor.role === ROLES.COMPANY_ADMIN) {
      const records = await targetRepository.getTargetsByIds(ids);
      const unauthorized = records.filter(r => r.company_id !== actor.companyId);
      if (unauthorized.length > 0) {
        throw new ForbiddenError('You can only delete targets within your company');
      }
    }

    await targetRepository.deleteTargets(ids);

    // Centralized Audit Log
    await AuditService.logEvent({
      userId: actor.id,
      companyId: actor.companyId,
      eventType: AUDIT_ACTIONS.DELETE,
      entityName: 'targets',
      entityId: ids.join(','),
      oldValues: { deletedIds: ids },
    });

    return ids.length;
  }

  /**
   * Queries monthly targets list for calculation engine.
   */
  public static async getTargets(year: number = 2026, month: number = 10, companyId?: string | null): Promise<TerritoryBrandTargetItem[]> {
    return await targetRepository.getMonthlyTargets(year, month, companyId);
  }
}
