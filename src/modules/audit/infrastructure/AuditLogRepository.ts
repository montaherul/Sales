// Infrastructure: Selective Audit Log Repository
// Enforces immutable append-only writes to audit_logs in PostgreSQL

import { AuditEvent } from '../domain/AuditEvent';
import { dbQuery } from '@/shared/database/db';
import { logger } from '@/shared/logger';
import fs from 'fs';
import path from 'path';

import { PaginationHelper, PaginatedResult } from '@/shared/database/pagination';

const FALLBACK_STORE_FILE = path.resolve(process.cwd(), '.submissions-store.json');

export interface AuditFilterOptions {
  page: number;
  pageSize: number;
  search?: string;
  eventType?: string | null;
  entityName?: string | null;
  companyId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class AuditLogRepository {
  /**
   * Queries paginated audit logs using stored procedure sp_get_audit_logs_paginated.
   */
  public async getPaginatedLogs(options: AuditFilterOptions): Promise<PaginatedResult<any>> {
    const cleanSortBy = (options.sortBy || 'a.created_at').replace(/^a\./, '');
    return await PaginationHelper.executeFunction(
      'sp_get_audit_logs_paginated',
      [
        options.page,
        options.pageSize,
        options.search || null,
        options.eventType || null,
        options.entityName || null,
        options.companyId || null,
        options.startDate || null,
        options.endDate || null,
        cleanSortBy,
        options.sortOrder || 'desc',
      ]
    );
  }
  /**
   * Appends an immutable audit event to audit_logs.
   */
  public async append(event: AuditEvent, companyId?: string | null, ipAddress?: string | null): Promise<string> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const crypto = await import('crypto');
    const id = crypto.randomUUID();
    const validUserId = isUuid.test(event.userId) ? event.userId : null;
    const validEntityId = isUuid.test(event.entityId) ? event.entityId : null;
    const enrichedNewValues = {
      ...(typeof event.newValues === 'object' && event.newValues ? event.newValues : {}),
      ...(!validUserId && event.userId ? { rawUserId: event.userId } : {}),
      ...(!validEntityId && event.entityId ? { rawEntityId: event.entityId } : {}),
    };

    try {
      await dbQuery(
        `INSERT INTO audit_logs (id, user_id, event_type, entity_name, entity_id, old_values, new_values, created_at, company_id, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          id,
          validUserId,
          event.eventType,
          event.entityName,
          validEntityId,
          event.oldValues ? JSON.stringify(event.oldValues) : null,
          Object.keys(enrichedNewValues).length > 0 ? JSON.stringify(enrichedNewValues) : null,
          event.timestamp || new Date().toISOString(),
          companyId || null,
          ipAddress || null,
        ]
      );
      return id;
    } catch (err) {
      logger.warn('PostgreSQL audit log append failed, writing to fallback store', 'AuditLogRepository', { err });
      // Local fallback append
      try {
        let store = { auditLogs: [] as any[] };
        if (fs.existsSync(FALLBACK_STORE_FILE)) {
          store = JSON.parse(fs.readFileSync(FALLBACK_STORE_FILE, 'utf-8'));
        }
        if (!store.auditLogs) store.auditLogs = [];
        store.auditLogs.unshift({ id, ...event });
        fs.writeFileSync(FALLBACK_STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
      } catch (err) {
        logger.warn('Failed to append to local fallback audit log', 'AuditLogRepository', { err });
      }
      return id;
    }
  }

  /**
   * Queries audit logs with pagination and filters.
   */
  public async queryLogs(limit: number = 50): Promise<any[]> {
    try {
      const res = await dbQuery(
        `SELECT a.id, a.user_id, a.event_type, a.entity_name, a.entity_id,
                a.old_values, a.new_values, a.created_at,
                u.full_name as user_name, u.email as user_email
         FROM audit_logs a
         LEFT JOIN user_profiles u ON a.user_id = u.id
         ORDER BY a.created_at DESC
         LIMIT $1`,
        [limit]
      );
      return res.rows;
    } catch (dbErr) {
      logger.warn('Failed to query audit_logs from database, attempting fallback store', 'AuditLogRepository', { dbErr });
      // Local fallback
      try {
        if (fs.existsSync(FALLBACK_STORE_FILE)) {
          const store = JSON.parse(fs.readFileSync(FALLBACK_STORE_FILE, 'utf-8'));
          return (store.auditLogs || []).slice(0, limit);
        }
      } catch (parseErr) {
        logger.warn('Failed to parse fallback audit logs file', 'AuditLogRepository', { parseErr });
      }
      return [];
    }
  }
}

export const auditLogRepository = new AuditLogRepository();
