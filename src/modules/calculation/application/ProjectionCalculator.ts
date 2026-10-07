// Application: Projection Calculator
// Projection = Period ADS * Total Working Days
// Growth % = ((Projected - Last Month Sales) / Last Month Sales) * 100

import { DEFAULT_WORKING_DAYS } from '@/shared/constants';
import { roundTo } from '@/shared/utils';

export class ProjectionCalculator {
  /**
   * Projects month-end volume given run rate ADS.
   */
  public static calculateProjectedSales(periodADS: number, workingDays: number = DEFAULT_WORKING_DAYS): number {
    return roundTo(periodADS * workingDays, 4);
  }

  /**
   * Calculates growth rate relative to last month's actual sales volume.
   */
  public static calculateGrowth(projected: number, lastMonthSales: number): number {
    if (lastMonthSales <= 0) return 0;
    return roundTo(((projected - lastMonthSales) / lastMonthSales) * 100, 2);
  }
}
