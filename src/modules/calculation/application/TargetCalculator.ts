// Application: Target Calculator
// Aggregates brand targets and remaining target volume

import { roundTo } from '@/shared/utils';

export class TargetCalculator {
  /**
   * Calculates total target from individual brand targets.
   */
  public static calculateTotalTarget(brandTargets: Record<string, number>): number {
    const total = Object.values(brandTargets).reduce((acc, val) => acc + (val || 0), 0);
    return roundTo(total, 4);
  }

  /**
   * Calculates remaining target required to achieve target.
   */
  public static calculateRemainingTarget(target: number, salesToDate: number): number {
    return Math.max(0, roundTo(target - salesToDate, 4));
  }

  /**
   * Calculates required daily ADS for remaining active working days.
   */
  public static calculateRequiredRemainingADS(remainingTarget: number, remainingDays: number): number {
    if (remainingDays <= 0) return 0;
    return roundTo(remainingTarget / remainingDays, 4);
  }
}
