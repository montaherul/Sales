// Application: Product Service
// Coordinates brand management workflows, pricing, tenant boundaries, and audit logs
// AGENTS1.md Rule 4 & Rule 6 (Application / Service Layer)

import { productRepository, BrandFilterOptions } from '../infrastructure/ProductRepository';
import { UserAuthContext } from '@/shared/authorization';
import { ROLES, AUDIT_ACTIONS } from '@/shared/constants';
import { ForbiddenError, ValidationError, NotFoundError } from '@/shared/errors';
import { PaginationHelper, PaginatedResult } from '@/shared/database/pagination';
import { dbQuery } from '@/shared/database/db';
import { logger } from '@/shared/logger';
import { BrandCatalogItem } from '../domain/types';

export interface CreateBrandDTO {
  name: string;
  type: string;
  unitPrice?: number;
  sortOrder?: number;
  companyId?: string | null;
}

export interface UpdateBrandDTO {
  id: string;
  name?: string;
  type?: string;
  unitPrice?: number;
  sortOrder?: number;
  isActive?: boolean;
  companyId?: string | null;
}

export class ProductService {
  /**
   * Retrieves paginated brands with tenant scoping.
   */
  public static async getBrandsPaginated(
    options: BrandFilterOptions,
    actor: UserAuthContext
  ): Promise<PaginatedResult<any>> {
    let targetCompanyId = actor.role === ROLES.SUPER_ADMIN
      ? (options.companyId && options.companyId !== 'ALL' ? options.companyId : null)
      : (actor.companyId || null);

    return await productRepository.getPaginatedBrands({
      ...options,
      companyId: targetCompanyId,
    });
  }

  /**
   * Exports brands as CSV.
   */
  public static async exportBrandsCsv(
    options: BrandFilterOptions,
    actor: UserAuthContext
  ): Promise<string> {
    const result = await this.getBrandsPaginated({ ...options, pageSize: -1 }, actor);
    return PaginationHelper.toCsv(result.data, {
      id: 'Brand ID',
      name: 'Brand Name',
      type: 'Product Category',
      company_name: 'Company',
      unit_price: 'Unit Price (BDT)',
      sort_order: 'Display Order',
      is_active: 'Active Status',
      effective_from: 'Effective Date',
    });
  }

  /**
   * Retrieves brands catalog list.
   */
  public static async getBrands(): Promise<BrandCatalogItem[]> {
    return await productRepository.getBrands();
  }

  /**
   * Creates a new brand with pricing and audit logging.
   */
  public static async createBrand(dto: CreateBrandDTO, actor: UserAuthContext): Promise<any> {
    if (actor.role !== ROLES.SUPER_ADMIN && actor.role !== ROLES.COMPANY_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN or COMPANY_ADMIN can create brands');
    }

    if (!dto.name || !dto.name.trim()) throw new ValidationError('Brand name is required');
    if (!dto.type) throw new ValidationError('Product type (CIGARETTE or ZARDA) is required');

    const brandCompanyId = actor.role === ROLES.COMPANY_ADMIN
      ? actor.companyId
      : (dto.companyId && dto.companyId !== 'ALL' ? dto.companyId : actor.companyId);

    const newBrand = await productRepository.createBrand(
      dto.name,
      dto.type,
      dto.sortOrder || 0,
      brandCompanyId,
      dto.unitPrice
    );

    // Audit Logging
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, company_id, event_type, entity_name, entity_id, new_values)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          actor.id,
          brandCompanyId || null,
          AUDIT_ACTIONS.CREATE,
          'brands',
          newBrand.id,
          JSON.stringify(newBrand),
        ]
      );
    } catch (auditErr) {
      logger.warn('Failed to write brand creation audit log', 'ProductService', { auditErr });
    }

    return newBrand;
  }

  /**
   * Updates an existing brand and price.
   */
  public static async updateBrand(dto: UpdateBrandDTO, actor: UserAuthContext): Promise<any> {
    if (actor.role !== ROLES.SUPER_ADMIN && actor.role !== ROLES.COMPANY_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN or COMPANY_ADMIN can update brands');
    }

    if (!dto.id) throw new ValidationError('Brand ID is required');

    const existing = await productRepository.getBrandById(dto.id);
    if (!existing) {
      throw new NotFoundError('Brand not found');
    }

    if (actor.role === ROLES.COMPANY_ADMIN && existing.company_id && existing.company_id !== actor.companyId) {
      throw new ForbiddenError('You can only update brands within your company');
    }

    const updated = await productRepository.updateBrand(
      dto.id,
      dto.name,
      dto.type,
      dto.sortOrder,
      dto.isActive,
      dto.unitPrice,
      dto.companyId
    );

    // Audit Logging
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, company_id, event_type, entity_name, entity_id, old_values, new_values)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          actor.id,
          existing.company_id || null,
          AUDIT_ACTIONS.UPDATE,
          'brands',
          dto.id,
          JSON.stringify(existing),
          JSON.stringify(updated),
        ]
      );
    } catch (auditErr) {
      logger.warn('Failed to write brand update audit log', 'ProductService', { auditErr });
    }

    return updated;
  }

  /**
   * Deletes brands with tenant scoping.
   */
  public static async deleteBrands(ids: string[], actor: UserAuthContext): Promise<number> {
    if (actor.role !== ROLES.SUPER_ADMIN && actor.role !== ROLES.COMPANY_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN or COMPANY_ADMIN can delete brands');
    }

    if (ids.length === 0) {
      throw new ValidationError('At least one Brand ID is required');
    }

    if (actor.role === ROLES.COMPANY_ADMIN) {
      for (const id of ids) {
        const brand = await productRepository.getBrandById(id);
        if (brand && brand.company_id && brand.company_id !== actor.companyId) {
          throw new ForbiddenError('You can only delete brands within your company');
        }
      }
    }

    await productRepository.deleteBrands(ids);

    // Audit Logging
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, company_id, event_type, entity_name, entity_id, old_values)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [actor.id, actor.companyId || null, AUDIT_ACTIONS.DELETE, 'brands', ids.join(','), JSON.stringify({ deletedIds: ids })]
      );
    } catch (auditErr) {
      logger.warn('Failed to write brand deletion audit log', 'ProductService', { auditErr });
    }

    return ids.length;
  }
}
