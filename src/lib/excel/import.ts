// Secure XLSX Import Engine for Afaz Tobacco Platform
// Implements strict pre-flight validation and raw extraction from docs/07-IMPORT-SPEC.md

import ExcelJS from 'exceljs';
import { 
  DailyOperationalRecord, 
  CigaretteBrandSales, 
  CigaretteBrandStock, 
  ZardaSalesQty, 
  ZardaStockQty 
} from '../types';
import { 
  calculateCigaretteSalesTotal, 
  calculateCigaretteStockTotal, 
  calculateZardaSalesValuation, 
  calculateZardaStockValuation 
} from '../calculations/engine';
import { 
  verifyImportDateSafety, 
  DateVerificationResult 
} from './date-safety';
import { 
  WORKBOOK_SHEETS, 
  EXPECTED_SHEET_COUNT, 
  SATKANIA_TERRITORIES 
} from './template-mapping';

export interface ImportErrorDetail {
  sheet: string;
  row: number;
  column: string;
  field: string;
  invalidValue: unknown;
  expectedValue: string;
  reason: string;
}

export interface ImportPreviewPayload {
  isValid: boolean;
  dateVerification: DateVerificationResult;
  totalSheetsFound: number;
  totalValidRecords: number;
  records: DailyOperationalRecord[];
  errors: ImportErrorDetail[];
  warnings: string[];
}

/**
 * Validates and extracts records from an uploaded workbook buffer.
 */
export async function parseAndValidateXLSX(params: {
  buffer: Buffer;
  fileName: string;
  applicationDate: string; // YYYY-MM-DD
}): Promise<ImportPreviewPayload> {
  const errors: ImportErrorDetail[] = [];
  const warnings: string[] = [];
  const records: DailyOperationalRecord[] = [];

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(params.buffer as any);

  // 1. Validate Sheet Count & Order
  if (workbook.worksheets.length !== EXPECTED_SHEET_COUNT) {
    errors.push({
      sheet: 'Root',
      row: 0,
      column: 'N/A',
      field: 'sheetCount',
      invalidValue: workbook.worksheets.length,
      expectedValue: String(EXPECTED_SHEET_COUNT),
      reason: `Workbook has ${workbook.worksheets.length} sheets; expected exactly ${EXPECTED_SHEET_COUNT}.`,
    });
  }

  // 2. Determine target day from applicationDate
  const appDateParts = params.applicationDate.split('-').map(Number);
  const targetDay = appDateParts[2] || 1;
  const targetSheetName = String(targetDay);
  const targetSheet = workbook.getWorksheet(targetSheetName);

  if (!targetSheet) {
    errors.push({
      sheet: targetSheetName,
      row: 0,
      column: 'N/A',
      field: 'worksheet',
      invalidValue: null,
      expectedValue: targetSheetName,
      reason: `Target daily sheet '${targetSheetName}' not found in workbook.`,
    });
  }

  // 3. Date Safety Check
  const headerDateCell = targetSheet?.getCell('B5')?.text || '';
  const dateCheck = verifyImportDateSafety({
    applicationDate: params.applicationDate,
    fileName: params.fileName,
    headerDateText: headerDateCell,
    sheetNumber: targetDay,
  });

  if (!dateCheck.isValid) {
    for (const conflict of dateCheck.conflicts) {
      errors.push({
        sheet: targetSheetName,
        row: 5,
        column: 'B',
        field: 'dateValidation',
        invalidValue: headerDateCell,
        expectedValue: params.applicationDate,
        reason: conflict,
      });
    }
  }

  // 4. Extract Raw Data Rows if targetSheet is valid
  if (targetSheet && dateCheck.isValid) {
    for (const terr of SATKANIA_TERRITORIES) {
      const row = terr.row;

      const getNum = (col: string): number => {
        const cell = targetSheet.getCell(`${col}${row}`);
        const val = typeof cell.value === 'number' ? cell.value : Number(cell.text || 0);
        return isNaN(val) ? 0 : val;
      };

      const cigaretteSales: CigaretteBrandSales = {
        wilson: getNum('D'),
        shahara: getNum('E'),
        express: getNum('F'),
        nexus: getNum('G'),
        sb: getNum('H'),
        sm: getNum('I'),
      };

      const cigaretteStock: CigaretteBrandStock = {
        wilson: getNum('K'),
        shahara: getNum('L'),
        express: getNum('M'),
        nexus: getNum('N'),
        sb: getNum('O'),
        sm: getNum('P'),
      };

      const zardaSales: ZardaSalesQty = {
        slb: getNum('R'),
        qty_22_25: Math.round(getNum('S')),
        qty_99_14: Math.round(getNum('T')),
        qty_33_15: Math.round(getNum('U')),
      };

      const zardaStock: ZardaStockQty = {
        slb: getNum('X'),
        qty_22_25: Math.round(getNum('Y')),
        qty_99_14: Math.round(getNum('Z')),
        qty_33_15: Math.round(getNum('AA')),
      };

      const emptyPackets = Math.round(getNum('AD'));
      const remarks = targetSheet.getCell(`AE${row}`).text || '';

      // Recompute totals via centralized Calculation Engine (Do NOT trust Excel cached formulas)
      const totalSales = calculateCigaretteSalesTotal(cigaretteSales);
      const totalStock = calculateCigaretteStockTotal(cigaretteStock);
      const totalZardaSales = calculateZardaSalesValuation(zardaSales);
      const totalZardaStock = calculateZardaStockValuation(zardaStock);

      records.push({
        territoryId: `satkania-${terr.sl}`,
        territoryName: terr.name,
        regionName: 'Satkania',
        reportDate: params.applicationDate,
        dayNumber: targetDay,
        status: 'DRAFT',
        cigaretteSales,
        cigaretteStock,
        zardaSales,
        zardaStock,
        emptyPackets,
        remarks,
        totalCigaretteSales: totalSales,
        totalCigaretteStock: totalStock,
        totalZardaSalesValue: totalZardaSales,
        totalZardaStockValue: totalZardaStock,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    dateVerification: dateCheck,
    totalSheetsFound: workbook.worksheets.length,
    totalValidRecords: records.length,
    records,
    errors,
    warnings,
  };
}
