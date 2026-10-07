// Application: Variance Calculator
// Calculates absolute and percentage variances between target, actual, and projections

import { roundTo } from '@/shared/utils';

export class VarianceCalculator {
  /**
   * Calculates volume variance (Actual - Target).
   */
  public static calculateVolumeVariance(actual: number, target: number): number {
    return roundTo(actual - target, 4);
  }

  /**
   * Calculates variance percentage ((Actual - Target) / Target) * 100.
   */
  public static calculateVariancePercentage(actual: number, target: number): number {
    if (target <= 0) return 0;
    return roundTo(((actual - target) / target) * 100, 2);
  }
}
