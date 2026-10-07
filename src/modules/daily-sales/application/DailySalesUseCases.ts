// Application: Daily Sales Use Cases
// Handles authorization scope verification, centralized calculations, and persistence

import { DailySalesEntry, DailySalesRecordProps } from '../domain/DailySalesEntry';
import { dailySalesRepository } from '../infrastructure/DailySalesRepository';
import { calculationEngine } from '@/modules/calculation';
import { validateOrganizationalScope, UserAuthContext } from '@/shared/authorization';

export class DailySalesService {
  /**
   * Creates or updates a daily operational entry with scope and calculation enforcement.
   */
  public static async saveEntry(props: DailySalesRecordProps, user: UserAuthContext): Promise<string> {
    // 1. Verify organizational scope
    validateOrganizationalScope(user, props.territoryId);

    // 2. Validate Domain entity invariants
    const entry = new DailySalesEntry(props);

    // 3. Centralized calculation engine
    calculationEngine.evaluateDailyRecord(
      entry.cigaretteSales,
      entry.cigaretteStock,
      entry.zardaSales,
      entry.zardaStock
    );

    // 4. Persist via repository
    return await dailySalesRepository.upsertSubmission(entry, user.id);
  }

  /**
   * Fetches submissions for a date.
   */
  public static async getSubmissions(reportingDate: string): Promise<any[]> {
    return await dailySalesRepository.getByDate(reportingDate);
  }
}
