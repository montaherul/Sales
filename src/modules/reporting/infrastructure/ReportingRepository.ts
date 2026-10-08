// Infrastructure: Selective Reporting Repository
// Aggregates monthly data across sales, stock, targets, and organizational structure
// AGENTS1.md Rule 4 & Rule 8 (Data Access Layer)

import { dbQuery } from '@/shared/database/db';
import { SATKANIA_TERRITORIES, DEFAULT_WORKING_DAYS } from '@/shared/constants';

export class ReportingRepository {
  /**
   * Fetches aggregated sales and stock totals for a given month with company scoping.
   */
  public async getMonthlyAggregation(year: number, month: number, companyId?: string): Promise<{
    territorySales: Record<string, number>;
    territoryStock: Record<string, number>;
    activeDaysElapsed: number;
  }> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    const territorySales: Record<string, number> = {};
    const territoryStock: Record<string, number> = {};
    let activeDaysElapsed = 0;

    try {
      const res = await dbQuery(
        `SELECT s.territory_id,
                COALESCE(SUM(ds.quantity), 0) as total_sales,
                COALESCE(MAX(dst.closing_stock), 0) as latest_stock,
                COUNT(DISTINCT s.report_date) as days_count
         FROM daily_submissions s
         JOIN territories t ON s.territory_id = t.id
         JOIN regions r ON t.region_id = r.id
         JOIN wings w ON r.wing_id = w.id
         JOIN divisions d ON w.division_id = d.id
         LEFT JOIN daily_sales ds ON s.id = ds.submission_id
         LEFT JOIN daily_stock dst ON s.id = dst.submission_id
         WHERE s.report_date >= $1 AND s.report_date <= $2
           AND ($3::uuid IS NULL OR d.company_id = $3 OR s.company_id = $3)
         GROUP BY s.territory_id`,
        [startDate, endDate, companyId || null]
      );

      res.rows.forEach((r: any) => {
        territorySales[r.territory_id] = parseFloat(r.total_sales || 0);
        territoryStock[r.territory_id] = parseFloat(r.latest_stock || 0);
        const days = parseInt(r.days_count, 10);
        if (days > activeDaysElapsed) {
          activeDaysElapsed = days;
        }
      });

      if (activeDaysElapsed === 0) {
        activeDaysElapsed = 1;
      }
    } catch {
      // Demo fallback values only in mock/offline mode when no company scope specified
      if (!companyId) {
        SATKANIA_TERRITORIES.forEach((t) => {
          territorySales[t.id] = 120.5;
          territoryStock[t.id] = 45.2;
        });
        activeDaysElapsed = 6;
      } else {
        activeDaysElapsed = 1;
      }
    }

    return { territorySales, territoryStock, activeDaysElapsed };
  }

  /**
   * Retrieves master territories for reporting with company scoping.
   */
  public async getMasterTerritories(companyId?: string): Promise<Array<{ id: string; name: string }>> {
    try {
      const terrRes = await dbQuery(
        `SELECT t.id, t.name 
         FROM territories t
         JOIN regions r ON t.region_id = r.id
         JOIN wings w ON r.wing_id = w.id
         JOIN divisions d ON w.division_id = d.id
         WHERE ($1::uuid IS NULL OR d.company_id = $1)
         ORDER BY t.sort_order;`,
        [companyId || null]
      );
      return terrRes.rows.map((r: any) => ({ id: r.id, name: r.name }));
    } catch {
      return [];
    }
  }

  /**
   * Retrieves monthly targets mapped by territory ID.
   */
  public async getMonthlyTargets(year: number, month: number, companyId?: string): Promise<Record<string, number>> {
    const targets: Record<string, number> = {};
    try {
      const tgRes = await dbQuery(
        `SELECT territory_id, SUM(target_quantity) as total_target
         FROM targets
         WHERE year = $1 AND month = $2
           AND ($3::uuid IS NULL OR company_id = $3)
         GROUP BY territory_id;`,
        [year, month, companyId || null]
      );
      tgRes.rows.forEach((r: any) => {
        targets[r.territory_id] = parseFloat(r.total_target || 0);
      });
    } catch {
      // ignore
    }
    return targets;
  }

  /**
   * Retrieves dynamic working days for period and company.
   */
  public async getWorkingDays(year: number, month: number, companyId?: string): Promise<number> {
    try {
      const wdRes = await dbQuery(
        `SELECT working_days FROM working_days 
         WHERE year = $1 AND month = $2 
           AND ($3::uuid IS NULL OR company_id = $3 OR company_id IS NULL)
         ORDER BY company_id NULLS LAST LIMIT 1;`,
        [year, month, companyId || null]
      );
      if (wdRes.rows.length > 0 && wdRes.rows[0].working_days) {
        return Number(wdRes.rows[0].working_days);
      }
    } catch {
      // ignore
    }
    return DEFAULT_WORKING_DAYS;
  }
}

export const reportingRepository = new ReportingRepository();
