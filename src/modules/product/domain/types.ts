// Domain: Product Catalog Models
// Cigarette Brands: Wilson, Shahara, Express, Nexus, SB, SM
// Zarda Brands: SLB, 22/25 (15 BDT), 99/14 (6 BDT), 33/15 (8 BDT)

export interface BrandCatalogItem {
  id: string;
  name: string;
  category: 'CIGARETTE' | 'ZARDA';
  unitPrice?: number;
  sortOrder: number;
}
