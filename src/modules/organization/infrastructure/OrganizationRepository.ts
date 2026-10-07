// Infrastructure: Selective Organization Repository
// Fetches dynamic hierarchy from PostgreSQL

import { dbQuery } from '@/shared/database/db';
import { TerritoryEntity } from '../domain/types';
import { SATKANIA_TERRITORIES } from '@/shared/constants';

export class OrganizationRepository {
  public async getTerritories(): Promise<TerritoryEntity[]> {
    try {
      const res = await dbQuery(
        `SELECT t.id, t.name, t.sort_order, t.region_id, r.name as region_name
         FROM territories t
         JOIN regions r ON t.region_id = r.id
         ORDER BY t.sort_order ASC`
      );

      return res.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        regionId: r.region_id,
        regionName: r.region_name,
        sortOrder: r.sort_order,
      }));
    } catch {
      return SATKANIA_TERRITORIES.map((t, idx) => ({
        id: t.id,
        name: t.name,
        regionId: 'satkania-region',
        regionName: 'Satkania',
        sortOrder: idx + 1,
      }));
    }
  }
}

export const organizationRepository = new OrganizationRepository();
