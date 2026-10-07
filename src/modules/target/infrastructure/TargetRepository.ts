// Infrastructure: Selective Target Repository

import { dbQuery } from '@/shared/database/db';
import { TerritoryBrandTargetItem } from '../domain/types';

export class TargetRepository {
  public async getMonthlyTargets(year: number, month: number): Promise<TerritoryBrandTargetItem[]> {
    try {
      const res = await dbQuery(
        `SELECT tg.id, tg.territory_id, tg.brand_id, tg.target_quantity,
                tg.year, tg.month, t.name as territory_name
         FROM targets tg
         JOIN territories t ON tg.territory_id = t.id
         WHERE tg.year = $1 AND tg.month = $2`,
        [year, month]
      );

      return res.rows.map((r: any) => ({
        id: r.id,
        territoryId: r.territory_id,
        territoryName: r.territory_name,
        brandId: r.brand_id,
        targetQuantity: parseFloat(r.target_quantity || 0),
        year: r.year,
        month: r.month,
      }));
    } catch {
      return [];
    }
  }
}

export const targetRepository = new TargetRepository();
