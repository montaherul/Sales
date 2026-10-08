// Application: Zarda Calculator
// Calculates valuation for Zarda sales (=S8*15+T8*6+U8*8) and stock (=Y8*15+Z8*6+AA8*8)

import { ZardaSalesInput, ZardaStockInput } from '../domain/types';
import { ZARDA_UNIT_PRICES } from '@/shared/constants';
import { roundTo } from '@/shared/utils';

export interface ZardaCustomPrices {
  price_22_25?: number;
  price_99_14?: number;
  price_33_15?: number;
}

export class ZardaCalculator {
  /**
   * Calculates total valuation in BDT for Zarda sales.
   */
  public static calculateSalesValuation(
    sales: ZardaSalesInput, 
    customPrices?: ZardaCustomPrices
  ): number {
    const p22_25 = customPrices?.price_22_25 ?? ZARDA_UNIT_PRICES.price_22_25;
    const p99_14 = customPrices?.price_99_14 ?? ZARDA_UNIT_PRICES.price_99_14;
    const p33_15 = customPrices?.price_33_15 ?? ZARDA_UNIT_PRICES.price_33_15;

    const value =
      ((sales.qty_22_25 || 0) * p22_25) +
      ((sales.qty_99_14 || 0) * p99_14) +
      ((sales.qty_33_15 || 0) * p33_15);

    return roundTo(value, 2);
  }

  /**
   * Calculates total valuation in BDT for Zarda closing stock.
   */
  public static calculateStockValuation(
    stock: ZardaStockInput, 
    customPrices?: ZardaCustomPrices
  ): number {
    const p22_25 = customPrices?.price_22_25 ?? ZARDA_UNIT_PRICES.price_22_25;
    const p99_14 = customPrices?.price_99_14 ?? ZARDA_UNIT_PRICES.price_99_14;
    const p33_15 = customPrices?.price_33_15 ?? ZARDA_UNIT_PRICES.price_33_15;

    const value =
      ((stock.qty_22_25 || 0) * p22_25) +
      ((stock.qty_99_14 || 0) * p99_14) +
      ((stock.qty_33_15 || 0) * p33_15);

    return roundTo(value, 2);
  }
}
