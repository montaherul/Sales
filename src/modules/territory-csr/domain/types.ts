// Domain Types: Territory CSR & Route Sales Intelligence
// Conforms to AGENTS.md dynamic hierarchy & formula rules

export interface RouteItem {
  id: string;
  territoryId: string;
  territoryName?: string;
  regionName?: string;
  name: string;
  code: string;
  csrId?: string | null;
  csrName: string;
  outletCount: number;
  sortOrder: number;
  isActive: boolean;
}

export interface RouteTarget {
  id?: string;
  routeId: string;
  routeName?: string;
  csrName?: string;
  year: number;
  month: number;
  targetCigarette: number;
  targetBidi: number;
  dailyTargetCigarette: number;
  dailyTargetBidi: number;
  totalMonthlyTarget: number;
  totalDailyTarget: number;
}

export interface TerritoryBenchmarks {
  territoryId: string;
  territoryName: string;
  regionName: string;
  year: number;
  month: number;
  lms: number;            // Last Month Sales
  lmAds: number;          // Last Month ADS
  workingDays: number;    // Standard 26 working days
  tmTarget: number;       // This Month Target (sum of routes)
  tmTargetAds: number;    // This Month Target ADS
}

export interface RouteDailySaleEntry {
  id?: string;
  routeId: string;
  routeName: string;
  csrName: string;
  reportDate: string;
  salesCigarette: number;
  salesBidi: number;
  totalSales: number;
  dailyTargetCigarette: number;
  dailyTargetBidi: number;
  totalDailyTarget: number;
  variance: number;
  achievementPct: number;
  remarks: string;
  performanceTier: 'Top Performer' | 'Achieved' | 'Near Target' | 'Needs Pacing';
}

export interface RoutePerformanceSummary {
  slNo: number;
  routeId: string;
  routeName: string;
  csrName: string;
  outletCount: number;
  monthlyTargetCigarette: number;
  monthlyTargetBidi: number;
  totalMonthlyTarget: number;
  dailyTargetCigarette: number;
  dailyTargetBidi: number;
  totalDailyTarget: number;
  mtdTargetToDate: number;
  actualSalesMtdCigarette: number;
  actualSalesMtdBidi: number;
  actualSalesMtdTotal: number;
  varianceMtd: number;
  atdaPct: number;
  ads: number;
  reqRunRate: number;
  projectedSales: number;
  projectedAchPct: number;
  rank: number;
  performanceTier: 'Top Performer' | 'Achieved' | 'Near Target' | 'Needs Pacing';
}

export interface TerritoryPerformanceOverview {
  territory: {
    id: string;
    name: string;
    regionName: string;
  };
  period: {
    year: number;
    month: number;
    day: number;
    monthName: string;
    reportingDate: string;
    workingDaysTotal: number;
    workingDaysElapsed: number;
    workingDaysRemaining: number;
  };
  benchmarks: TerritoryBenchmarks;
  routes: RoutePerformanceSummary[];
  dailySalesForSelectedDate: RouteDailySaleEntry[];
  territoryTotals: {
    totalMonthlyTarget: number;
    mtdTargetToDate: number;
    actualSalesMtdTotal: number;
    actualSalesMtdCigarette: number;
    actualSalesMtdBidi: number;
    varianceMtd: number;
    overallAtdaPct: number;
    ads: number;
    reqRunRate: number;
    monthEndProjectedSales: number;
    projectedAchPct: number;
    pacingStatus: 'Above Target' | 'Pacing Required' | 'Needs Pacing' | 'Overall Achieved';
  };
}
