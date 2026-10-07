// Application: Organization Service

import { organizationRepository } from '../infrastructure/OrganizationRepository';
import { TerritoryEntity } from '../domain/types';

export class OrganizationService {
  public static async getTerritories(): Promise<TerritoryEntity[]> {
    return await organizationRepository.getTerritories();
  }
}
