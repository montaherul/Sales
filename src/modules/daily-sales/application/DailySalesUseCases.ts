// Application: Daily Sales Use Cases & Service Layer
// Handles authorization scope verification, centralized calculations, workflows, and persistence
// AGENTS1.md Rule 4 & Rule 6 (Application / Service Layer)

import { DailySalesEntry, DailySalesRecordProps } from '../domain/DailySalesEntry';
import { dailySalesRepository, SubmissionFilterOptions } from '../infrastructure/DailySalesRepository';
import { calculationEngine } from '@/modules/calculation';
import { validateOrganizationalScope, UserAuthContext } from '@/shared/authorization';
import { DailyOperationalRecord, SubmissionStatus } from '@/lib/types';
import { ROLES, AUDIT_ACTIONS } from '@/shared/constants';
import { ForbiddenError, ValidationError } from '@/shared/errors';
import { PaginationHelper, PaginatedResult } from '@/shared/database/pagination';
import { AuditService } from '@/modules/audit';
import { logger } from '@/shared/logger';

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
   * Saves daily operational submission record from UI form.
   */
  public static async saveOperationalSubmission(
    record: DailyOperationalRecord,
    actor: UserAuthContext,
    changeReason?: string
  ): Promise<any> {
    if (!record || !record.territoryId || !record.reportDate) {
      throw new ValidationError('territoryId and reportDate are required');
    }

    // Server-side scope verification: CSR / TSO cannot save to unauthorized territories
    if (actor.role !== ROLES.SUPER_ADMIN) {
      if (actor.companyId && record.companyId && record.companyId !== actor.companyId) {
        throw new ForbiddenError('Cannot save submissions for another company');
      }
      if ((actor.role === ROLES.TSO || actor.role === ROLES.CSR) && actor.territoryId && actor.territoryId !== record.territoryId) {
        throw new ForbiddenError('You can only save submissions for your assigned territory');
      }
    }

    if (!record.companyId && actor.companyId) {
      record.companyId = actor.companyId;
    }

    return await dailySalesRepository.saveOperationalRecord(record, actor.id, changeReason);
  }

  /**
   * Retrieves paginated daily submissions with strict server-side scoping.
   */
  public static async getSubmissionsPaginated(
    options: Omit<SubmissionFilterOptions, 'companyId' | 'territoryId'> & {
      territoryId?: string | null;
      companyIdParam?: string | null;
    },
    actor: UserAuthContext
  ): Promise<PaginatedResult<any>> {
    let filterCompanyId = actor.role === ROLES.SUPER_ADMIN
      ? (options.companyIdParam && options.companyIdParam !== 'ALL' ? options.companyIdParam : null)
      : (actor.companyId || null);

    let filterTerritoryId = options.territoryId && options.territoryId !== 'ALL' ? options.territoryId : null;

    if (actor.role !== ROLES.SUPER_ADMIN) {
      if ((actor.role === ROLES.TSO || actor.role === ROLES.CSR) && actor.territoryId) {
        filterTerritoryId = actor.territoryId;
      }
    }

    return await dailySalesRepository.getPaginatedSubmissions({
      page: options.page,
      pageSize: options.pageSize,
      search: options.search,
      date: options.date,
      territoryId: filterTerritoryId,
      status: options.status,
      companyId: filterCompanyId,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
    });
  }

  /**
   * Exports submissions to CSV format.
   */
  public static async exportSubmissionsCsv(
    options: Omit<SubmissionFilterOptions, 'companyId' | 'territoryId'> & {
      territoryId?: string | null;
      companyIdParam?: string | null;
    },
    actor: UserAuthContext
  ): Promise<string> {
    const result = await this.getSubmissionsPaginated({ ...options, pageSize: -1 }, actor);
    return PaginationHelper.toCsv(result.data, {
      id: 'Submission ID',
      reporting_date: 'Reporting Date',
      territory_name: 'Territory',
      region_name: 'Region',
      status: 'Status',
      total_cigarette_sales: 'Cigarette Sales (Mio)',
      total_cigarette_stock: 'Closing Stock (Mio)',
      total_zarda_sales_value: 'Zarda Sales (BDT)',
      empty_packets: 'Empty Packets',
      remarks: 'Remarks',
    });
  }

  /**
   * Deletes submissions with tenant and lock status verification.
   */
  public static async deleteSubmissions(ids: string[], actor: UserAuthContext): Promise<number> {
    if (!ids || ids.length === 0) {
      throw new ValidationError('At least one Submission ID is required for deletion');
    }

    // Prevent cross-company deletion for non-super admin
    if (actor.role !== ROLES.SUPER_ADMIN) {
      const records = await dailySalesRepository.getSubmissionsForDeletionCheck(ids);
      const foreign = records.filter(r => r.company_id !== actor.companyId);
      if (foreign.length > 0) {
        throw new ForbiddenError('You can only delete submissions within your assigned company');
      }

      const locked = records.filter(r => r.status === 'FINALIZED' || r.is_locked);
      if (locked.length > 0 && actor.role !== ROLES.COMPANY_ADMIN) {
        throw new ForbiddenError('Cannot delete finalized or locked records without Admin unlock');
      }
    }

    await dailySalesRepository.deleteSubmissions(ids);

    // Centralized Audit Log
    await AuditService.logEvent({
      userId: actor.id,
      companyId: actor.companyId || null,
      eventType: AUDIT_ACTIONS.DELETE,
      entityName: 'daily_submissions',
      entityId: ids.join(','),
      oldValues: { deletedIds: ids },
    });

    return ids.length;
  }

  /**
   * Transitions workflow status (DRAFT -> SUBMITTED -> VERIFIED -> APPROVED -> FINALIZED).
   */
  public static async transitionStatus(
    params: {
      territoryId: string;
      reportDate: string;
      toStatus: SubmissionStatus;
      comments?: string;
      unlockReason?: string;
      isUnlock?: boolean;
    },
    actor: UserAuthContext
  ): Promise<any> {
    if (!params.territoryId || !params.reportDate || !params.toStatus) {
      throw new ValidationError('territoryId, reportDate, and toStatus are required');
    }

    // Enforce business rule: Unlock requires a mandatory reason, auto-filled for administrators
    let effectiveUnlockReason = params.unlockReason;
    if (params.toStatus !== 'FINALIZED' && params.isUnlock && !effectiveUnlockReason?.trim()) {
      if (actor.role === ROLES.SUPER_ADMIN || actor.role === ROLES.COMPANY_ADMIN) {
        effectiveUnlockReason = 'Administrative status override';
      } else {
        throw new ValidationError('A non-empty unlockReason is mandatory when unlocking finalized records');
      }
    }

    // Company scope verification
    if (actor.role !== ROLES.SUPER_ADMIN && actor.companyId) {
      const territoryCompany = await dailySalesRepository.resolveTerritoryCompany(params.territoryId);
      if (territoryCompany && territoryCompany !== actor.companyId) {
        throw new ForbiddenError('Cannot transition submissions from another company');
      }
    }

    return await dailySalesRepository.transitionWorkflow({
      territoryId: params.territoryId,
      reportDate: params.reportDate,
      toStatus: params.toStatus,
      userId: actor.id,
      comments: params.comments,
      unlockReason: effectiveUnlockReason,
    });
  }

  /**
   * Fetches submissions for a date.
   */
  public static async getSubmissions(reportingDate: string): Promise<any[]> {
    return await dailySalesRepository.getByDate(reportingDate);
  }

  /**
   * Fetches submissions for a date and territory.
   */
  public static async getSubmissionsByDateAndTerritory(date: string, territoryId: string): Promise<any[]> {
    return await dailySalesRepository.getByDateAndTerritory(date, territoryId);
  }
}
