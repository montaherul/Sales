// Application: Audit Service
// Records critical operations and provides audit query capabilities
// AGENTS1.md Rule 4 & Rule 6 (Application / Service Layer)

import { AuditEvent, AuditRecordProps } from '../domain/AuditEvent';
import { auditLogRepository, AuditFilterOptions } from '../infrastructure/AuditLogRepository';
import { UserAuthContext } from '@/shared/authorization';
import { ROLES } from '@/shared/constants';
import { ForbiddenError } from '@/shared/errors';
import { PaginationHelper, PaginatedResult } from '@/shared/database/pagination';

export class AuditService {
  /**
   * Logs a critical system event.
   */
  public static async logEvent(props: AuditRecordProps & { companyId?: string | null }): Promise<string> {
    const event = new AuditEvent(props);
    return await auditLogRepository.append(event, props.companyId, props.ipAddress);
  }

  /**
   * Fetches latest audit trail records.
   */
  public static async getLogs(limit: number = 50): Promise<any[]> {
    return await auditLogRepository.queryLogs(limit);
  }

  /**
   * Retrieves paginated audit logs with tenant scoping.
   */
  public static async getAuditLogsPaginated(
    options: Omit<AuditFilterOptions, 'companyId'> & { companyIdParam?: string | null },
    actor: UserAuthContext
  ): Promise<PaginatedResult<any>> {
    if (actor.role !== ROLES.SUPER_ADMIN && actor.role !== ROLES.COMPANY_ADMIN && actor.role !== ROLES.TENANT_ADMIN) {
      throw new ForbiddenError('Insufficient permissions to view audit logs');
    }

    const targetCompanyId = actor.role === ROLES.SUPER_ADMIN
      ? (options.companyIdParam && options.companyIdParam !== 'ALL' ? options.companyIdParam : null)
      : (actor.companyId || null);

    return await auditLogRepository.getPaginatedLogs({
      page: options.page,
      pageSize: options.pageSize,
      search: options.search,
      eventType: options.eventType,
      entityName: options.entityName,
      companyId: targetCompanyId,
      startDate: options.startDate,
      endDate: options.endDate,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
    });
  }

  /**
   * Exports audit trail to CSV format.
   */
  public static async exportAuditLogsCsv(
    options: Omit<AuditFilterOptions, 'companyId'> & { companyIdParam?: string | null },
    actor: UserAuthContext
  ): Promise<string> {
    const result = await this.getAuditLogsPaginated({ ...options, pageSize: -1 }, actor);
    return PaginationHelper.toCsv(result.data, {
      id: 'Log ID',
      created_at: 'Timestamp',
      event_type: 'Event Type',
      entity_name: 'Target Entity',
      entity_id: 'Record ID',
      user_email: 'Actor Email',
      ip_address: 'IP Address',
    });
  }
}
