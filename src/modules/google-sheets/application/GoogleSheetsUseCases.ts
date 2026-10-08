// Application: Google Sheets Use Cases
// Orchestrates Google Sheets API v4 synchronization, Super Admin authorization, and audit logging
// Architecture: Database -> Calculation Engine -> Web App -> XLSX Export -> Google Sheets -> Google Drive
// AGENTS1.md Rule 4 & Rule 6 (Application / Service Layer)

import { googleSheetsAdapter, GoogleSheetsSyncResult } from '@/infrastructure/google/GoogleSheetsAdapter';
import { UserAuthContext } from '@/shared/authorization';
import { ROLES, AUDIT_ACTIONS } from '@/shared/constants';
import { ForbiddenError } from '@/shared/errors';
import { AuditService } from '@/modules/audit';

export interface GoogleSheetsSyncRequestDTO {
  year: number;
  month: number;
  day?: number;
  user: UserAuthContext;
  companyId?: string | null;
  spreadsheetId?: string;
}

export class GoogleSheetsService {
  /**
   * Synchronizes monthly sales & stock reporting records with Google Sheets API v4.
   * Strictly restricted to SUPER_ADMIN users per AGENTS.md rule 7 & 21.
   */
  public static async syncReport(dto: GoogleSheetsSyncRequestDTO): Promise<GoogleSheetsSyncResult> {
    // 1. Authorization check: Super Admin only
    if (dto.user.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN users are permitted to trigger Google Sheets synchronization');
    }

    const targetCompanyId = dto.companyId || dto.user.companyId || null;

    // 2. Perform synchronization via adapter
    const result = await googleSheetsAdapter.syncReport({
      year: dto.year,
      month: dto.month,
      day: dto.day,
      syncedBy: dto.user.id,
      companyId: targetCompanyId,
      spreadsheetId: dto.spreadsheetId,
    });

    // 3. Centralized Audit Log
    await AuditService.logEvent({
      userId: dto.user.id,
      companyId: targetCompanyId,
      eventType: AUDIT_ACTIONS.UPDATE,
      entityName: 'google_sheet_syncs',
      entityId: result.syncId || '',
      newValues: {
        spreadsheetId: result.spreadsheetId,
        spreadsheetUrl: result.spreadsheetUrl,
        year: result.year,
        month: result.month,
        recordsSynced: result.recordsSynced,
        status: result.status,
      },
    });

    return result;
  }

  /**
   * Retrieves synchronization history logs for tenant or platform.
   */
  public static async getHistory(user: UserAuthContext, companyId?: string | null): Promise<any[]> {
    const targetCompanyId = user.role === ROLES.SUPER_ADMIN ? (companyId || null) : (user.companyId || null);
    return await googleSheetsAdapter.getSyncHistory(targetCompanyId);
  }
}
