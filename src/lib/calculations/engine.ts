import { 
  CigaretteBrandSales, 
  CigaretteBrandStock, 
  ZardaSalesQty, 
  ZardaStockQty,
  TerritoryAnalysis,
  TerritoryTarget,
  DailyOperationalRecord
} from '../types';

export const ZARDA_UNIT_PRICES = {
  price_22_25: 15,
  price_99_14: 6,
  price_33_15: 8,
} as const;

export const DEFAULT_WORKING_DAYS = 26;

/**
 * Calculates total cigarette sales across standard brands.
 * Formula equivalent to =SUM(D8:I8)
 */
export function calculateCigaretteSalesTotal(sales: Partial<CigaretteBrandSales>): number {
  const sum = 
    (sales.wilson || 0) +
    (sales.shahara || 0) +
    (sales.express || 0) +
    (sales.nexus || 0) +
    (sales.sb || 0) +
    (sales.sm || 0);
  return Number(sum.toFixed(4));
}

/**
 * Calculates total cigarette closing stock across standard brands.
 * Formula equivalent to =SUM(K8:P8)
 */
export function calculateCigaretteStockTotal(stock: Partial<CigaretteBrandStock>): number {
  const sum = 
    (stock.wilson || 0) +
    (stock.shahara || 0) +
    (stock.express || 0) +
    (stock.nexus || 0) +
    (stock.sb || 0) +
    (stock.sm || 0);
  return Number(sum.toFixed(4));
}

/**
 * Calculates total Zarda sales valuation in BDT.
 * Formula equivalent to =S8*15+T8*6+U8*8
 */
export function calculateZardaSalesValuation(zarda: Partial<ZardaSalesQty>): number {
  const value = 
    ((zarda.qty_22_25 || 0) * ZARDA_UNIT_PRICES.price_22_25) +
    ((zarda.qty_99_14 || 0) * ZARDA_UNIT_PRICES.price_99_14) +
    ((zarda.qty_33_15 || 0) * ZARDA_UNIT_PRICES.price_33_15);
  return Number(value.toFixed(2));
}

/**
 * Calculates total Zarda closing stock valuation in BDT.
 * Formula equivalent to =Y8*15+Z8*6+AA8*8
 */
export function calculateZardaStockValuation(zarda: Partial<ZardaStockQty>): number {
  const value = 
    ((zarda.qty_22_25 || 0) * ZARDA_UNIT_PRICES.price_22_25) +
    ((zarda.qty_99_14 || 0) * ZARDA_UNIT_PRICES.price_99_14) +
    ((zarda.qty_33_15 || 0) * ZARDA_UNIT_PRICES.price_33_15);
  return Number(value.toFixed(2));
}

/**
 * Average Daily Sales (ADS) calculation.
 * ADS = Sales Volume / Configured Working Days
 */
export function calculateADS(volume: number, workingDays: number = DEFAULT_WORKING_DAYS): number {
  if (workingDays <= 0) return 0;
  return Number((volume / workingDays).toFixed(4));
}

/**
 * Achievement Percentage calculation.
 * Achievement % = (Sales-to-Date / Target) * 100
 */
export function calculateAchievementRate(std: number, target: number): number {
  if (target <= 0) return 0;
  return Number(((std / target) * 100).toFixed(2));
}

/**
 * Projected Sales Volume calculation based on current run rate.
 * Projection = Period ADS * Total Working Days
 */
export function calculateProjectedVolume(periodADS: number, workingDays: number = DEFAULT_WORKING_DAYS): number {
  return Number((periodADS * workingDays).toFixed(4));
}

/**
 * Growth Percentage calculation relative to last month's sales.
 * Growth % = ((Projected - LMS) / LMS) * 100
 */
export function calculateGrowthRate(projected: number, lastMonthSales: number): number {
  if (lastMonthSales <= 0) return 0;
  return Number((((projected - lastMonthSales) / lastMonthSales) * 100).toFixed(2));
}

/**
 * Builds full analysis metrics for a territory.
 */
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
  const lmADS = calculateADS(lms, totalWorkingDays);
  
  const targetVolume = params.target.totalTarget || 0;
  const targetADS = calculateADS(targetVolume, totalWorkingDays);
  
  // Aggregate sales to date (STD)
  const std = params.dailyRecords.reduce((acc, rec) => acc + (rec.totalCigaretteSales || 0), 0);
  
  const daysElapsed = Math.max(1, params.activeDaysElapsed);
  const periodADS = Number((std / daysElapsed).toFixed(4));
  
  const remainingDays = Math.max(1, totalWorkingDays - daysElapsed);
  const remainingTarget = Math.max(0, targetVolume - std);
  const requiredRemainingADS = Number((remainingTarget / remainingDays).toFixed(4));
  
  const achievementPercentage = calculateAchievementRate(std, targetVolume);
  const projectedSales = calculateProjectedVolume(periodADS, totalWorkingDays);
  const growthPercentage = calculateGrowthRate(projectedSales, lms);

  return {
    territoryId: params.territoryId,
    territoryName: params.territoryName,
    regionName: params.regionName,
    lastMonthSales: lms,
    lastMonthADS: lmADS,
    target: targetVolume,
    targetADS,
    salesToDate: Number(std.toFixed(4)),
    periodADS,
    requiredRemainingADS,
    achievementPercentage,
    projectedSales,
    growthPercentage,
  };
}
