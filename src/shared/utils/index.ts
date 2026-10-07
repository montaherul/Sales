// Shared Utilities
// Afaz Tobacco Sales & Stock Intelligence Platform

import crypto from 'crypto';

/**
 * Calculates SHA-256 checksum for a buffer or string.
 */
export function calculateSha256(content: Buffer | string): string {
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
 * Generates standard filename for exports.
 */
export function generateExportFilename(year: number, month: number, day: number): string {
  const dateObj = new Date(year, month - 1, day);
  const monthName = dateObj.toLocaleString('en-US', { month: 'long' });
  return `Daily sales and Closing Stock Information ${monthName} ${day} ${year}.xlsx`;
}
