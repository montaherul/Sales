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
 *
 * Date authority hierarchy (highest → lowest):
 *   1. Sheet name (e.g. "5")  — the tab IS the day.
 *   2. Sheet header cell B5   — internal label confirms the tab's own date.
 *   3. Filename               — cumulative workbook export label; day is unreliable.
 *
 * When (1) or (2) confirm the application date, a filename day difference
 * is treated as an informational note only — never a blocking conflict.
 * Month and year mismatches from the filename remain fatal in all cases.
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

  // ------------------------------------------------------------------
  // Determine whether the sheet itself confirms the application date.
  //
  //  · sheetName === appDay  → The sheet tab name IS the day number.
  //    This is the primary/authoritative date source. When this matches,
  //    the filename day is completely irrelevant.
  //
  //  · header cell B5 date === appDate  → The internal label on the sheet
  //    independently confirms the application date.
  //
  // Either condition is sufficient to skip the filename-day comparison.
  // ------------------------------------------------------------------
  const sheetNameMatchesDay =
    input.sheetNumber !== undefined &&
    appDay !== undefined &&
    input.sheetNumber === appDay;

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
      headerConfirmsAppDate = true;
    }
  }

  // Sheet-name match OR header confirmation — either is enough to trust appDate
  const sheetConfirmsAppDate = sheetNameMatchesDay || headerConfirmsAppDate;

  // ------------------------------------------------------------------
  // 1. Filename check
  //    • Day:   ignored entirely when the sheet itself confirms the date.
  //    • Month: always fatal — wrong month means wrong file.
  //    • Year:  always fatal — wrong year means wrong file.
  // ------------------------------------------------------------------
  if (input.fileName) {
    const fromFile = extractDateFromFilename(input.fileName);
    if (fromFile) {
      if (appDay !== undefined && fromFile.day !== undefined && appDay !== fromFile.day) {
        if (sheetConfirmsAppDate) {
          // Sheet name "5" IS the date. The filename day (e.g. 6) is the
          // workbook's export/download date — not this individual tab's date.
          // Silently accepted; no warning needed.
        } else {
          conflicts.push(
            `Day mismatch: Application selected day ${appDay}, but filename indicates day ${fromFile.day}.`
          );
        }
      }
      if (appMonth !== undefined && fromFile.month !== undefined && appMonth !== fromFile.month) {
        conflicts.push(
          `Month mismatch: Application selected month ${appMonth}, but filename indicates month ${fromFile.month}.`
        );
      }
      if (appYear !== undefined && fromFile.year !== undefined && appYear !== fromFile.year) {
        conflicts.push(
          `Year mismatch: Application selected year ${appYear}, but filename indicates year ${fromFile.year}.`
        );
      }
    }
  }

  // ------------------------------------------------------------------
  // 2. Sheet header cell B5 check (authoritative label for this tab)
  //    All three components (day, month, year) must match or be absent.
  // ------------------------------------------------------------------
  if (input.headerDateText) {
    const fromHeader = parseHeaderCellDate(input.headerDateText);
    if (fromHeader) {
      if (appDay !== undefined && fromHeader.day !== undefined && appDay !== fromHeader.day) {
        conflicts.push(
          `Header mismatch: Application selected day ${appDay}, but workbook header indicates day ${fromHeader.day}.`
        );
      }
      if (appMonth !== undefined && fromHeader.month !== undefined && appMonth !== fromHeader.month) {
        conflicts.push(
          `Header mismatch: Application selected month ${appMonth}, but workbook header indicates month ${fromHeader.month}.`
        );
      }
      if (appYear !== undefined && fromHeader.year !== undefined && appYear !== fromHeader.year) {
        conflicts.push(
          `Header mismatch: Application selected year ${appYear}, but workbook header indicates year ${fromHeader.year}.`
        );
      }
    }
  }

  // ------------------------------------------------------------------
  // 3. Sheet number check
  //    The sheet name is the primary day identifier.
  //    A mismatch here is only relevant when neither the sheet name nor
  //    the header can confirm the application date.
  // ------------------------------------------------------------------
  if (input.sheetNumber !== undefined && appDay !== undefined) {
    if (!sheetNameMatchesDay) {
      if (headerConfirmsAppDate) {
        // Header confirms the date; sheet name difference is acceptable.
        warnings.push(
          `Sheet name '${input.sheetNumber}' differs from selected day ${appDay}, ` +
          `but the sheet header cell confirms day ${appDay}.`
        );
      } else {
        conflicts.push(
          `Sheet mismatch: Active sheet is '${input.sheetNumber}', but selected application date is day ${appDay}.`
        );
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

