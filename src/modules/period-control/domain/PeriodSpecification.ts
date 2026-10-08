// Domain: Period Control Specification
// Defines models for Year -> Month -> Date operational governance
// Conforms to AGENTS.md Rule 26 & AGENTS1.md Rule 4

export type YearStatus = 'ACTIVE' | 'CLOSED' | 'UPCOMING';
export type MonthStatus = 'OPEN' | 'CLOSED' | 'LOCKED' | 'FINALIZED';
export type DayStatus = 'OPEN' | 'CLOSED' | 'HOLIDAY';

export interface ReportingYear {
  id: string;
  company_id: string;
  company_name?: string;
  year: number;
  status: YearStatus;
  is_locked: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  total_months?: number;
  open_months?: number;
  total_working_days?: number;
}

export interface MonthlyPeriod {
  id: string;
  company_id: string;
  year: number;
  month: number;
  month_name?: string;
  working_days: number;
  status: MonthStatus;
  is_locked: boolean;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DailyPeriodDate {
  id: string;
  company_id: string;
  reporting_date: string; // YYYY-MM-DD
  year: number;
  month: number;
  day: number;
  is_working_day: boolean;
  is_locked: boolean;
  status: DayStatus;
  holiday_name?: string | null;
  created_at?: string;
  updated_at?: string;
}
