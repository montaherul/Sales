// Application: Product Service

import { productRepository } from '../infrastructure/ProductRepository';
import { BrandCatalogItem } from '../domain/types';

export class ProductService {
  public static async getBrands(): Promise<BrandCatalogItem[]> {
    return await productRepository.getBrands();
  }
}
