// Application: Achievement Calculator
// Achievement % = (Sales-to-Date / Target) * 100

import { roundTo } from '@/shared/utils';

export class AchievementCalculator {
  /**
   * Calculates achievement percentage against target.
   */
  public static calculateAchievement(salesToDate: number, target: number): number {
    if (target <= 0) return 0;
    return roundTo((salesToDate / target) * 100, 2);
  }
}
