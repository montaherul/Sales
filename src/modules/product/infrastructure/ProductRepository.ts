// Infrastructure: Product Repository
// Data-Access layer handling PostgreSQL queries and stored procedures for brands & pricing
// AGENTS1.md Rule 4 & Rule 8 (Data Access Layer)

import { dbQuery } from '@/shared/database/db';
import { PaginationHelper, PaginatedResult } from '@/shared/database/pagination';
import { BrandCatalogItem } from '../domain/types';

export interface BrandFilterOptions {
  page: number;
  pageSize: number;
  search?: string;
  type?: string | null;
  companyId?: string | null;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class ProductRepository {
  /**
   * Queries paginated brands using stored procedure sp_get_brands_paginated.
   */
  public async getPaginatedBrands(options: BrandFilterOptions): Promise<PaginatedResult<any>> {
    const cleanSortBy = (options.sortBy || 'b.sort_order').replace(/^b\./, '');
    return await PaginationHelper.executeFunction(
      'sp_get_brands_paginated',
      [
        options.page,
        options.pageSize,
        options.search || null,
        options.type || null,
        options.companyId || null,
        cleanSortBy,
        options.sortOrder || 'asc',
      ]
    );
  }

  /**
   * Retrieves brand by ID.
   */
  public async getBrandById(id: string): Promise<any | null> {
    const res = await dbQuery(
      `SELECT b.id, b.name, b.type, b.sort_order, b.is_active, b.company_id, p.unit_price
       FROM brands b
       LEFT JOIN prices p ON b.id = p.brand_id AND p.is_active = TRUE
       WHERE b.id = $1 LIMIT 1`,
      [id]
    );
    return res.rows[0] || null;
  }

  /**
   * Retrieves brand by name and company.
   */
  public async getBrandByNameAndCompany(name: string, companyId?: string | null): Promise<any | null> {
    const res = await dbQuery(
      `SELECT id, name, type, company_id FROM brands 
       WHERE LOWER(name) = LOWER($1) AND ($2::uuid IS NULL OR company_id = $2 OR company_id IS NULL)
       LIMIT 1`,
      [name.trim(), companyId || null]
    );
    return res.rows[0] || null;
  }

  /**
   * Creates brand and sets active price.
   */
  public async createBrand(
    name: string,
    type: string,
    sortOrder: number,
    companyId?: string | null,
    unitPrice?: number
  ): Promise<any> {
    const brandRes = await dbQuery(
      `INSERT INTO brands (name, type, sort_order, is_active, company_id)
       VALUES ($1, $2, $3, TRUE, $4)
       RETURNING id, name, type, sort_order, company_id`,
      [name.trim(), type, sortOrder || 0, companyId || null]
    );

    const newBrand = brandRes.rows[0];

    if (unitPrice !== undefined && unitPrice > 0) {
      await dbQuery(
        `INSERT INTO prices (brand_id, unit_price, effective_from, is_active)
         VALUES ($1, $2, CURRENT_DATE, TRUE)`,
        [newBrand.id, unitPrice]
      );
    }

    return { ...newBrand, unit_price: unitPrice || 0 };
  }

  /**
   * Updates brand details and price.
   */
  public async updateBrand(
    id: string,
    name?: string,
    type?: string,
    sortOrder?: number,
    isActive?: boolean,
    unitPrice?: number,
    companyId?: string | null
  ): Promise<any> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [id];

    if (name !== undefined) {
      params.push(name.trim());
      setClauses.push(`name = $${params.length}`);
    }
    if (type !== undefined) {
      params.push(type);
      setClauses.push(`type = $${params.length}`);
    }
    if (sortOrder !== undefined) {
      params.push(sortOrder);
      setClauses.push(`sort_order = $${params.length}`);
    }
    if (isActive !== undefined) {
      params.push(isActive);
      setClauses.push(`is_active = $${params.length}`);
    }
    if (companyId !== undefined) {
      params.push(companyId || null);
      setClauses.push(`company_id = $${params.length}`);
    }

    const res = await dbQuery(
      `UPDATE brands SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );

    if (unitPrice !== undefined) {
      await dbQuery(`UPDATE prices SET is_active = FALSE WHERE brand_id = $1`, [id]);
      await dbQuery(
        `INSERT INTO prices (brand_id, unit_price, effective_from, is_active)
         VALUES ($1, $2, CURRENT_DATE, TRUE)`,
        [id, unitPrice]
      );
    }

    return res.rows[0];
  }

  /**
   * Deletes brands by ID array.
   */
  public async deleteBrands(ids: string[]): Promise<void> {
    await dbQuery(`DELETE FROM brands WHERE id = ANY($1::uuid[])`, [ids]);
  }

  /**
   * Retrieves brands catalog list.
   */
  public async getBrands(): Promise<BrandCatalogItem[]> {
    const res = await dbQuery(
      `SELECT b.id, b.name, b.type as category, b.sort_order, p.unit_price
       FROM brands b
       LEFT JOIN prices p ON b.id = p.brand_id AND p.is_active = TRUE
       ORDER BY b.type, b.sort_order ASC`
    );

    return res.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      unitPrice: r.unit_price ? parseFloat(r.unit_price) : undefined,
      sortOrder: r.sort_order,
    }));
  }
}

export const productRepository = new ProductRepository();
