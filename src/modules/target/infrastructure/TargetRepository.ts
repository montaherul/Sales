// Infrastructure: Target Repository
// Data-Access layer handling PostgreSQL queries and stored procedures for targets
// AGENTS1.md Rule 4 & Rule 8 (Data Access Layer)

import { dbQuery } from '@/shared/database/db';
import { PaginationHelper, PaginatedResult } from '@/shared/database/pagination';
import { TerritoryBrandTargetItem } from '../domain/types';

export interface TargetFilterOptions {
  page: number;
  pageSize: number;
  search?: string;
  year: number;
  month: number;
  territoryId?: string | null;
  companyId?: string | null;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface UpsertTargetData {
  territoryId: string;
  brandId: string;
  year: number;
  month: number;
  targetQuantity: number;
  routeCount?: number;
  outletCount?: number;
  companyId?: string | null;
}

export class TargetRepository {
  /**
   * Queries paginated targets using stored procedure sp_get_targets_paginated.
   */
  public async getPaginatedTargets(options: TargetFilterOptions): Promise<PaginatedResult<any>> {
    const cleanSortBy = (options.sortBy || 'tg.target_quantity').replace(/^tg\./, '');
    return await PaginationHelper.executeFunction(
      'sp_get_targets_paginated',
      [
        options.page,
        options.pageSize,
        options.search || null,
        options.year,
        options.month,
        options.territoryId || null,
        options.companyId || null,
        cleanSortBy,
        options.sortOrder || 'desc',
      ]
    );
  }

  /**
   * Resolves company ID for territory.
   */
  public async resolveCompanyFromTerritory(territoryId: string): Promise<string | null> {
    const res = await dbQuery(
      `SELECT d.company_id 
       FROM territories t 
       JOIN regions r ON t.region_id = r.id 
       JOIN wings w ON r.wing_id = w.id 
       JOIN divisions d ON w.division_id = d.id 
       WHERE t.id = $1 LIMIT 1`,
      [territoryId]
    );
    return res.rows[0]?.company_id || null;
  }

  /**
   * Upserts a target row.
   */
  public async upsertTarget(data: UpsertTargetData): Promise<any> {
    const res = await dbQuery(
      `INSERT INTO targets (territory_id, brand_id, year, month, target_quantity, route_count, outlet_count, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (territory_id, brand_id, year, month)
       DO UPDATE SET 
         target_quantity = EXCLUDED.target_quantity,
         route_count = COALESCE(EXCLUDED.route_count, targets.route_count),
         outlet_count = COALESCE(EXCLUDED.outlet_count, targets.outlet_count),
         company_id = COALESCE(targets.company_id, EXCLUDED.company_id),
         updated_at = NOW()
       RETURNING *`,
      [
        data.territoryId,
        data.brandId,
        data.year,
        data.month,
        data.targetQuantity,
        data.routeCount || 0,
        data.outletCount || 0,
        data.companyId || null,
      ]
    );
    return res.rows[0];
  }

  /**
   * Batch updates target quantities.
   */
  public async batchUpdateTargets(
    updates: Array<{ id: string; targetQuantity: number; routeCount?: number; outletCount?: number }>
  ): Promise<number> {
    let count = 0;
    for (const u of updates) {
      const res = await dbQuery(
        `UPDATE targets
         SET target_quantity = $1,
             route_count = COALESCE($2, route_count),
             outlet_count = COALESCE($3, outlet_count),
             updated_at = NOW()
         WHERE id = $4`,
        [u.targetQuantity, u.routeCount || null, u.outletCount || null, u.id]
      );
      count += res.rowCount || 0;
    }
    return count;
  }

  /**
   * Queries targets by ID array to verify ownership.
   */
  public async getTargetsByIds(ids: string[]): Promise<Array<{ id: string; company_id: string | null }>> {
    const res = await dbQuery('SELECT id, company_id FROM targets WHERE id = ANY($1::uuid[])', [ids]);
    return res.rows;
  }

  /**
   * Deletes targets by ID array.
   */
  public async deleteTargets(ids: string[]): Promise<void> {
    await dbQuery(`DELETE FROM targets WHERE id = ANY($1::uuid[])`, [ids]);
  }

  /**
   * Queries monthly targets list.
   */
  public async getMonthlyTargets(year: number, month: number, companyId?: string | null): Promise<TerritoryBrandTargetItem[]> {
    let query = `
      SELECT tg.id, tg.territory_id, tg.brand_id, tg.target_quantity,
             tg.year, tg.month, t.name as territory_name
      FROM targets tg
      JOIN territories t ON tg.territory_id = t.id
      WHERE tg.year = $1 AND tg.month = $2
    `;
    const params: any[] = [year, month];

    if (companyId) {
      query += ` AND tg.company_id = $3`;
      params.push(companyId);
    }

    const res = await dbQuery(query, params);
    return res.rows.map((r: any) => ({
      id: r.id,
      territoryId: r.territory_id,
      territoryName: r.territory_name,
      brandId: r.brand_id,
      targetQuantity: parseFloat(r.target_quantity || 0),
      year: r.year,
      month: r.month,
    }));
  }
}

export const targetRepository = new TargetRepository();
