// Application: Product Service
// Coordinates brand management, unit prices, and multi-tenant scoping
// AGENTS1.md Rule 4 & Rule 6 (Application / Service Layer)

import { productRepository, BrandFilterOptions } from '../infrastructure/ProductRepository';
import { UserAuthContext } from '@/shared/authorization';
import { ROLES, AUDIT_ACTIONS } from '@/shared/constants';
import { ForbiddenError, ValidationError, NotFoundError } from '@/shared/errors';
import { PaginationHelper, PaginatedResult } from '@/shared/database/pagination';
import { AuditService } from '@/modules/audit';

export interface CreateBrandDTO {
  name: string;
  type: 'CIGARETTE' | 'ZARDA';
  sortOrder?: number;
  companyId?: string | null;
  unitPrice?: number;
}

export interface UpdateBrandDTO {
  id: string;
  name?: string;
  type?: 'CIGARETTE' | 'ZARDA';
  sortOrder?: number;
  isActive?: boolean;
  companyId?: string | null;
  unitPrice?: number;
}

export class ProductService {
  /**
   * Retrieves paginated brands with tenant scoping.
   */
  public static async getBrandsPaginated(
    options: Omit<BrandFilterOptions, 'companyId'> & { companyIdParam?: string | null },
    actor: UserAuthContext
  ): Promise<PaginatedResult<any>> {
    const targetCompanyId = actor.role === ROLES.SUPER_ADMIN
      ? (options.companyIdParam && options.companyIdParam !== 'ALL' ? options.companyIdParam : null)
      : (actor.companyId || null);

    return await productRepository.getPaginatedBrands({
      page: options.page,
      pageSize: options.pageSize,
      search: options.search,
      type: options.type,
      companyId: targetCompanyId,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
    });
  }

  /**
   * Generates CSV export for brands.
   */
  public static async exportBrandsCsv(
    options: Omit<BrandFilterOptions, 'companyId'> & { companyIdParam?: string | null },
    actor: UserAuthContext
  ): Promise<string> {
    const result = await this.getBrandsPaginated({ ...options, pageSize: -1 }, actor);
    return PaginationHelper.toCsv(result.data, {
      id: 'Brand ID',
      name: 'Brand Name',
      type: 'Product Type',
      company_name: 'Company',
      current_price: 'Unit Price (BDT)',
      sort_order: 'Display Order',
      is_active: 'Active Status',
      created_at: 'Created Date',
    });
  }

  /**
   * Creates a new brand and initial price.
   */
  public static async createBrand(dto: CreateBrandDTO, actor: UserAuthContext): Promise<any> {
    if (actor.role !== ROLES.SUPER_ADMIN && actor.role !== ROLES.COMPANY_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN or COMPANY_ADMIN can create brands');
    }

    if (!dto.name || !dto.name.trim()) throw new ValidationError('Brand Name is required');
    if (!dto.type) throw new ValidationError('Brand Type is required (CIGARETTE or ZARDA)');

    const brandCompanyId = actor.role === ROLES.SUPER_ADMIN
      ? (dto.companyId || null)
      : actor.companyId;

    const existing = await productRepository.getBrandByNameAndCompany(dto.name.trim(), brandCompanyId);
    if (existing) {
      throw new ValidationError(`Brand "${dto.name}" already exists in this scope`);
    }

    const newBrand = await productRepository.createBrand(
      dto.name.trim(),
      dto.type,
      dto.sortOrder || 0,
      brandCompanyId,
      dto.unitPrice
    );

    // Centralized Audit Log
    await AuditService.logEvent({
      userId: actor.id,
      companyId: brandCompanyId || null,
      eventType: AUDIT_ACTIONS.CREATE,
      entityName: 'brands',
      entityId: newBrand.id,
      newValues: newBrand,
    });

    return newBrand;
  }

  /**
   * Updates an existing brand and price.
   */
  public static async updateBrand(dto: UpdateBrandDTO, actor: UserAuthContext): Promise<any> {
    if (actor.role !== ROLES.SUPER_ADMIN && actor.role !== ROLES.COMPANY_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN or COMPANY_ADMIN can update brands');
    }

    const existing = await productRepository.getBrandById(dto.id);
    if (!existing) {
      throw new NotFoundError('Brand not found');
    }

    if (actor.role === ROLES.COMPANY_ADMIN && existing.company_id && existing.company_id !== actor.companyId) {
      throw new ForbiddenError('You can only update brands within your company');
    }

    if (dto.name && dto.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await productRepository.getBrandByNameAndCompany(dto.name.trim(), existing.company_id);
      if (duplicate && duplicate.id !== dto.id) {
        throw new ValidationError(`Brand name "${dto.name}" is already taken`);
      }
    }

    const updated = await productRepository.updateBrand(
      dto.id,
      dto.name ? dto.name.trim() : undefined,
      dto.type,
      dto.sortOrder,
      dto.isActive,
      dto.unitPrice,
      dto.companyId
    );

    // Centralized Audit Log
    await AuditService.logEvent({
      userId: actor.id,
      companyId: existing.company_id || null,
      eventType: AUDIT_ACTIONS.UPDATE,
      entityName: 'brands',
      entityId: dto.id,
      oldValues: existing,
      newValues: updated,
    });

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

    // Centralized Audit Log
    await AuditService.logEvent({
      userId: actor.id,
      companyId: actor.companyId || null,
      eventType: AUDIT_ACTIONS.DELETE,
      entityName: 'brands',
      entityId: ids.join(','),
      oldValues: { deletedIds: ids },
    });

    return ids.length;
  }
}
