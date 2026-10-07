// Application: ADS Calculator (Average Daily Sales)
// ADS = Total Volume / Configured Working Days

import { DEFAULT_WORKING_DAYS } from '@/shared/constants';
import { roundTo } from '@/shared/utils';

export class ADSCalculator {
  /**
   * Calculates Average Daily Sales for a volume given active working days.
   */
  public static calculateADS(volume: number, workingDays: number = DEFAULT_WORKING_DAYS): number {
    if (workingDays <= 0) return 0;
    return roundTo(volume / workingDays, 4);
  }
}
