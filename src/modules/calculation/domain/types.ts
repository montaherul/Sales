// Domain: Calculation Models and Interfaces
// Afaz Tobacco Sales & Stock Intelligence Platform

export interface BrandSalesInput {
  wilson?: number;
  shahara?: number;
  express?: number;
  nexus?: number;
  sb?: number;
  sm?: number;
}

export interface BrandStockInput {
  wilson?: number;
  shahara?: number;
  express?: number;
  nexus?: number;
  sb?: number;
  sm?: number;
}

export interface ZardaSalesInput {
  slb?: number;
  qty_22_25?: number;
  qty_99_14?: number;
  qty_33_15?: number;
}

export interface ZardaStockInput {
  slb?: number;
  qty_22_25?: number;
  qty_99_14?: number;
  qty_33_15?: number;
}

export interface TerritoryPerformanceMetrics {
  territoryId: string;
  territoryName: string;
  regionName: string;
  lastMonthSales: number;
  lastMonthADS: number;
  targetVolume: number;
  targetADS: number;
  salesToDate: number;
  periodADS: number;
  remainingTarget: number;
  requiredRemainingADS: number;
  achievementPercentage: number;
  projectedSales: number;
  growthPercentage: number;
  varianceVolume: number;
}
