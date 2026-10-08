// Infrastructure: Hierarchy Repository
// Data-Access layer handling PostgreSQL queries and stored procedures for organizational hierarchy
// AGENTS1.md Rule 4 & Rule 8 (Data Access Layer)

import { dbQuery } from '@/shared/database/db';
import { PaginationHelper, PaginatedResult } from '@/shared/database/pagination';

export interface HierarchyFilterOptions {
  page: number;
  pageSize: number;
  search?: string;
  regionId?: string | null;
  companyId?: string | null;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class HierarchyRepository {
  /**
   * Queries paginated territories using stored procedure sp_get_territories_paginated.
   */
  public async getPaginatedTerritories(options: HierarchyFilterOptions): Promise<PaginatedResult<any>> {
    const cleanSortBy = (options.sortBy || 't.sort_order').replace(/^t\./, '');
    return await PaginationHelper.executeFunction(
      'sp_get_territories_paginated',
      [
        options.page,
        options.pageSize,
        options.search || null,
        options.regionId || null,
        options.companyId || null,
        cleanSortBy,
        options.sortOrder || 'asc',
      ]
    );
  }

  /**
   * Resolves company ID for a given region.
   */
  public async getCompanyByRegionId(regionId: string): Promise<string | null> {
    const res = await dbQuery(
      `SELECT d.company_id 
       FROM regions r 
       JOIN wings w ON r.wing_id = w.id 
       JOIN divisions d ON w.division_id = d.id 
       WHERE r.id = $1 LIMIT 1`,
      [regionId]
    );
    return res.rows[0]?.company_id || null;
  }

  /**
   * Resolves company ID for a given territory.
   */
  public async getCompanyByTerritoryId(territoryId: string): Promise<string | null> {
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
   * Inserts new territory.
   */
  public async createTerritory(name: string, regionId: string, sortOrder: number = 0): Promise<any> {
    const res = await dbQuery(
      `INSERT INTO territories (name, region_id, sort_order)
       VALUES ($1, $2, $3)
       RETURNING id, name, region_id, sort_order, created_at`,
      [name.trim(), regionId, sortOrder]
    );
    return res.rows[0];
  }

  /**
   * Updates an existing territory.
   */
  public async updateTerritory(id: string, name: string, regionId?: string, sortOrder?: number): Promise<any | null> {
    const res = await dbQuery(
      `UPDATE territories
       SET name = $1, region_id = COALESCE($2, region_id), sort_order = COALESCE($3, sort_order)
       WHERE id = $4
       RETURNING id, name, region_id, sort_order`,
      [name.trim(), regionId || null, sortOrder !== undefined ? sortOrder : null, id]
    );
    return res.rows[0] || null;
  }

  /**
   * Deletes territories by ID array.
   */
  public async deleteTerritories(ids: string[]): Promise<void> {
    await dbQuery(`DELETE FROM territories WHERE id = ANY($1::uuid[])`, [ids]);
  }

  /**
   * Retrieves full hierarchy options for a tenant.
   */
  public async getHierarchyOptions(companyId?: string | null): Promise<any> {
    let divQuery = `SELECT id, name, company_id FROM divisions`;
    let regQuery = `SELECT r.id, r.name, d.company_id FROM regions r JOIN wings w ON r.wing_id = w.id JOIN divisions d ON w.division_id = d.id`;
    let terrQuery = `SELECT t.id, t.name, d.company_id FROM territories t JOIN regions r ON t.region_id = r.id JOIN wings w ON r.wing_id = w.id JOIN divisions d ON w.division_id = d.id`;
    const params: any[] = [];

    if (companyId) {
      divQuery += ` WHERE company_id = $1`;
      regQuery += ` WHERE d.company_id = $1`;
      terrQuery += ` WHERE d.company_id = $1`;
      params.push(companyId);
    }

    const [divs, regs, terrs] = await Promise.all([
      dbQuery(divQuery, params),
      dbQuery(regQuery, params),
      dbQuery(terrQuery, params),
    ]);

    return {
      divisions: divs.rows,
      regions: regs.rows,
      territories: terrs.rows,
    };
  }
}

export const hierarchyRepository = new HierarchyRepository();
