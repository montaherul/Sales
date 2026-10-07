// Centralized Calculation Engine Facade
// Unifies calculations across Dashboard, Reports, and Excel Generation
// Afaz Tobacco Sales & Stock Intelligence Platform

import { SalesCalculator } from './SalesCalculator';
import { StockCalculator } from './StockCalculator';
import { ZardaCalculator } from './ZardaCalculator';
import { STDCalculator } from './STDCalculator';
import { ADSCalculator } from './ADSCalculator';
import { TargetCalculator } from './TargetCalculator';
import { AchievementCalculator } from './AchievementCalculator';
import { ProjectionCalculator } from './ProjectionCalculator';
import { VarianceCalculator } from './VarianceCalculator';
import { BrandSalesInput, BrandStockInput, ZardaSalesInput, ZardaStockInput, TerritoryPerformanceMetrics } from '../domain/types';
import { DEFAULT_WORKING_DAYS } from '@/shared/constants';

export class CalculationEngine {
  public readonly sales = SalesCalculator;
  public readonly stock = StockCalculator;
  public readonly zarda = ZardaCalculator;
  public readonly std = STDCalculator;
  public readonly ads = ADSCalculator;
  public readonly target = TargetCalculator;
  public readonly achievement = AchievementCalculator;
  public readonly projection = ProjectionCalculator;
  public readonly variance = VarianceCalculator;

  /**
   * Evaluates operational daily inputs and returns full calculated values.
   */
  public evaluateDailyRecord(
    cigaretteSales: BrandSalesInput,
    cigaretteStock: BrandStockInput,
    zardaSales: ZardaSalesInput,
    zardaStock: ZardaStockInput
  ) {
    const totalCigaretteSales = SalesCalculator.calculateTotal(cigaretteSales);
    const totalCigaretteStock = StockCalculator.calculateTotal(cigaretteStock);
    const totalZardaSalesValue = ZardaCalculator.calculateSalesValuation(zardaSales);
    const totalZardaStockValue = ZardaCalculator.calculateStockValuation(zardaStock);

    return {
      totalCigaretteSales,
      totalCigaretteStock,
      totalZardaSalesValue,
      totalZardaStockValue,
    };
  }

  /**
   * Computes comprehensive territory performance and variance analysis.
   */
  public computeTerritoryMetrics(params: {
    territoryId: string;
    territoryName: string;
    regionName: string;
    lastMonthSales: number;
    targetVolume: number;
    dailyVolumes: number[];
    activeDaysElapsed: number;
    totalWorkingDays?: number;
  }): TerritoryPerformanceMetrics {
    const totalWorkingDays = params.totalWorkingDays || DEFAULT_WORKING_DAYS;
    const lms = params.lastMonthSales || 0;
    const lmADS = ADSCalculator.calculateADS(lms, totalWorkingDays);
    const targetVolume = params.targetVolume || 0;
    const targetADS = ADSCalculator.calculateADS(targetVolume, totalWorkingDays);

    const std = STDCalculator.calculateSalesToDate(params.dailyVolumes);
    const daysElapsed = Math.max(1, params.activeDaysElapsed);
    const periodADS = ADSCalculator.calculateADS(std, daysElapsed);

    const remainingDays = Math.max(1, totalWorkingDays - daysElapsed);
    const remainingTarget = TargetCalculator.calculateRemainingTarget(targetVolume, std);
    const requiredRemainingADS = TargetCalculator.calculateRequiredRemainingADS(remainingTarget, remainingDays);

    const achievementPercentage = AchievementCalculator.calculateAchievement(std, targetVolume);
    const projectedSales = ProjectionCalculator.calculateProjectedSales(periodADS, totalWorkingDays);
    const growthPercentage = ProjectionCalculator.calculateGrowth(projectedSales, lms);
    const varianceVolume = VarianceCalculator.calculateVolumeVariance(std, targetVolume);

    return {
      territoryId: params.territoryId,
      territoryName: params.territoryName,
      regionName: params.regionName,
      lastMonthSales: lms,
      lastMonthADS: lmADS,
      targetVolume,
      targetADS,
      salesToDate: std,
      periodADS,
      remainingTarget,
      requiredRemainingADS,
      achievementPercentage,
      projectedSales,
      growthPercentage,
      varianceVolume,
    };
  }
}

export const calculationEngine = new CalculationEngine();
