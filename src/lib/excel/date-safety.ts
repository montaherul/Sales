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
  /**
   * Non-blocking observations. The import is still valid when warnings are
   * present. Typical example: the corporate filename's day differs from the
   * selected tab's internal header date, but the header date itself matches
   * the application date — perfectly normal for cumulative monthly workbooks.
   */
  warnings: string[];
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

  // 1. ISO format: YYYY-MM-DD
  const isoMatch = clean.match(/\b(202[4-9]|203[0-9])[-_](0[1-9]|1[0-2])[-_](0[1-9]|[12][0-9]|3[01])\b/);
  if (isoMatch) {
    return {
      year: parseInt(isoMatch[1], 10),
      month: parseInt(isoMatch[2], 10),
      day: parseInt(isoMatch[3], 10),
    };
  }

  // 2. DD.MM.YYYY or DD-MM-YYYY format
  const dmyMatch = clean.match(/\b(0[1-9]|[12][0-9]|3[01])[.-](0[1-9]|1[0-2])[.-](202[4-9]|203[0-9])\b/);
  if (dmyMatch) {
    return {
      day: parseInt(dmyMatch[1], 10),
      month: parseInt(dmyMatch[2], 10),
      year: parseInt(dmyMatch[3], 10),
    };
  }

  // 3. Month Name + Day + Year: "October 6 2026", "October-6-2026", "October 06, 2026"
  const mdyRegex = new RegExp(
    `\\b(${MONTH_NAMES.join('|')})\\s*[-_,]?\\s*([1-9]|[12][0-9]|3[01])(?:st|nd|rd|th)?\\s*[-_,]?\\s*(202[4-9]|203[0-9])?\\b`,
    'i'
  );
  const mdyMatch = clean.match(mdyRegex);
  if (mdyMatch) {
    const month = MONTH_NAMES.indexOf(mdyMatch[1].toLowerCase()) + 1;
    const day = parseInt(mdyMatch[2], 10);
    const year = mdyMatch[3] ? parseInt(mdyMatch[3], 10) : undefined;
    return { day, month, year };
  }

  // 4. Day + Month Name + Year: "6 October 2026", "06-October-2026"
  const dmyTextRegex = new RegExp(
    `\\b([1-9]|[12][0-9]|3[01])(?:st|nd|rd|th)?\\s*[-_,]?\\s*(${MONTH_NAMES.join('|')})\\s*[-_,]?\\s*(202[4-9]|203[0-9])?\\b`,
    'i'
  );
  const dmyTextMatch = clean.match(dmyTextRegex);
  if (dmyTextMatch) {
    const day = parseInt(dmyTextMatch[1], 10);
    const month = MONTH_NAMES.indexOf(dmyTextMatch[2].toLowerCase()) + 1;
    const year = dmyTextMatch[3] ? parseInt(dmyTextMatch[3], 10) : undefined;
    return { day, month, year };
  }

  return null;
}

/**
 * Parses header cell date: "Date:06.10.2026", "Date: 06-10-2026", "2026-10-06", or "06 October 2026"
 */
export function parseHeaderCellDate(headerText: string): { day?: number; month?: number; year?: number } | null {
  if (!headerText) return null;
  const clean = headerText.trim();

  // 1. DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = clean.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (dmyMatch) {
    return {
      day: parseInt(dmyMatch[1], 10),
      month: parseInt(dmyMatch[2], 10),
      year: parseInt(dmyMatch[3], 10),
    };
  }

  // 2. YYYY-MM-DD or YYYY/MM/DD (ISO)
  const isoMatch = clean.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (isoMatch) {
    return {
      year: parseInt(isoMatch[1], 10),
      month: parseInt(isoMatch[2], 10),
      day: parseInt(isoMatch[3], 10),
    };
  }

  // 3. Month Name formatted date: "06 October 2026" or "October 6 2026"
  const namedMatch = extractDateFromFilename(clean);
  if (namedMatch) {
    return namedMatch;
  }

  return null;
}

/**
 * Validates cross-source date consistency without guessing.
 */
export function verifyImportDateSafety(input: DateVerificationInput): DateVerificationResult {
  const conflicts: string[] = [];
  const warnings: string[] = [];

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

  // Pre-parse the sheet header date once so we can use it to resolve
  // filename-vs-appDate discrepancies.
  let headerConfirmsAppDate = false;
  if (input.headerDateText) {
    const fromHeader = parseHeaderCellDate(input.headerDateText);
    if (
      fromHeader &&
      appDay !== undefined && appMonth !== undefined && appYear !== undefined &&
      fromHeader.day === appDay &&
      fromHeader.month === appMonth &&
      fromHeader.year === appYear
    ) {
      // The sheet's own header cell independently confirms the application date.
      headerConfirmsAppDate = true;
    }
  }

  // 1. Verify against filename
  if (input.fileName) {
    const fromFile = extractDateFromFilename(input.fileName);
    if (fromFile) {
      if (appDay !== undefined && fromFile.day !== undefined && appDay !== fromFile.day) {
        if (headerConfirmsAppDate) {
          // The sheet header (authoritative for this specific tab) confirms the
          // application date. The filename day reflects the cumulative workbook
          // export/download date — not the date of this individual daily tab.
          // This is acceptable variance; record as a warning only.
          warnings.push(
            `Filename indicates day ${fromFile.day}, but the matched sheet header confirms day ${appDay}. ` +
            `This is normal for multi-tab cumulative workbooks where the filename reflects the latest export date.`
          );
        } else {
          conflicts.push(`Day mismatch: Application selected day ${appDay}, but filename indicates day ${fromFile.day}.`);
        }
      }
      // Month and year mismatches from the filename are always fatal — they
      // indicate a genuinely wrong file regardless of header date.
      if (appMonth !== undefined && fromFile.month !== undefined && appMonth !== fromFile.month) {
        conflicts.push(`Month mismatch: Application selected month ${appMonth}, but filename indicates month ${fromFile.month}.`);
      }
      if (appYear !== undefined && fromFile.year !== undefined && appYear !== fromFile.year) {
        conflicts.push(`Year mismatch: Application selected year ${appYear}, but filename indicates year ${fromFile.year}.`);
      }
    }
  }

  // 2. Verify against Sheet Header date
  // (Header date is the authoritative source for each tab's reporting date.)
  if (input.headerDateText) {
    const fromHeader = parseHeaderCellDate(input.headerDateText);
    if (fromHeader) {
      if (appDay !== undefined && fromHeader.day !== undefined && appDay !== fromHeader.day) {
        conflicts.push(`Header mismatch: Application selected day ${appDay}, but workbook header indicates day ${fromHeader.day}.`);
      }
      if (appMonth !== undefined && fromHeader.month !== undefined && appMonth !== fromHeader.month) {
        conflicts.push(`Header mismatch: Application selected month ${appMonth}, but workbook header indicates month ${fromHeader.month}.`);
      }
      if (appYear !== undefined && fromHeader.year !== undefined && appYear !== fromHeader.year) {
        conflicts.push(`Header mismatch: Application selected year ${appYear}, but workbook header indicates year ${fromHeader.year}.`);
      }
    }
  }

  // 3. Verify against Sheet number (e.g. Sheet "5" must correspond to Day 5).
  // When the sheet number matches the appDay we trust it.
  // When it doesn't match, only flag a conflict if the header does NOT confirm
  // the app date (to avoid false positives on multi-tab cumulative workbooks).
  if (input.sheetNumber !== undefined && appDay !== undefined) {
    if (input.sheetNumber !== appDay) {
      if (headerConfirmsAppDate) {
        warnings.push(
          `Sheet name '${input.sheetNumber}' does not equal selected day ${appDay}, ` +
          `but the sheet header confirms ${appDay}. Acceptable for tab-named workbooks.`
        );
      } else {
        conflicts.push(`Sheet mismatch: Active sheet is '${input.sheetNumber}', but selected application date is day ${appDay}.`);
      }
    }
  }

  const isValid = conflicts.length === 0;
  const resolvedDate =
    input.applicationDate ||
    (appYear && appMonth && appDay
      ? `${appYear}-${String(appMonth).padStart(2, '0')}-${String(appDay).padStart(2, '0')}`
      : '');

  return {
    isValid,
    resolvedDate,
    conflicts,
    warnings,
  };
}
