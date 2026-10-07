// Domain: Excel Export Specification
// Preserves authoritative sheet layout, row offsets, formulas, and 34 sheets

import { WORKBOOK_SHEETS, EXPECTED_SHEET_COUNT } from '@/shared/constants';

export { WORKBOOK_SHEETS, EXPECTED_SHEET_COUNT };

export interface MonthlyExportRequest {
  year: number;
  month: number;
  reportingDay: number;
  requestedBy: string;
}

export interface TerritoryExportRow {
  rowNumber: number;
  slNo: number;
  territoryName: string;
  regionName: string;
}

export const TEMPLATE_TERRITORY_ROWS: TerritoryExportRow[] = [
  { rowNumber: 8, slNo: 1, territoryName: 'Kerani hat', regionName: 'Satkania' },
  { rowNumber: 9, slNo: 2, territoryName: 'Satkania', regionName: 'Satkania' },
  { rowNumber: 10, slNo: 3, territoryName: 'Bandarban', regionName: 'Satkania' },
  { rowNumber: 11, slNo: 4, territoryName: 'Rajasthali', regionName: 'Satkania' },
  { rowNumber: 12, slNo: 5, territoryName: 'Dohazari', regionName: 'Satkania' },
];

export const TEMPLATE_TOTAL_ROW = 13;
