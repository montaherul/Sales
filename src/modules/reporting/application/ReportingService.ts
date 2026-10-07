// Application: Reporting Service
// Coordinates calculation engine to produce executive dashboard metrics

import { reportingRepository } from '../infrastructure/ReportingRepository';
import { calculationEngine } from '@/modules/calculation';
import { ExecutiveKPISummary, TerritoryPerformanceSummary } from '../domain/types';
import { SATKANIA_TERRITORIES, DEFAULT_WORKING_DAYS } from '@/shared/constants';

export class ReportingService {
  /**
   * Generates executive KPI summary for active month.
   */
  public static async getExecutiveKPIs(year: number = 2026, month: number = 10): Promise<{
    kpis: ExecutiveKPISummary;
    territories: TerritoryPerformanceSummary[];
  }> {
    const { territorySales, territoryStock, activeDaysElapsed } =
      await reportingRepository.getMonthlyAggregation(year, month);

    const territoryTargets: Record<string, number> = {
      'satkania-keranihat': 450.0,
      'satkania-satkania': 400.0,
      'satkania-gunagori': 320.0,
      'satkania-lohagora': 380.0,
      'satkania-chakaria': 500.0,
    };

    let totalTarget = 0;
    let totalSales = 0;
    let totalStock = 0;

    const territories: TerritoryPerformanceSummary[] = SATKANIA_TERRITORIES.map((t) => {
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
        territoryCount: SATKANIA_TERRITORIES.length,
      },
      territories,
    };
  }
}
