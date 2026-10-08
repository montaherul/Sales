// Infrastructure: Master Data Repository
// Data-Access layer aggregating organizational master data, brands, users, targets, and working days
// AGENTS1.md Rule 4 & Rule 8 (Data Access Layer)

import { dbQuery } from '@/shared/database/db';
import { getDbPool } from '@/lib/db';
import { logger } from '@/shared/logger';

export interface MasterDataPayload {
  companies: any[];
  regions: any[];
  territories: any[];
  brands: any[];
  users: any[];
  targets: any[];
  working_days: number;
  activeScopeCompanyId: string | null;
}

export class MasterDataRepository {
  public async getMasterData(
    filterCompanyId: string | null,
    isSuperAdmin: boolean,
    reqYear: number = 2026,
    reqMonth: number = 10
  ): Promise<MasterDataPayload> {
    if (!getDbPool()) {
      return this.getFallbackMasterData(filterCompanyId);
    }

    // 1. Fetch Companies (Non-super admin only gets their assigned company)
    const compSql = !isSuperAdmin && filterCompanyId
      ? `SELECT id, name, code FROM companies WHERE id = $1 ORDER BY name;`
      : `SELECT id, name, code FROM companies ORDER BY name;`;
    const compParams = !isSuperAdmin && filterCompanyId ? [filterCompanyId] : [];
    const compRes = await dbQuery(compSql, compParams);

    // 2. Fetch Regions with Company Scoping
    const regSql = filterCompanyId
      ? `SELECT 
          r.id, 
          r.name, 
          d.company_id, 
          c.name as company_name 
        FROM regions r 
        JOIN wings w ON r.wing_id = w.id 
        JOIN divisions d ON w.division_id = d.id 
        JOIN companies c ON d.company_id = c.id 
        WHERE d.company_id = $1
        ORDER BY r.name;`
      : `SELECT 
          r.id, 
          r.name, 
          d.company_id, 
          c.name as company_name 
        FROM regions r 
        JOIN wings w ON r.wing_id = w.id 
        JOIN divisions d ON w.division_id = d.id 
        JOIN companies c ON d.company_id = c.id 
        ORDER BY r.name;`;
    const regParams = filterCompanyId ? [filterCompanyId] : [];
    const regRes = await dbQuery(regSql, regParams);

    // 3. Fetch Territories with Company & Region Scoping
    const terrSql = filterCompanyId
      ? `SELECT 
          t.id, 
          t.name, 
          t.region_id, 
          r.name as region_name, 
          d.company_id, 
          c.name as company_name, 
          t.sort_order 
        FROM territories t 
        JOIN regions r ON t.region_id = r.id 
        JOIN wings w ON r.wing_id = w.id 
        JOIN divisions d ON w.division_id = d.id 
        JOIN companies c ON d.company_id = c.id 
        WHERE d.company_id = $1
        ORDER BY t.sort_order;`
      : `SELECT 
          t.id, 
          t.name, 
          t.region_id, 
          r.name as region_name, 
          d.company_id, 
          c.name as company_name, 
          t.sort_order 
        FROM territories t 
        JOIN regions r ON t.region_id = r.id 
        JOIN wings w ON r.wing_id = w.id 
        JOIN divisions d ON w.division_id = d.id 
        JOIN companies c ON d.company_id = c.id 
        ORDER BY t.sort_order;`;
    const terrParams = filterCompanyId ? [filterCompanyId] : [];
    const terrRes = await dbQuery(terrSql, terrParams);

    // 4. Fetch Brands (shared or company-scoped)
    const brandSql = filterCompanyId
      ? `SELECT id, name, type, sort_order, is_active, company_id 
         FROM brands 
         WHERE (company_id IS NULL OR company_id = $1) AND is_active = TRUE 
         ORDER BY sort_order;`
      : `SELECT id, name, type, sort_order, is_active, company_id 
         FROM brands 
         WHERE is_active = TRUE 
         ORDER BY sort_order;`;
    const brandParams = filterCompanyId ? [filterCompanyId] : [];
    const brandRes = await dbQuery(brandSql, brandParams);

    // 5. Fetch Users & Roles
    const userSql = filterCompanyId
      ? `SELECT u.id, u.email, u.full_name, r.name as role, us.company_id
         FROM user_profiles u 
         JOIN roles r ON u.role_id = r.id
         LEFT JOIN user_scopes us ON u.id = us.user_id
         WHERE us.company_id = $1;`
      : `SELECT u.id, u.email, u.full_name, r.name as role, us.company_id
         FROM user_profiles u 
         JOIN roles r ON u.role_id = r.id
         LEFT JOIN user_scopes us ON u.id = us.user_id;`;
    const userParams = filterCompanyId ? [filterCompanyId] : [];
    const userRes = await dbQuery(userSql, userParams);

    // 6. Fetch Targets
    const targetSql = filterCompanyId
      ? `SELECT tg.territory_id, tg.brand_id, tg.target_quantity, tg.route_count, tg.outlet_count
         FROM targets tg
         JOIN territories t ON tg.territory_id = t.id
         JOIN regions r ON t.region_id = r.id
         JOIN wings w ON r.wing_id = w.id
         JOIN divisions d ON w.division_id = d.id
         WHERE tg.year = $2 AND tg.month = $3 AND d.company_id = $1;`
      : `SELECT tg.territory_id, tg.brand_id, tg.target_quantity, tg.route_count, tg.outlet_count
         FROM targets tg
         WHERE tg.year = $1 AND tg.month = $2;`;
    const targetParams = filterCompanyId ? [filterCompanyId, reqYear, reqMonth] : [reqYear, reqMonth];
    const targetRes = await dbQuery(targetSql, targetParams);

    // 7. Dynamic Working Days
    let workingDays = 26;
    try {
      const wdSql = filterCompanyId
        ? `SELECT working_days FROM working_days 
           WHERE year = $1 AND month = $2 AND (company_id = $3 OR company_id IS NULL)
           ORDER BY company_id NULLS LAST LIMIT 1;`
        : `SELECT working_days FROM working_days 
           WHERE year = $1 AND month = $2
           ORDER BY company_id NULLS LAST LIMIT 1;`;
      const wdParams = filterCompanyId ? [reqYear, reqMonth, filterCompanyId] : [reqYear, reqMonth];
      const wdRes = await dbQuery(wdSql, wdParams);
      if (wdRes.rows.length > 0 && wdRes.rows[0].working_days) {
        workingDays = Number(wdRes.rows[0].working_days);
      } else if (filterCompanyId) {
        const csRes = await dbQuery(`SELECT working_days FROM company_settings WHERE company_id = $1;`, [filterCompanyId]);
        if (csRes.rows.length > 0 && csRes.rows[0].working_days) {
          workingDays = Number(csRes.rows[0].working_days);
        }
      }
    } catch (wdErr) {
      logger.warn('Failed to query dynamic working days, defaulting to 26', 'MasterDataRepository', { wdErr });
    }

    return {
      companies: compRes.rows,
      regions: regRes.rows,
      territories: terrRes.rows,
      brands: brandRes.rows,
      users: userRes.rows,
      targets: targetRes.rows,
      working_days: workingDays,
      activeScopeCompanyId: filterCompanyId,
    };
  }

  private getFallbackMasterData(filterCompanyId: string | null): MasterDataPayload {
    return {
      companies: [],
      territories: [
        { id: 'satkania-1', name: 'Kerani hat', region_name: 'Satkania', sort_order: 1 },
        { id: 'satkania-2', name: 'Satkania', region_name: 'Satkania', sort_order: 2 },
        { id: 'satkania-3', name: 'Bandarban', region_name: 'Satkania', sort_order: 3 },
        { id: 'satkania-4', name: 'Rajasthali', region_name: 'Satkania', sort_order: 4 },
        { id: 'satkania-5', name: 'Dohazari', region_name: 'Satkania', sort_order: 5 },
      ],
      regions: [],
      brands: [
        { id: 'b1', name: 'Wilson', type: 'CIGARETTE' },
        { id: 'b2', name: 'Shahara', type: 'CIGARETTE' },
        { id: 'b3', name: 'Express', type: 'CIGARETTE' },
        { id: 'b4', name: 'Nexus', type: 'CIGARETTE' },
        { id: 'b5', name: 'SB', type: 'CIGARETTE' },
        { id: 'b6', name: 'SM', type: 'CIGARETTE' },
        { id: 'b7', name: 'SLB', type: 'ZARDA' },
        { id: 'b8', name: '22/25', type: 'ZARDA' },
        { id: 'b9', name: '99/14', type: 'ZARDA' },
        { id: 'b10', name: '33/15', type: 'ZARDA' },
      ],
      users: [],
      targets: [],
      working_days: 26,
      activeScopeCompanyId: filterCompanyId,
    };
  }
}

export const masterDataRepository = new MasterDataRepository();
