// Secure XLSX Import Engine for Afaz Tobacco Platform
// Implements strict pre-flight validation, multi-tab date matching, and raw extraction from docs/07-IMPORT-SPEC.md

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
  DateVerificationResult,
  parseHeaderCellDate,
  extractDateFromFilename
} from './date-safety';
import { 
  WORKBOOK_SHEETS, 
  EXPECTED_SHEET_COUNT, 
  SATKANIA_TERRITORIES 
} from './template-mapping';
import { SubmissionRepository } from '../repositories/submission.repository';

export interface AvailableSheetInfo {
  name: string;
  index: number;
  headerDate?: string;
  resolvedDate?: string;
  hasData: boolean;
}

export interface ImportSummary {
  totalRecords: number;
  newRecordsCount: number;
  revisionRecordsCount: number;
  totalCigaretteSales: number;
  totalCigaretteStock: number;
  totalZardaSalesValue: number;
  totalZardaStockValue: number;
  totalEmptyPackets: number;
}

export interface MatchedSheetInfo {
  name: string;
  index: number;
  matchMethod: 'FIRST_TAB_MATCH' | 'SEARCHED_TAB_MATCH';
  headerDateText: string;
  resolvedDate: string;
}

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
  targetDate: string;
  matchedSheet: MatchedSheetInfo;
  availableSheets: AvailableSheetInfo[];
  summary: ImportSummary;
  dateVerification: DateVerificationResult;
  totalSheetsFound: number;
  totalValidRecords: number;
  duplicateTerritories: string[];
  records: DailyOperationalRecord[];
  errors: ImportErrorDetail[];
  warnings: string[];
}

/**
 * Safely extracts string text from an ExcelJS cell without throwing on merged cells or formula cells.
 */
export function safeGetCellString(cell: ExcelJS.Cell | null | undefined): string {
  if (!cell) return '';
  try {
    const val = cell.value;
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val.trim();
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (val instanceof Date) return val.toISOString();
    if (typeof val === 'object') {
      if ('result' in val && val.result != null) return String(val.result).trim();
      if ('richText' in val && Array.isArray((val as any).richText)) {
        return (val as any).richText.map((rt: any) => rt.text || '').join('').trim();
      }
      if ('text' in val && typeof (val as any).text === 'string') {
        return (val as any).text.trim();
      }
    }
    return (cell.text || '').trim();
  } catch {
    return '';
  }
}

/**
 * Safely extracts a numeric value from an ExcelJS cell, validating against negative numbers or unparseable formats.
 */
export function safeGetCellNumber(
  cell: ExcelJS.Cell | null | undefined,
  meta: { sheet: string; row: number; column: string; field: string }
): { value: number; error?: ImportErrorDetail } {
  if (!cell) return { value: 0 };
  try {
    const val = cell.value;
    if (val === null || val === undefined) return { value: 0 };

    if (typeof val === 'number') {
      if (val < 0) {
        return {
          value: 0,
          error: {
            sheet: meta.sheet,
            row: meta.row,
            column: meta.column,
            field: meta.field,
            invalidValue: val,
            expectedValue: 'Non-negative number (>= 0)',
            reason: `Negative value ${val} is not permitted for sales or stock.`,
          },
        };
      }
      return { value: isNaN(val) ? 0 : val };
    }

    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) return { value: 0 };
      const parsed = parseFloat(trimmed);
      if (isNaN(parsed)) {
        return {
          value: 0,
          error: {
            sheet: meta.sheet,
            row: meta.row,
            column: meta.column,
            field: meta.field,
            invalidValue: val,
            expectedValue: 'Numeric value',
            reason: `Cannot parse non-numeric text "${val}" as a number.`,
          },
        };
      }
      if (parsed < 0) {
        return {
          value: 0,
          error: {
            sheet: meta.sheet,
            row: meta.row,
            column: meta.column,
            field: meta.field,
            invalidValue: parsed,
            expectedValue: 'Non-negative number (>= 0)',
            reason: `Negative value ${parsed} is not permitted for sales or stock.`,
          },
        };
      }
      return { value: parsed };
    }

    if (typeof val === 'object') {
      if ('result' in val) {
        const res = val.result;
        if (typeof res === 'number') {
          if (res < 0) {
            return {
              value: 0,
              error: {
                sheet: meta.sheet,
                row: meta.row,
                column: meta.column,
                field: meta.field,
                invalidValue: res,
                expectedValue: 'Non-negative number (>= 0)',
                reason: `Formula result is negative: ${res}.`,
              },
            };
          }
          return { value: isNaN(res) ? 0 : res };
        }
        if (typeof res === 'string') {
          const parsed = parseFloat(res.trim());
          if (isNaN(parsed)) {
            return {
              value: 0,
              error: {
                sheet: meta.sheet,
                row: meta.row,
                column: meta.column,
                field: meta.field,
                invalidValue: res,
                expectedValue: 'Numeric formula result',
                reason: `Formula evaluated to non-numeric: "${res}".`,
              },
            };
          }
          return { value: parsed };
        }
      }
    }

    const txt = (cell.text || '').trim();
    if (!txt) return { value: 0 };
    const parsed = parseFloat(txt);
    if (isNaN(parsed)) {
      return {
        value: 0,
        error: {
          sheet: meta.sheet,
          row: meta.row,
          column: meta.column,
          field: meta.field,
          invalidValue: txt,
          expectedValue: 'Numeric value',
          reason: `Cannot parse cell text "${txt}" as a number.`,
        },
      };
    }
    return { value: parsed < 0 ? 0 : parsed };
  } catch (err: any) {
    return {
      value: 0,
      error: {
        sheet: meta.sheet,
        row: meta.row,
        column: meta.column,
        field: meta.field,
        invalidValue: null,
        expectedValue: 'Numeric value',
        reason: `Failed to read cell: ${err.message}`,
      },
    };
  }
}

/**
 * Validates, finds matching tab, extracts records, and prepares interactive review preview.
 */
export async function parseAndValidateXLSX(params: {
  buffer: Buffer;
  fileName: string;
  applicationDate?: string; // YYYY-MM-DD
  sheetName?: string;
}): Promise<ImportPreviewPayload> {
  const errors: ImportErrorDetail[] = [];
  const warnings: string[] = [];
  const records: DailyOperationalRecord[] = [];
  const duplicateTerritories: string[] = [];

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(params.buffer as any);

  // 1. Inspect all sheets in workbook to index available tabs & detect dates
  const availableSheets: AvailableSheetInfo[] = [];
  for (let i = 0; i < workbook.worksheets.length; i++) {
    const ws = workbook.worksheets[i];
    const b5Text = safeGetCellString(ws.getCell('B5'));
    const parsedB5 = parseHeaderCellDate(b5Text);
    const resolvedD = parsedB5 && parsedB5.year && parsedB5.month && parsedB5.day
      ? `${parsedB5.year}-${String(parsedB5.month).padStart(2, '0')}-${String(parsedB5.day).padStart(2, '0')}`
      : undefined;

    // Check if rows 8 to 12 have data
    let hasData = false;
    for (let r = 8; r <= 12; r++) {
      if (ws.getCell(`D${r}`).value !== null || ws.getCell(`K${r}`).value !== null) {
        hasData = true;
        break;
      }
    }

    availableSheets.push({
      name: ws.name,
      index: i,
      headerDate: b5Text,
      resolvedDate: resolvedD,
      hasData,
    });
  }

  // 2. Resolve targetDate
  let targetDate = (params.applicationDate || '').trim();
  if (!targetDate) {
    // Auto-detect from filename first
    const fromFilename = extractDateFromFilename(params.fileName);
    if (fromFilename?.year && fromFilename?.month && fromFilename?.day) {
      targetDate = `${fromFilename.year}-${String(fromFilename.month).padStart(2, '0')}-${String(fromFilename.day).padStart(2, '0')}`;
    } else {
      // Or auto-detect from first sheet's B5
      const firstSheetResolved = availableSheets[0]?.resolvedDate;
      if (firstSheetResolved) {
        targetDate = firstSheetResolved;
      }
    }
  }

  if (!targetDate) {
    errors.push({
      sheet: 'Root',
      row: 0,
      column: 'N/A',
      field: 'date',
      invalidValue: null,
      expectedValue: 'YYYY-MM-DD',
      reason: 'No reporting date provided and could not auto-detect date from filename or workbook header.',
    });
    targetDate = new Date().toISOString().split('T')[0];
  }

  const appDateParts = targetDate.split('-').map(Number);
  const targetYear = appDateParts[0];
  const targetMonth = appDateParts[1];
  const targetDay = appDateParts[2] || 1;

  // 3. Tab Finding Workflow:
  // "find first tab and match date if not.. find tab that date and aslo check that date"
  let targetSheet: ExcelJS.Worksheet | null = null;
  let matchMethod: 'FIRST_TAB_MATCH' | 'SEARCHED_TAB_MATCH' = 'FIRST_TAB_MATCH';

  // If user explicitly requested a specific sheet by name
  if (params.sheetName) {
    targetSheet = workbook.getWorksheet(params.sheetName) || null;
    matchMethod = 'SEARCHED_TAB_MATCH';
  }

  const firstSheet = workbook.worksheets[0];
  const firstSheetDate = availableSheets[0]?.resolvedDate;
  const firstSheetB5 = parseHeaderCellDate(availableSheets[0]?.headerDate || '');

  if (!targetSheet && firstSheet) {
    // Check if first tab matches targetDate
    const firstMatches = 
      (firstSheetDate && firstSheetDate === targetDate) ||
      (firstSheetB5 && firstSheetB5.day === targetDay && (!firstSheetB5.month || firstSheetB5.month === targetMonth)) ||
      (firstSheet.name === String(targetDay));

    if (firstMatches) {
      targetSheet = firstSheet;
      matchMethod = 'FIRST_TAB_MATCH';
    }
  }

  // If first tab does NOT match, find the tab that matches targetDate!
  if (!targetSheet) {
    matchMethod = 'SEARCHED_TAB_MATCH';
    // a) Search for sheet whose B5 header date matches targetDate
    for (let i = 0; i < workbook.worksheets.length; i++) {
      const ws = workbook.worksheets[i];
      const parsed = parseHeaderCellDate(safeGetCellString(ws.getCell('B5')));
      if (parsed && parsed.day === targetDay && (!parsed.month || parsed.month === targetMonth) && (!parsed.year || parsed.year === targetYear)) {
        targetSheet = ws;
        break;
      }
    }

    // b) If still not found, search by sheet name = dayNumber (e.g. '6')
    if (!targetSheet) {
      targetSheet = workbook.getWorksheet(String(targetDay)) || null;
    }

    // c) If still not found, search by sheet name containing dayNumber or date
    if (!targetSheet) {
      for (const ws of workbook.worksheets) {
        const cleanName = ws.name.toLowerCase();
        if (cleanName.includes(`day ${targetDay}`) || cleanName.includes(`day-${targetDay}`) || cleanName.includes(targetDate)) {
          targetSheet = ws;
          break;
        }
      }
    }
  }

  if (!targetSheet) {
    errors.push({
      sheet: 'Unknown',
      row: 0,
      column: 'B5',
      field: 'sheetSelection',
      invalidValue: availableSheets[0]?.name || 'N/A',
      expectedValue: `Sheet for ${targetDate} (Day ${targetDay})`,
      reason: `Could not find a worksheet matching date ${targetDate}. Checked first sheet '${firstSheet?.name}' and all ${workbook.worksheets.length} sheets.`,
    });
  }

  // 4. "and aslo check that date"
  // Run Date Safety check against the matched worksheet!
  const matchedSheetHeaderDate = targetSheet ? safeGetCellString(targetSheet.getCell('B5')) : '';
  const dateCheck = verifyImportDateSafety({
    applicationDate: targetDate,
    fileName: params.fileName,
    headerDateText: matchedSheetHeaderDate,
    sheetNumber: !isNaN(Number(targetSheet?.name)) ? Number(targetSheet?.name) : targetDay,
  });

  if (!dateCheck.isValid) {
    for (const conflict of dateCheck.conflicts) {
      errors.push({
        sheet: targetSheet?.name || 'Active',
        row: 5,
        column: 'B',
        field: 'dateValidation',
        invalidValue: matchedSheetHeaderDate,
        expectedValue: targetDate,
        reason: conflict,
      });
    }
  }

  // 5. Structure validation (check 34 sheets if full monthly workbook, or check daily sheet structure)
  if (workbook.worksheets.length === EXPECTED_SHEET_COUNT) {
    for (let idx = 0; idx < WORKBOOK_SHEETS.length; idx++) {
      const expectedName = WORKBOOK_SHEETS[idx];
      const actualSheet = workbook.worksheets[idx];
      if (actualSheet && actualSheet.name !== expectedName) {
        warnings.push(`Workbook sheet #${idx + 1} is named '${actualSheet.name}'; expected '${expectedName}'.`);
      }
    }
  }

  // 6. Duplicate Record Detection (Rule 16)
  const existingSubmissions = await SubmissionRepository.getSubmissions({
    date: targetDate,
  });
  const existingTerritoryIds = new Set(existingSubmissions.map((s) => s.territoryId));

  // 7. Extract Raw Data Rows from targetSheet
  if (targetSheet && dateCheck.isValid) {
    for (const terr of SATKANIA_TERRITORIES) {
      const row = terr.row;

      // Validate Territory name in Column C
      const cellTerritoryName = safeGetCellString(targetSheet.getCell(`C${row}`));
      if (cellTerritoryName && cellTerritoryName.toLowerCase() !== terr.name.toLowerCase()) {
        warnings.push(
          `Row ${row}: Column C contains '${cellTerritoryName}', expected '${terr.name}'.`
        );
      }

      // Safe number extractor helper
      const extractNum = (col: string, field: string): number => {
        const res = safeGetCellNumber(targetSheet.getCell(`${col}${row}`), {
          sheet: targetSheet.name,
          row,
          column: col,
          field,
        });
        if (res.error) {
          errors.push(res.error);
        }
        return res.value;
      };

      const cigaretteSales: CigaretteBrandSales = {
        wilson: extractNum('D', 'cigaretteSales.wilson'),
        shahara: extractNum('E', 'cigaretteSales.shahara'),
        express: extractNum('F', 'cigaretteSales.express'),
        nexus: extractNum('G', 'cigaretteSales.nexus'),
        sb: extractNum('H', 'cigaretteSales.sb'),
        sm: extractNum('I', 'cigaretteSales.sm'),
      };

      const cigaretteStock: CigaretteBrandStock = {
        wilson: extractNum('K', 'cigaretteStock.wilson'),
        shahara: extractNum('L', 'cigaretteStock.shahara'),
        express: extractNum('M', 'cigaretteStock.express'),
        nexus: extractNum('N', 'cigaretteStock.nexus'),
        sb: extractNum('O', 'cigaretteStock.sb'),
        sm: extractNum('P', 'cigaretteStock.sm'),
      };

      const zardaSales: ZardaSalesQty = {
        slb: extractNum('R', 'zardaSales.slb'),
        qty_22_25: Math.round(extractNum('S', 'zardaSales.qty_22_25')),
        qty_99_14: Math.round(extractNum('T', 'zardaSales.qty_99_14')),
        qty_33_15: Math.round(extractNum('U', 'zardaSales.qty_33_15')),
      };

      const zardaStock: ZardaStockQty = {
        slb: extractNum('X', 'zardaStock.slb'),
        qty_22_25: Math.round(extractNum('Y', 'zardaStock.qty_22_25')),
        qty_99_14: Math.round(extractNum('Z', 'zardaStock.qty_99_14')),
        qty_33_15: Math.round(extractNum('AA', 'zardaStock.qty_33_15')),
      };

      const emptyPackets = Math.round(extractNum('AD', 'emptyPackets'));
      const remarks = safeGetCellString(targetSheet.getCell(`AE${row}`));

      // Recompute totals via centralized Calculation Engine (Do NOT trust Excel cached formulas - Rule 15)
      const totalSales = calculateCigaretteSalesTotal(cigaretteSales);
      const totalStock = calculateCigaretteStockTotal(cigaretteStock);
      const totalZardaSales = calculateZardaSalesValuation(zardaSales);
      const totalZardaStock = calculateZardaStockValuation(zardaStock);

      const territoryId = `satkania-${terr.sl}`;
      const isDuplicate = existingTerritoryIds.has(territoryId);
      if (isDuplicate) {
        duplicateTerritories.push(territoryId);
      }

      records.push({
        territoryId,
        territoryName: terr.name,
        regionName: 'Satkania',
        reportDate: targetDate,
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

  // 8. Calculate executive summary for review
  let totalCigaretteSales = 0;
  let totalCigaretteStock = 0;
  let totalZardaSalesValue = 0;
  let totalZardaStockValue = 0;
  let totalEmptyPackets = 0;
  let revisionRecordsCount = 0;

  for (const r of records) {
    totalCigaretteSales += r.totalCigaretteSales;
    totalCigaretteStock += r.totalCigaretteStock;
    totalZardaSalesValue += r.totalZardaSalesValue;
    totalZardaStockValue += r.totalZardaStockValue;
    totalEmptyPackets += r.emptyPackets;
    if (existingTerritoryIds.has(r.territoryId)) {
      revisionRecordsCount++;
    }
  }

  const summary: ImportSummary = {
    totalRecords: records.length,
    newRecordsCount: records.length - revisionRecordsCount,
    revisionRecordsCount,
    totalCigaretteSales: Number(totalCigaretteSales.toFixed(2)),
    totalCigaretteStock: Number(totalCigaretteStock.toFixed(2)),
    totalZardaSalesValue,
    totalZardaStockValue,
    totalEmptyPackets,
  };

  const matchedSheet: MatchedSheetInfo = {
    name: targetSheet?.name || 'N/A',
    index: targetSheet ? availableSheets.findIndex((s) => s.name === targetSheet?.name) : -1,
    matchMethod,
    headerDateText: matchedSheetHeaderDate,
    resolvedDate: targetDate,
  };

  return {
    isValid: errors.length === 0,
    targetDate,
    matchedSheet,
    availableSheets: availableSheets.filter((s) => s.hasData || s.resolvedDate || !isNaN(Number(s.name))),
    summary,
    dateVerification: dateCheck,
    totalSheetsFound: workbook.worksheets.length,
    totalValidRecords: records.length,
    duplicateTerritories,
    records,
    errors,
    warnings,
  };
}

export interface SingleDateParsedBatch {
  dateStr: string;
  dayNumber: number;
  sheetName: string;
  headerDateText: string;
  records: DailyOperationalRecord[];
  summary: ImportSummary;
  isValid: boolean;
  errors: ImportErrorDetail[];
}

export interface MultiDateImportPayload {
  isValid: boolean;
  fileName: string;
  baseYear: number;
  baseMonth: number;
  totalSheetsFound: number;
  totalDatesFound: number;
  dates: SingleDateParsedBatch[];
  overallSummary: {
    totalDates: number;
    totalRecords: number;
    totalCigaretteSales: number;
    totalCigaretteStock: number;
    totalZardaSalesValue: number;
    totalZardaStockValue: number;
    totalEmptyPackets: number;
  };
  errors: ImportErrorDetail[];
  warnings: string[];
}

/**
 * Parses multiple dates/tabs from a single 34-tab monthly workbook.
 * Does not mutate or affect existing single-date workflows.
 */
export async function parseMultiDateXLSX(params: {
  buffer: Buffer;
  fileName: string;
  applicationYearMonth?: string; // YYYY-MM
}): Promise<MultiDateImportPayload> {
  const errors: ImportErrorDetail[] = [];
  const warnings: string[] = [];

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(params.buffer as any);

  // 1. Establish Base Year & Month
  let baseYear = 0;
  let baseMonth = 0;

  if (params.applicationYearMonth && params.applicationYearMonth.includes('-')) {
    const parts = params.applicationYearMonth.split('-').map(Number);
    baseYear = parts[0];
    baseMonth = parts[1];
  }

  if (!baseYear || !baseMonth) {
    const fromFilename = extractDateFromFilename(params.fileName);
    if (fromFilename?.year && fromFilename?.month) {
      baseYear = fromFilename.year;
      baseMonth = fromFilename.month;
    }
  }

  // Fallback: Inspect first sheet cell B5
  if (!baseYear || !baseMonth) {
    for (const ws of workbook.worksheets) {
      const b5 = safeGetCellString(ws.getCell('B5'));
      const parsed = parseHeaderCellDate(b5);
      if (parsed?.year && parsed?.month) {
        baseYear = parsed.year;
        baseMonth = parsed.month;
        break;
      }
    }
  }

  // Ultimate fallback to current year and month
  if (!baseYear || !baseMonth) {
    const now = new Date();
    baseYear = now.getFullYear();
    baseMonth = now.getMonth() + 1;
  }

  const parsedDates: SingleDateParsedBatch[] = [];

  // 2. Iterate through all worksheets looking for daily sheets (Tabs '1'..'31')
  for (let i = 0; i < workbook.worksheets.length; i++) {
    const ws = workbook.worksheets[i];
    const sheetNameLower = ws.name.toLowerCase().trim();

    // Skip summary / analysis sheets
    if (
      sheetNameLower.includes('std') ||
      sheetNameLower.includes('target') ||
      sheetNameLower.includes('analysis')
    ) {
      continue;
    }

    const b5Text = safeGetCellString(ws.getCell('B5'));
    const parsedB5 = parseHeaderCellDate(b5Text);

    let dayNumber = parseInt(ws.name.trim(), 10);
    if (isNaN(dayNumber) || dayNumber < 1 || dayNumber > 31) {
      if (parsedB5?.day && parsedB5.day >= 1 && parsedB5.day <= 31) {
        dayNumber = parsedB5.day;
      } else {
        continue;
      }
    }

    const sheetYear = parsedB5?.year || baseYear;
    const sheetMonth = parsedB5?.month || baseMonth;
    const dateStr = `${sheetYear}-${String(sheetMonth).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;

    const sheetErrors: ImportErrorDetail[] = [];
    const sheetRecords: DailyOperationalRecord[] = [];

    // Extract records for all 5 Satkania territories
    for (const terr of SATKANIA_TERRITORIES) {
      const row = terr.row;

      const extractNum = (col: string, field: string): number => {
        const res = safeGetCellNumber(ws.getCell(`${col}${row}`), {
          sheet: ws.name,
          row,
          column: col,
          field,
        });
        if (res.error) {
          sheetErrors.push(res.error);
        }
        return res.value;
      };

      const cigaretteSales: CigaretteBrandSales = {
        wilson: extractNum('D', 'cigaretteSales.wilson'),
        shahara: extractNum('E', 'cigaretteSales.shahara'),
        express: extractNum('F', 'cigaretteSales.express'),
        nexus: extractNum('G', 'cigaretteSales.nexus'),
        sb: extractNum('H', 'cigaretteSales.sb'),
        sm: extractNum('I', 'cigaretteSales.sm'),
      };

      const cigaretteStock: CigaretteBrandStock = {
        wilson: extractNum('K', 'cigaretteStock.wilson'),
        shahara: extractNum('L', 'cigaretteStock.shahara'),
        express: extractNum('M', 'cigaretteStock.express'),
        nexus: extractNum('N', 'cigaretteStock.nexus'),
        sb: extractNum('O', 'cigaretteStock.sb'),
        sm: extractNum('P', 'cigaretteStock.sm'),
      };

      const zardaSales: ZardaSalesQty = {
        slb: extractNum('R', 'zardaSales.slb'),
        qty_22_25: Math.round(extractNum('S', 'zardaSales.qty_22_25')),
        qty_99_14: Math.round(extractNum('T', 'zardaSales.qty_99_14')),
        qty_33_15: Math.round(extractNum('U', 'zardaSales.qty_33_15')),
      };

      const zardaStock: ZardaStockQty = {
        slb: extractNum('W', 'zardaStock.slb'),
        qty_22_25: Math.round(extractNum('X', 'zardaStock.qty_22_25')),
        qty_99_14: Math.round(extractNum('Y', 'zardaStock.qty_99_14')),
        qty_33_15: Math.round(extractNum('Z', 'zardaStock.qty_33_15')),
      };

      const emptyPackets = Math.round(extractNum('AB', 'emptyPackets'));
      const remarks = safeGetCellString(ws.getCell(`AC${row}`));

      const totalSales = calculateCigaretteSalesTotal(cigaretteSales);
      const totalStock = calculateCigaretteStockTotal(cigaretteStock);
      const totalZardaSales = calculateZardaSalesValuation(zardaSales);
      const totalZardaStock = calculateZardaStockValuation(zardaStock);

      const territoryId = `satkania-${terr.sl}`;

      sheetRecords.push({
        territoryId,
        territoryName: terr.name,
        regionName: 'Satkania',
        reportDate: dateStr,
        dayNumber,
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

    // Compute summary for this specific date
    let daySales = 0;
    let dayStock = 0;
    let dayZardaSales = 0;
    let dayZardaStock = 0;
    let dayPackets = 0;

    for (const r of sheetRecords) {
      daySales += r.totalCigaretteSales;
      dayStock += r.totalCigaretteStock;
      dayZardaSales += r.totalZardaSalesValue;
      dayZardaStock += r.totalZardaStockValue;
      dayPackets += r.emptyPackets;
    }

    const daySummary: ImportSummary = {
      totalRecords: sheetRecords.length,
      newRecordsCount: sheetRecords.length,
      revisionRecordsCount: 0,
      totalCigaretteSales: Number(daySales.toFixed(2)),
      totalCigaretteStock: Number(dayStock.toFixed(2)),
      totalZardaSalesValue: dayZardaSales,
      totalZardaStockValue: dayZardaStock,
      totalEmptyPackets: dayPackets,
    };

    parsedDates.push({
      dateStr,
      dayNumber,
      sheetName: ws.name,
      headerDateText: b5Text,
      records: sheetRecords,
      summary: daySummary,
      isValid: sheetErrors.length === 0,
      errors: sheetErrors,
    });
  }

  // 3. Sort by day number ascending (1, 2, 3...)
  parsedDates.sort((a, b) => a.dayNumber - b.dayNumber);

  // 4. Calculate overall summary across all dates
  let overallRecords = 0;
  let overallSales = 0;
  let overallStock = 0;
  let overallZardaSales = 0;
  let overallZardaStock = 0;
  let overallPackets = 0;

  for (const d of parsedDates) {
    overallRecords += d.records.length;
    overallSales += d.summary.totalCigaretteSales;
    overallStock += d.summary.totalCigaretteStock;
    overallZardaSales += d.summary.totalZardaSalesValue;
    overallZardaStock += d.summary.totalZardaStockValue;
    overallPackets += d.summary.totalEmptyPackets;
    if (d.errors.length > 0) {
      errors.push(...d.errors);
    }
  }

  return {
    isValid: errors.length === 0,
    fileName: params.fileName,
    baseYear,
    baseMonth,
    totalSheetsFound: workbook.worksheets.length,
    totalDatesFound: parsedDates.length,
    dates: parsedDates,
    overallSummary: {
      totalDates: parsedDates.length,
      totalRecords: overallRecords,
      totalCigaretteSales: Number(overallSales.toFixed(2)),
      totalCigaretteStock: Number(overallStock.toFixed(2)),
      totalZardaSalesValue: overallZardaSales,
      totalZardaStockValue: overallZardaStock,
      totalEmptyPackets: overallPackets,
    },
    errors,
    warnings,
  };
}
