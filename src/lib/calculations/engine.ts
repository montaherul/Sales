// Backward Compatible Delegation to Centralized Calculation Engine
// Afaz Tobacco Sales & Stock Intelligence Platform

import { 
  CigaretteBrandSales, 
  CigaretteBrandStock, 
  ZardaSalesQty, 
  ZardaStockQty,
  TerritoryAnalysis,
  TerritoryTarget,
  DailyOperationalRecord
} from '../types';
import {
  SalesCalculator,
  StockCalculator,
  ZardaCalculator,
  ADSCalculator,
  AchievementCalculator,
  ProjectionCalculator,
  STDCalculator,
  TargetCalculator,
  VarianceCalculator,
} from '@/modules/calculation';
import { ZARDA_UNIT_PRICES, DEFAULT_WORKING_DAYS } from '@/shared/constants';

export { ZARDA_UNIT_PRICES, DEFAULT_WORKING_DAYS };

export function calculateCigaretteSalesTotal(sales: Partial<CigaretteBrandSales>): number {
  return SalesCalculator.calculateTotal(sales as any);
}

export function calculateCigaretteStockTotal(stock: Partial<CigaretteBrandStock>): number {
  return StockCalculator.calculateTotal(stock as any);
}

export function calculateZardaSalesValuation(
  zarda: Partial<ZardaSalesQty>,
  customPrices?: { price_22_25?: number; price_99_14?: number; price_33_15?: number }
): number {
  return ZardaCalculator.calculateSalesValuation(zarda as any, customPrices);
}

export function calculateZardaStockValuation(
  zarda: Partial<ZardaStockQty>,
  customPrices?: { price_22_25?: number; price_99_14?: number; price_33_15?: number }
): number {
  return ZardaCalculator.calculateStockValuation(zarda as any, customPrices);
}

export function calculateADS(volume: number, workingDays: number = DEFAULT_WORKING_DAYS): number {
  return ADSCalculator.calculateADS(volume, workingDays);
}

export function calculateAchievementRate(std: number, target: number): number {
  return AchievementCalculator.calculateAchievement(std, target);
}

export function calculateProjectedVolume(periodADS: number, workingDays: number = DEFAULT_WORKING_DAYS): number {
  return ProjectionCalculator.calculateProjectedSales(periodADS, workingDays);
}

export function calculateGrowthRate(projected: number, lastMonthSales: number): number {
  return ProjectionCalculator.calculateGrowth(projected, lastMonthSales);
}

export function buildTerritoryAnalysis(params: {
  territoryId: string;
  territoryName: string;
  regionName: string;
  lastMonthSales: number;
  target: TerritoryTarget;
  dailyRecords: DailyOperationalRecord[];
  activeDaysElapsed: number;
  totalWorkingDays?: number;
}): TerritoryAnalysis {
  const totalWorkingDays = params.totalWorkingDays || DEFAULT_WORKING_DAYS;
  const lms = params.lastMonthSales || 0;
  const lmADS = ADSCalculator.calculateADS(lms, totalWorkingDays);
  
  const targetVolume = params.target.totalTarget || 0;
  const targetADS = ADSCalculator.calculateADS(targetVolume, totalWorkingDays);
  
  const dailyVolumes = params.dailyRecords.map((r) => r.totalCigaretteSales || 0);
  const std = STDCalculator.calculateSalesToDate(dailyVolumes);
  
  const daysElapsed = Math.max(1, params.activeDaysElapsed);
  const periodADS = ADSCalculator.calculateADS(std, daysElapsed);
  
  const remainingDays = Math.max(1, totalWorkingDays - daysElapsed);
  const remainingTarget = TargetCalculator.calculateRemainingTarget(targetVolume, std);
  const requiredRemainingADS = TargetCalculator.calculateRequiredRemainingADS(remainingTarget, remainingDays);
  
  const achievementPercentage = AchievementCalculator.calculateAchievement(std, targetVolume);
  const projectedSales = ProjectionCalculator.calculateProjectedSales(periodADS, totalWorkingDays);
  const growthPercentage = ProjectionCalculator.calculateGrowth(projectedSales, lms);

  return {
    territoryId: params.territoryId,
    territoryName: params.territoryName,
    regionName: params.regionName,
    lastMonthSales: lms,
    lastMonthADS: lmADS,
    target: targetVolume,
    targetADS,
    salesToDate: std,
    periodADS,
    requiredRemainingADS,
    achievementPercentage,
    projectedSales,
    growthPercentage,
  };
}
