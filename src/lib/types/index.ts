// Domain Models & Types for Afaz Tobacco Sales & Stock Intelligence Platform

export type RoleType = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'RSO' | 'TSO' | 'CSR';

export type SubmissionStatus = 
  | 'DRAFT' 
  | 'SUBMITTED' 
  | 'TSO_APPROVED' 
  | 'RSO_APPROVED' 
  | 'FINALIZED' 
  | 'REJECTED';

export type ProductType = 'CIGARETTE' | 'ZARDA' | 'EMPTY_PACKET';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: RoleType;
  isActive: boolean;
  scopes: UserScope[];
}

export interface UserScope {
  id: string;
  userId: string;
  companyId?: string;
  divisionId?: string;
  wingId?: string;
  regionId?: string;
  territoryId?: string;
  routeId?: string;
}

export interface Territory {
  id: string;
  regionId: string;
  name: string;
  sortOrder: number;
}

export interface Region {
  id: string;
  wingId: string;
  name: string;
  territories: Territory[];
}

export interface CigaretteBrandSales {
  wilson: number;
  shahara: number;
  express: number;
  nexus: number;
  sb: number;
  sm: number;
}

export interface CigaretteBrandStock {
  wilson: number;
  shahara: number;
  express: number;
  nexus: number;
  sb: number;
  sm: number;
}

export interface ZardaSalesQty {
  slb: number;
  qty_22_25: number;
  qty_99_14: number;
  qty_33_15: number;
}

export interface ZardaStockQty {
  slb: number;
  qty_22_25: number;
  qty_99_14: number;
  qty_33_15: number;
}

export interface DailyOperationalRecord {
  id?: string;
  territoryId: string;
  territoryName: string;
  regionName: string;
  reportDate: string; // YYYY-MM-DD
  dayNumber: number; // 1 to 31
  status: SubmissionStatus;
  cigaretteSales: CigaretteBrandSales;
  cigaretteStock: CigaretteBrandStock;
  zardaSales: ZardaSalesQty;
  zardaStock: ZardaStockQty;
  emptyPackets: number;
  remarks?: string;
  // Calculated fields
  totalCigaretteSales: number;
  totalCigaretteStock: number;
  totalZardaSalesValue: number;
  totalZardaStockValue: number;
}

export interface TerritoryTarget {
  id?: string;
  territoryId: string;
  year: number;
  month: number;
  cigaretteTargets: CigaretteBrandSales;
  totalTarget: number;
  targetADS: number;
  routeCount: number;
  outletCount: number;
}

export interface TerritoryAnalysis {
  territoryId: string;
  territoryName: string;
  regionName: string;
  lastMonthSales: number;
  lastMonthADS: number;
  target: number;
  targetADS: number;
  salesToDate: number; // STD
  periodADS: number;
  requiredRemainingADS: number;
  achievementPercentage: number;
  projectedSales: number;
  growthPercentage: number;
}

export interface MonthlyWorkbookData {
  year: number;
  month: number; // 1-12
  monthName: string;
  reportDate: string;
  divisionName: string;
  wingName: string;
  workingDays: number;
  regions: Region[];
  dailyRecords: Record<number, DailyOperationalRecord[]>; // Keyed by day 1..31
  targets: Record<string, TerritoryTarget>; // Keyed by territoryId
  analysis: Record<string, TerritoryAnalysis>; // Keyed by territoryId
}
