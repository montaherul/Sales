// Infrastructure: Selective Product Repository

import { dbQuery } from '@/shared/database/db';
import { BrandCatalogItem } from '../domain/types';
import { CIGARETTE_BRANDS, ZARDA_BRANDS } from '@/shared/constants';

export class ProductRepository {
  public async getBrands(): Promise<BrandCatalogItem[]> {
    try {
      const res = await dbQuery(
        `SELECT b.id, b.name, b.category, b.sort_order, p.unit_price
         FROM brands b
         LEFT JOIN prices p ON b.id = p.brand_id AND p.is_active = true
         ORDER BY b.category, b.sort_order ASC`
      );

      return res.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        unitPrice: r.unit_price ? parseFloat(r.unit_price) : undefined,
        sortOrder: r.sort_order,
      }));
    } catch {
      const cigs: BrandCatalogItem[] = CIGARETTE_BRANDS.map((b, i) => ({
        id: b.code,
        name: b.name,
        category: 'CIGARETTE',
        sortOrder: i + 1,
      }));
      const zardas: BrandCatalogItem[] = ZARDA_BRANDS.map((z, i) => ({
        id: z.code,
        name: z.name,
        category: 'ZARDA',
        unitPrice: z.unitPrice,
        sortOrder: i + 1,
      }));
      return [...cigs, ...zardas];
    }
  }
}

export const productRepository = new ProductRepository();
