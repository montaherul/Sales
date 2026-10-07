// Application: Stock Calculator
// Calculates total cigarette closing stock (=SUM(K8:P8))

import { BrandStockInput } from '../domain/types';
import { roundTo } from '@/shared/utils';

export class StockCalculator {
  /**
   * Sums all 6 cigarette brand closing stock volumes.
   */
  public static calculateTotal(stock: BrandStockInput): number {
    const sum =
      (stock.wilson || 0) +
      (stock.shahara || 0) +
      (stock.express || 0) +
      (stock.nexus || 0) +
      (stock.sb || 0) +
      (stock.sm || 0);

    return roundTo(sum, 4);
  }
}
