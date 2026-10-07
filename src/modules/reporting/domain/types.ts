// Domain: Reporting Aggregations & Performance Types
// Afaz Tobacco Sales & Stock Intelligence Platform

export interface ExecutiveKPISummary {
  totalMonthlyTarget: number;
  salesToDate: number;
  overallAchievement: number;
  closingStockVolume: number;
  stockCoverDays: number;
  activeWorkingDaysElapsed: number;
  totalWorkingDays: number;
  territoryCount: number;
}

export interface TerritoryPerformanceSummary {
  territoryId: string;
  territoryName: string;
  target: number;
  salesToDate: number;
  achievementPercentage: number;
  closingStock: number;
  periodADS: number;
}
