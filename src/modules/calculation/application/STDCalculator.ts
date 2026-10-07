// Application: STD Calculator (Sales To Date)
// Aggregates cumulative sales volume across daily reporting sheets

import { roundTo } from '@/shared/utils';

export class STDCalculator {
  /**
   * Aggregates daily volume numbers up to current reporting day.
   */
  public static calculateSalesToDate(dailyVolumes: number[]): number {
    const total = dailyVolumes.reduce((acc, curr) => acc + (curr || 0), 0);
    return roundTo(total, 4);
  }
}
