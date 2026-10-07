// Application: Sales Calculator
// Calculates total cigarette sales across standard brands (=SUM(D8:I8))

import { BrandSalesInput } from '../domain/types';
import { roundTo } from '@/shared/utils';

export class SalesCalculator {
  /**
   * Sums all 6 cigarette brand sales volumes.
   */
  public static calculateTotal(sales: BrandSalesInput): number {
    const sum =
      (sales.wilson || 0) +
      (sales.shahara || 0) +
      (sales.express || 0) +
      (sales.nexus || 0) +
      (sales.sb || 0) +
      (sales.sm || 0);

    return roundTo(sum, 4);
  }
}
