// Application: Master Data Service
// Coordinates aggregated master data queries with tenant scoping
// AGENTS1.md Rule 4 & Rule 6 (Application / Service Layer)

import { masterDataRepository, MasterDataPayload } from '../infrastructure/MasterDataRepository';
import { UserAuthContext } from '@/shared/authorization';
import { ROLES } from '@/shared/constants';

export class MasterDataService {
  /**
   * Retrieves aggregated master data (companies, regions, territories, brands, users, targets, working days)
   * with server-side tenant scoping.
   */
  public static async getMasterData(
    actor: UserAuthContext,
    reqCompanyId?: string | null,
    reqYear: number = 2026,
    reqMonth: number = 10
  ): Promise<MasterDataPayload> {
    const isSuperAdmin = actor.role === ROLES.SUPER_ADMIN;

    // Determine effective company scope
    let filterCompanyId: string | null = null;
    if (!isSuperAdmin) {
      filterCompanyId = actor.companyId || null;
    } else if (reqCompanyId && reqCompanyId !== 'ALL') {
      filterCompanyId = reqCompanyId;
    }

    return await masterDataRepository.getMasterData(
      filterCompanyId,
      isSuperAdmin,
      reqYear,
      reqMonth
    );
  }
}
