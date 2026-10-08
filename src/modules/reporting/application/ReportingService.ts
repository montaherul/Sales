// Application: Reporting Service
// Coordinates calculation engine to produce executive dashboard metrics

import { reportingRepository } from '../infrastructure/ReportingRepository';
import { calculationEngine } from '@/modules/calculation';
import { ExecutiveKPISummary, TerritoryPerformanceSummary } from '../domain/types';
import { SATKANIA_TERRITORIES, DEFAULT_WORKING_DAYS } from '@/shared/constants';

export class ReportingService {
  /**
   * Generates executive KPI summary for active month with tenant company scoping.
   */
  public static async getExecutiveKPIs(
    year: number = 2026,
    month: number = 10,
    companyId?: string
  ): Promise<{
    kpis: ExecutiveKPISummary;
    territories: TerritoryPerformanceSummary[];
  }> {
    const { territorySales, territoryStock, activeDaysElapsed } =
      await reportingRepository.getMonthlyAggregation(year, month, companyId);

    // Resolve live territories from PostgreSQL
    let masterTerritories: { id: string; name: string }[] = [];
    let territoryTargets: Record<string, number> = {};

    try {
      const terrRes = await (await import('@/shared/database/db')).dbQuery(
        `SELECT t.id, t.name 
         FROM territories t
         JOIN regions r ON t.region_id = r.id
         JOIN wings w ON r.wing_id = w.id
         JOIN divisions d ON w.division_id = d.id
         WHERE ($1::uuid IS NULL OR d.company_id = $1)
         ORDER BY t.sort_order;`,
        [companyId || null]
      );
      if (terrRes.rows.length > 0) {
        masterTerritories = terrRes.rows.map(r => ({ id: r.id, name: r.name }));
      }

      // Fetch monthly targets from PostgreSQL
      const tgRes = await (await import('@/shared/database/db')).dbQuery(
        `SELECT territory_id, SUM(target_quantity) as total_target
         FROM targets
         WHERE year = $1 AND month = $2
           AND ($3::uuid IS NULL OR company_id = $3)
         GROUP BY territory_id;`,
        [year, month, companyId || null]
      );
      tgRes.rows.forEach(r => {
        territoryTargets[r.territory_id] = parseFloat(r.total_target || 0);
      });
    } catch {}

    // Fallback if no territories resolved
    if (masterTerritories.length === 0) {
      masterTerritories = SATKANIA_TERRITORIES.map(t => ({ id: t.id, name: t.name }));
    }

    let totalTarget = 0;
    let totalSales = 0;
    let totalStock = 0;

    const territories: TerritoryPerformanceSummary[] = masterTerritories.map((t) => {
      const target = territoryTargets[t.id] || 350.0;
      const std = territorySales[t.id] || 0;
      const stock = territoryStock[t.id] || 0;
      const ach = calculationEngine.achievement.calculateAchievement(std, target);
      const periodADS = calculationEngine.ads.calculateADS(std, activeDaysElapsed);

      totalTarget += target;
      totalSales += std;
      totalStock += stock;

      return {
        territoryId: t.id,
        territoryName: t.name,
        target,
        salesToDate: std,
        achievementPercentage: ach,
        closingStock: stock,
        periodADS,
      };
    });

    const overallAch = calculationEngine.achievement.calculateAchievement(totalSales, totalTarget);
    const overallADS = calculationEngine.ads.calculateADS(totalSales, activeDaysElapsed);
    const stockCoverDays = overallADS > 0 ? Number((totalStock / overallADS).toFixed(1)) : 0;

    return {
      kpis: {
        totalMonthlyTarget: totalTarget,
        salesToDate: totalSales,
        overallAchievement: overallAch,
        closingStockVolume: totalStock,
        stockCoverDays,
        activeWorkingDaysElapsed: activeDaysElapsed,
        totalWorkingDays: DEFAULT_WORKING_DAYS,
        territoryCount: masterTerritories.length,
      },
      territories,
    };
  }
}
