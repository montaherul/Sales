// Application: Target Service

import { targetRepository } from '../infrastructure/TargetRepository';
import { TerritoryBrandTargetItem } from '../domain/types';

export class TargetService {
  public static async getTargets(year: number = 2026, month: number = 10): Promise<TerritoryBrandTargetItem[]> {
    return await targetRepository.getMonthlyTargets(year, month);
  }
}
