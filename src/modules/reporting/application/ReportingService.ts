// Application: Reporting Service
// Coordinates calculation engine to produce executive dashboard metrics
// AGENTS1.md Rule 4 & Rule 6 (Application / Service Layer)

import { reportingRepository } from '../infrastructure/ReportingRepository';
import { calculationEngine } from '@/modules/calculation';
import { ExecutiveKPISummary, TerritoryPerformanceSummary } from '../domain/types';
import { SATKANIA_TERRITORIES } from '@/shared/constants';

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

    // Resolve master territories from repository
    let masterTerritories = await reportingRepository.getMasterTerritories(companyId);

    // Fallback if no territories resolved only in offline test/demo mode without companyId
    if (masterTerritories.length === 0 && !companyId) {
      masterTerritories = SATKANIA_TERRITORIES.map(t => ({ id: t.id, name: t.name }));
    }

    // Resolve targets and working days from repository
    const territoryTargets = await reportingRepository.getMonthlyTargets(year, month, companyId);
    const totalWorkingDays = await reportingRepository.getWorkingDays(year, month, companyId);

    let totalTarget = 0;
    let totalSales = 0;
    let totalStock = 0;

    const territories: TerritoryPerformanceSummary[] = masterTerritories.map((t) => {
      const target = territoryTargets[t.id] || 0;
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
        totalWorkingDays,
        territoryCount: masterTerritories.length,
      },
      territories,
    };
  }
}
