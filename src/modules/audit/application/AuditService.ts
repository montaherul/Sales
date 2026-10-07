// Application: Audit Service
// Records critical operations and provides audit query capabilities

import { AuditEvent, AuditRecordProps } from '../domain/AuditEvent';
import { auditLogRepository } from '../infrastructure/AuditLogRepository';

export class AuditService {
  /**
   * Logs a critical system event.
   */
  public static async logEvent(props: AuditRecordProps): Promise<string> {
    const event = new AuditEvent(props);
    return await auditLogRepository.append(event);
  }

  /**
   * Fetches latest audit trail records.
   */
  public static async getLogs(limit: number = 50): Promise<any[]> {
    return await auditLogRepository.queryLogs(limit);
  }
}
