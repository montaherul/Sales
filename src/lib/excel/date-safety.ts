// Date Safety Validator for XLSX Imports and Daily Logs
// Enforces zero-tolerance date consistency rules from docs/07-IMPORT-SPEC.md

export interface DateVerificationInput {
  applicationDate?: string; // YYYY-MM-DD
  fileName?: string;
  headerDateText?: string;  // e.g. "Date:06.10.2026" or "Date:06/10/2026"
  sheetNumber?: number;     // e.g. 6
  monthName?: string;       // e.g. "October"
  year?: number;            // e.g. 2026
}

export interface DateVerificationResult {
  isValid: boolean;
  resolvedDate: string; // YYYY-MM-DD
  conflicts: string[];
}

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
];

/**
 * Parses dates embedded in corporate filenames:
 * e.g., "Daily sales and Closing Stock Information October 6 2026.xlsx"
 * e.g., "Daily Sales & Closing Stock Information 2 September 2026.xlsx"
 */
export function extractDateFromFilename(filename: string): { day?: number; month?: number; year?: number } | null {
  const clean = filename.toLowerCase();
  
  // Try pattern: {MonthName} {Day} {Year} or {Day} {MonthName} {Year}
  let foundMonth: number | undefined;
  for (let m = 0; m < MONTH_NAMES.length; m++) {
    if (clean.includes(MONTH_NAMES[m])) {
      foundMonth = m + 1;
      break;
    }
  }

  // Look for year 2024..2030 or 26
  let foundYear: number | undefined;
  const yearMatch = clean.match(/\b(202[4-9]|203[0-9])\b/);
  if (yearMatch) {
    foundYear = parseInt(yearMatch[1], 10);
  } else {
    // check for -26 or 26
    const shortYearMatch = clean.match(/[-_\s](2[4-9])\b/);
    if (shortYearMatch) {
      foundYear = 2000 + parseInt(shortYearMatch[1], 10);
    }
  }

  // Look for day 1..31
  let foundDay: number | undefined;
  const dayMatch = clean.match(/\b([1-9]|[12][0-9]|3[01])\b/);
  if (dayMatch) {
    foundDay = parseInt(dayMatch[1], 10);
  }

  if (foundMonth || foundYear || foundDay) {
    return { day: foundDay, month: foundMonth, year: foundYear };
  }
  return null;
}

/**
 * Parses header cell date: "Date:06.10.2026" or "Date: 06-10-2026"
 */
export function parseHeaderCellDate(headerText: string): { day?: number; month?: number; year?: number } | null {
  const match = headerText.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (match) {
    return {
      day: parseInt(match[1], 10),
      month: parseInt(match[2], 10),
      year: parseInt(match[3], 10),
    };
  }
  return null;
}

/**
 * Validates cross-source date consistency without guessing.
 */
export function verifyImportDateSafety(input: DateVerificationInput): DateVerificationResult {
  const conflicts: string[] = [];

  // Parse application date if provided
  let appDay: number | undefined;
  let appMonth: number | undefined;
  let appYear: number | undefined;

  if (input.applicationDate) {
    const parts = input.applicationDate.split('-').map(Number);
    if (parts.length === 3) {
      appYear = parts[0];
      appMonth = parts[1];
      appDay = parts[2];
    }
  }

  // 1. Verify against filename
  if (input.fileName) {
    const fromFile = extractDateFromFilename(input.fileName);
    if (fromFile) {
      if (appDay !== undefined && fromFile.day !== undefined && appDay !== fromFile.day) {
        conflicts.push(`Day mismatch: Application selected day ${appDay}, but filename indicates day ${fromFile.day}.`);
      }
      if (appMonth !== undefined && fromFile.month !== undefined && appMonth !== fromFile.month) {
        conflicts.push(`Month mismatch: Application selected month ${appMonth}, but filename indicates month ${fromFile.month}.`);
      }
      if (appYear !== undefined && fromFile.year !== undefined && appYear !== fromFile.year) {
        conflicts.push(`Year mismatch: Application selected year ${appYear}, but filename indicates year ${fromFile.year}.`);
      }
    }
  }

  // 2. Verify against Sheet Header date
  if (input.headerDateText) {
    const fromHeader = parseHeaderCellDate(input.headerDateText);
    if (fromHeader) {
      if (appDay !== undefined && fromHeader.day !== undefined && appDay !== fromHeader.day) {
        conflicts.push(`Header mismatch: Application selected day ${appDay}, but workbook header indicates day ${fromHeader.day}.`);
      }
      if (appMonth !== undefined && fromHeader.month !== undefined && appMonth !== fromHeader.month) {
        conflicts.push(`Header mismatch: Application selected month ${appMonth}, but workbook header indicates month ${fromHeader.month}.`);
      }
    }
  }

  // 3. Verify against Sheet number (e.g. Sheet 6 must correspond to Day 6)
  if (input.sheetNumber !== undefined && appDay !== undefined) {
    if (input.sheetNumber !== appDay) {
      conflicts.push(`Sheet mismatch: Active sheet is '${input.sheetNumber}', but selected application date is day ${appDay}.`);
    }
  }

  const isValid = conflicts.length === 0;
  const resolvedDate = input.applicationDate || 
    (appYear && appMonth && appDay ? `${appYear}-${String(appMonth).padStart(2, '0')}-${String(appDay).padStart(2, '0')}` : '');

  return {
    isValid,
    resolvedDate,
    conflicts,
  };
}
