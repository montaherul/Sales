// Shared Utilities
// Afaz Tobacco Sales & Stock Intelligence Platform

/**
 * Calculates SHA-256 checksum for a buffer or string.
 */
export function calculateSha256(content: Buffer | string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256');
  hash.update(content);
  return hash.digest('hex');
}

/**
 * Rounds a number to precision digits safely.
 */
export function roundTo(val: number, decimals: number = 2): number {
  if (isNaN(val) || !isFinite(val)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

/**
 * Formats a currency number in BDT.
 */
export function formatBDT(val: number): string {
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    maximumFractionDigits: 2,
  }).format(val);
}

/**
 * Formats standard volume display.
 */
export function formatVolume(val: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(val);
}

/**
 * Formats date into standard YYYY-MM-DD.
 */
export function formatDateString(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Returns real-time today date string formatted as YYYY-MM-DD for reporting scope.
 */
export function getTodayDateString(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Generates dynamic standard filename for exports based on report period type.
 */
export function generateExportFilename(
  year: number,
  month?: number,
  day?: number,
  reportType: 'daily' | 'monthly' | 'yearly' | 'blank_month' = 'daily'
): string {
  const m = month || 10;
  const d = day || 1;
  const dateObj = new Date(year, m - 1, d);
  const monthName = dateObj.toLocaleString('en-US', { month: 'long' });

  if (reportType === 'yearly') {
    return `Yearly sales and Closing Stock Information ${year}.xlsx`;
  }
  if (reportType === 'blank_month') {
    return `Daily sales and Closing Stock Information ${monthName} ${year} (Blank Template).xlsx`;
  }
  if (reportType === 'monthly') {
    return `Monthly sales and Closing Stock Information ${monthName} ${year}.xlsx`;
  }
  return `Daily sales and Closing Stock Information ${monthName} ${d} ${year}.xlsx`;
}
