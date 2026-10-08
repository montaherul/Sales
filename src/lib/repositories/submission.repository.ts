// Submission Repository Layer
// Connects directly to Supabase PostgreSQL with transparent local fallback

import { DailyOperationalRecord, SubmissionStatus } from '@/lib/types';
import { dbQuery, getDbPool } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export interface AuditLogEntry {
  id: string;
  userId: string;
  eventType: string;
  entityName: string;
  entityId: string;
  oldValues?: any;
  newValues?: any;
  timestamp: string;
}

export interface VersionSnapshotEntry {
  id: string;
  submissionId: string;
  versionNumber: number;
  snapshot: any;
  modifiedBy: string;
  reason: string;
  createdAt: string;
}

// In-memory & local file backed fallback state
const STORAGE_FILE = path.resolve(process.cwd(), '.submissions-store.json');

interface LocalStoreState {
  submissions: Record<string, DailyOperationalRecord>;
  versions: VersionSnapshotEntry[];
  auditLogs: AuditLogEntry[];
}

function loadStore(): LocalStoreState {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to load local store fallback:', err);
  }

  return {
    submissions: {},
    versions: [],
    auditLogs: [],
  };
}

function saveStore(state: LocalStoreState): void {
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save store:', err);
  }
}

function mapRowToRecord(row: any): DailyOperationalRecord {
  const cSales = {
    wilson: parseFloat(row.c_wilson_sales || 0),
    shahara: parseFloat(row.c_shahara_sales || 0),
    express: parseFloat(row.c_express_sales || 0),
    nexus: parseFloat(row.c_nexus_sales || 0),
    sb: parseFloat(row.c_sb_sales || 0),
    sm: parseFloat(row.c_sm_sales || 0),
  };

  const cStock = {
    wilson: parseFloat(row.c_wilson_stock || 0),
    shahara: parseFloat(row.c_shahara_stock || 0),
    express: parseFloat(row.c_express_stock || 0),
    nexus: parseFloat(row.c_nexus_stock || 0),
    sb: parseFloat(row.c_sb_stock || 0),
    sm: parseFloat(row.c_sm_stock || 0),
  };

  const zSales = {
    slb: parseFloat(row.z_slb_sales || 0),
    qty_22_25: parseInt(row.z_22_25_sales || 0, 10),
    qty_99_14: parseInt(row.z_99_14_sales || 0, 10),
    qty_33_15: parseInt(row.z_33_15_sales || 0, 10),
  };

  const zStock = {
    slb: parseFloat(row.z_slb_stock || 0),
    qty_22_25: parseInt(row.z_22_25_stock || 0, 10),
    qty_99_14: parseInt(row.z_99_14_stock || 0, 10),
    qty_33_15: parseInt(row.z_33_15_stock || 0, 10),
  };

  const totalCigaretteSales = Object.values(cSales).reduce((acc, v) => acc + v, 0);
  const totalCigaretteStock = Object.values(cStock).reduce((acc, v) => acc + v, 0);
  const totalZardaSalesValue = (zSales.qty_22_25 * 15) + (zSales.qty_99_14 * 6) + (zSales.qty_33_15 * 8);
  const totalZardaStockValue = (zStock.qty_22_25 * 15) + (zStock.qty_99_14 * 6) + (zStock.qty_33_15 * 8);

  return {
    territoryId: row.territory_id || row.territory_name,
    territoryName: row.territory_name,
    regionName: row.region_name || 'Satkania',
    reportDate: row.report_date,
    dayNumber: parseInt(row.day_number || 1, 10),
    status: row.status as SubmissionStatus,
    cigaretteSales: cSales,
    cigaretteStock: cStock,
    zardaSales: zSales,
    zardaStock: zStock,
    emptyPackets: parseInt(row.empty_packets || 0, 10),
    remarks: row.remarks || '',
    totalCigaretteSales: parseFloat(totalCigaretteSales.toFixed(4)),
    totalCigaretteStock: parseFloat(totalCigaretteStock.toFixed(4)),
    totalZardaSalesValue,
    totalZardaStockValue,
  };
}

export class SubmissionRepository {
  /**
   * Fetches submissions from Supabase PostgreSQL (or local fallback)
   */
  static async getSubmissions(filter?: {
    date?: string;
    territoryId?: string;
    status?: SubmissionStatus;
  }): Promise<DailyOperationalRecord[]> {
    if (getDbPool()) {
      try {
        let whereClauses: string[] = [];
        let params: any[] = [];
        let idx = 1;

        if (filter?.date) {
          whereClauses.push(`s.report_date = $${idx++}`);
          params.push(filter.date);
        }
        if (filter?.territoryId) {
          whereClauses.push(`(s.territory_id::text = $${idx} OR t.name = $${idx})`);
          params.push(filter.territoryId);
          idx++;
        }
        if (filter?.status) {
          whereClauses.push(`s.status = $${idx++}`);
          params.push(filter.status);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const sql = `
          SELECT 
            s.id as submission_id,
            s.territory_id,
            t.name as territory_name,
            r.name as region_name,
            s.report_date::text as report_date,
            EXTRACT(DAY FROM s.report_date)::int as day_number,
            s.status,
            s.is_locked,
            s.unlock_reason,
            COALESCE((SELECT quantity FROM daily_sales ds JOIN brands b ON ds.brand_id = b.id WHERE ds.submission_id = s.id AND b.name = 'Wilson'), 0)::numeric as c_wilson_sales,
            COALESCE((SELECT quantity FROM daily_sales ds JOIN brands b ON ds.brand_id = b.id WHERE ds.submission_id = s.id AND b.name = 'Shahara'), 0)::numeric as c_shahara_sales,
            COALESCE((SELECT quantity FROM daily_sales ds JOIN brands b ON ds.brand_id = b.id WHERE ds.submission_id = s.id AND b.name = 'Express'), 0)::numeric as c_express_sales,
            COALESCE((SELECT quantity FROM daily_sales ds JOIN brands b ON ds.brand_id = b.id WHERE ds.submission_id = s.id AND b.name = 'Nexus'), 0)::numeric as c_nexus_sales,
            COALESCE((SELECT quantity FROM daily_sales ds JOIN brands b ON ds.brand_id = b.id WHERE ds.submission_id = s.id AND b.name = 'SB'), 0)::numeric as c_sb_sales,
            COALESCE((SELECT quantity FROM daily_sales ds JOIN brands b ON ds.brand_id = b.id WHERE ds.submission_id = s.id AND b.name = 'SM'), 0)::numeric as c_sm_sales,
            COALESCE((SELECT closing_stock FROM daily_stock dst JOIN brands b ON dst.brand_id = b.id WHERE dst.submission_id = s.id AND b.name = 'Wilson'), 0)::numeric as c_wilson_stock,
            COALESCE((SELECT closing_stock FROM daily_stock dst JOIN brands b ON dst.brand_id = b.id WHERE dst.submission_id = s.id AND b.name = 'Shahara'), 0)::numeric as c_shahara_stock,
            COALESCE((SELECT closing_stock FROM daily_stock dst JOIN brands b ON dst.brand_id = b.id WHERE dst.submission_id = s.id AND b.name = 'Express'), 0)::numeric as c_express_stock,
            COALESCE((SELECT closing_stock FROM daily_stock dst JOIN brands b ON dst.brand_id = b.id WHERE dst.submission_id = s.id AND b.name = 'Nexus'), 0)::numeric as c_nexus_stock,
            COALESCE((SELECT closing_stock FROM daily_stock dst JOIN brands b ON dst.brand_id = b.id WHERE dst.submission_id = s.id AND b.name = 'SB'), 0)::numeric as c_sb_stock,
            COALESCE((SELECT closing_stock FROM daily_stock dst JOIN brands b ON dst.brand_id = b.id WHERE dst.submission_id = s.id AND b.name = 'SM'), 0)::numeric as c_sm_stock,
            COALESCE((SELECT quantity FROM zarda_sales zs JOIN brands b ON zs.brand_id = b.id WHERE zs.submission_id = s.id AND b.name = 'SLB'), 0)::numeric as z_slb_sales,
            COALESCE((SELECT quantity FROM zarda_sales zs JOIN brands b ON zs.brand_id = b.id WHERE zs.submission_id = s.id AND b.name = '22/25'), 0)::int as z_22_25_sales,
            COALESCE((SELECT quantity FROM zarda_sales zs JOIN brands b ON zs.brand_id = b.id WHERE zs.submission_id = s.id AND b.name = '99/14'), 0)::int as z_99_14_sales,
            COALESCE((SELECT quantity FROM zarda_sales zs JOIN brands b ON zs.brand_id = b.id WHERE zs.submission_id = s.id AND b.name = '33/15'), 0)::int as z_33_15_sales,
            COALESCE((SELECT closing_stock FROM zarda_stock zst JOIN brands b ON zst.brand_id = b.id WHERE zst.submission_id = s.id AND b.name = 'SLB'), 0)::numeric as z_slb_stock,
            COALESCE((SELECT closing_stock FROM zarda_stock zst JOIN brands b ON zst.brand_id = b.id WHERE zst.submission_id = s.id AND b.name = '22/25'), 0)::int as z_22_25_stock,
            COALESCE((SELECT closing_stock FROM zarda_stock zst JOIN brands b ON zst.brand_id = b.id WHERE zst.submission_id = s.id AND b.name = '99/14'), 0)::int as z_99_14_stock,
            COALESCE((SELECT closing_stock FROM zarda_stock zst JOIN brands b ON zst.brand_id = b.id WHERE zst.submission_id = s.id AND b.name = '33/15'), 0)::int as z_33_15_stock,
            COALESCE((SELECT quantity FROM empty_packets ep JOIN brands b ON ep.brand_id = b.id WHERE ep.submission_id = s.id AND b.name = 'Express'), 0)::int as empty_packets,
            COALESCE((SELECT remarks FROM empty_packets ep JOIN brands b ON ep.brand_id = b.id WHERE ep.submission_id = s.id AND b.name = 'Express'), '') as remarks
          FROM daily_submissions s
          JOIN territories t ON s.territory_id = t.id
          JOIN regions r ON t.region_id = r.id
          ${whereSql}
          ORDER BY t.sort_order;
        `;

        const res = await dbQuery(sql, params);
        if (res.rows.length > 0) {
          return res.rows.map(mapRowToRecord);
        }
      } catch (err) {
        console.warn('Database query failed, falling back to local store:', err);
      }
    }

    // Local Store Fallback
    const store = loadStore();
    let records = Object.values(store.submissions);

    if (filter?.date) {
      records = records.filter((r) => r.reportDate === filter.date);
    }
    if (filter?.territoryId) {
      records = records.filter((r) => r.territoryId === filter.territoryId);
    }
    if (filter?.status) {
      records = records.filter((r) => r.status === filter.status);
    }

    return records;
  }

  /**
   * Saves or updates a daily submission record
   */
  static async saveSubmission(
    record: DailyOperationalRecord,
    userId: string,
    changeReason?: string
  ): Promise<DailyOperationalRecord> {
    if (getDbPool()) {
      try {
        // Resolve territory ID
        const terrRes = await dbQuery(
          'SELECT id FROM territories WHERE id::text = $1 OR name ILIKE $2 LIMIT 1;',
          [record.territoryId, record.territoryName]
        );
        const terrId = terrRes.rows[0]?.id;

        // Resolve user ID
        const userRes = await dbQuery(
          'SELECT id FROM user_profiles WHERE id::text = $1 OR email ILIKE $2 LIMIT 1;',
          [userId, userId]
        );
        const userUuid = userRes.rows[0]?.id;

        if (terrId) {
          // Resolve territory company
          const compRes = await dbQuery(`
            SELECT d.company_id 
            FROM territories t 
            JOIN regions r ON t.region_id = r.id 
            JOIN wings w ON r.wing_id = w.id 
            JOIN divisions d ON w.division_id = d.id 
            WHERE t.id = $1 LIMIT 1
          `, [terrId]);
          const compId = compRes.rows[0]?.company_id;

          // Upsert submission
          const subRes = await dbQuery(`
            INSERT INTO daily_submissions (territory_id, report_date, status, created_by, company_id)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (territory_id, report_date) DO UPDATE
            SET status = EXCLUDED.status, company_id = COALESCE(daily_submissions.company_id, EXCLUDED.company_id), updated_at = NOW()
            RETURNING id, status;
          `, [terrId, record.reportDate, record.status, userUuid, compId]);

          const submissionId = subRes.rows[0].id;

          // Fetch brands map for this company
          const brandsRes = await dbQuery(
            'SELECT id, name FROM brands WHERE company_id IS NULL OR company_id = $1;',
            [compId]
          );
          const brandMap: Record<string, string> = {};
          brandsRes.rows.forEach(b => brandMap[b.name.toLowerCase()] = b.id);

          // Save Cigarette Sales & Stock
          for (const [brandKey, qty] of Object.entries(record.cigaretteSales)) {
            const bId = brandMap[brandKey.toLowerCase()];
            if (bId) {
              await dbQuery(`
                INSERT INTO daily_sales (submission_id, brand_id, quantity)
                VALUES ($1, $2, $3)
                ON CONFLICT (submission_id, brand_id) DO UPDATE SET quantity = EXCLUDED.quantity;
              `, [submissionId, bId, qty]);
            }
          }

          for (const [brandKey, stk] of Object.entries(record.cigaretteStock)) {
            const bId = brandMap[brandKey.toLowerCase()];
            if (bId) {
              await dbQuery(`
                INSERT INTO daily_stock (submission_id, brand_id, closing_stock)
                VALUES ($1, $2, $3)
                ON CONFLICT (submission_id, brand_id) DO UPDATE SET closing_stock = EXCLUDED.closing_stock;
              `, [submissionId, bId, stk]);
            }
          }

          // Save Zarda Sales & Stock
          const zardaBrands = [
            { key: 'slb', name: 'SLB', qty: record.zardaSales.slb, stk: record.zardaStock.slb, price: 0 },
            { key: '22/25', name: '22/25', qty: record.zardaSales.qty_22_25, stk: record.zardaStock.qty_22_25, price: 15 },
            { key: '99/14', name: '99/14', qty: record.zardaSales.qty_99_14, stk: record.zardaStock.qty_99_14, price: 6 },
            { key: '33/15', name: '33/15', qty: record.zardaSales.qty_33_15, stk: record.zardaStock.qty_33_15, price: 8 },
          ];

          for (const zb of zardaBrands) {
            const bId = brandMap[zb.name.toLowerCase()];
            if (bId) {
              await dbQuery(`
                INSERT INTO zarda_sales (submission_id, brand_id, quantity, unit_price, total_value)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (submission_id, brand_id) DO UPDATE
                SET quantity = EXCLUDED.quantity, unit_price = EXCLUDED.unit_price, total_value = EXCLUDED.total_value;
              `, [submissionId, bId, zb.qty, zb.price, zb.qty * zb.price]);

              await dbQuery(`
                INSERT INTO zarda_stock (submission_id, brand_id, closing_stock, unit_price, total_value)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (submission_id, brand_id) DO UPDATE
                SET closing_stock = EXCLUDED.closing_stock, unit_price = EXCLUDED.unit_price, total_value = EXCLUDED.total_value;
              `, [submissionId, bId, zb.stk, zb.price, zb.stk * zb.price]);
            }
          }

          // Empty packets
          const expressId = brandMap['express'];
          if (expressId) {
            await dbQuery(`
              INSERT INTO empty_packets (submission_id, brand_id, quantity, remarks)
              VALUES ($1, $2, $3, $4)
              ON CONFLICT (submission_id, brand_id) DO UPDATE
              SET quantity = EXCLUDED.quantity, remarks = EXCLUDED.remarks;
            `, [submissionId, expressId, record.emptyPackets, record.remarks]);
          }

          // Write audit log to database
          await dbQuery(`
            INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, new_values)
            VALUES ($1, 'SALES_UPDATE', 'daily_submissions', $2, $3);
          `, [userUuid, submissionId, JSON.stringify(record)]);
        }
      } catch (err) {
        console.warn('Database save failed, continuing with local store sync:', err);
      }
    }

    // Keep local store in sync
    const store = loadStore();
    const key = `${record.territoryId}_${record.reportDate}`;
    const existing = store.submissions[key];

    if (existing && existing.status !== 'DRAFT') {
      const versionsForRecord = store.versions.filter((v) => v.submissionId === key);
      const nextVer = versionsForRecord.length + 1;

      store.versions.push({
        id: `ver-${Date.now()}-${nextVer}`,
        submissionId: key,
        versionNumber: nextVer,
        snapshot: existing,
        modifiedBy: userId,
        reason: changeReason || 'Data update',
        createdAt: new Date().toISOString(),
      });
    }

    store.submissions[key] = record;
    store.auditLogs.push({
      id: `audit-${Date.now()}`,
      userId,
      eventType: existing ? 'SALES_UPDATE' : 'SALES_CREATE',
      entityName: 'daily_submissions',
      entityId: key,
      oldValues: existing,
      newValues: record,
      timestamp: new Date().toISOString(),
    });

    saveStore(store);
    return record;
  }

  /**
   * Transitions submission workflow state with audit logging
   */
  static async transitionStatus(params: {
    territoryId: string;
    reportDate: string;
    toStatus: SubmissionStatus;
    userId: string;
    comments?: string;
    unlockReason?: string;
  }): Promise<DailyOperationalRecord> {
    if (getDbPool()) {
      try {
        const terrRes = await dbQuery(
          'SELECT id FROM territories WHERE id::text = $1 OR name ILIKE $2 LIMIT 1;',
          [params.territoryId, params.territoryId]
        );
        const terrId = terrRes.rows[0]?.id;

        if (terrId) {
          const updateRes = await dbQuery(`
            UPDATE daily_submissions 
            SET status = $1, unlock_reason = COALESCE($2, unlock_reason), updated_at = NOW()
            WHERE territory_id = $3 AND report_date = $4
            RETURNING id, status;
          `, [params.toStatus, params.unlockReason, terrId, params.reportDate]);

          if (updateRes.rows.length > 0) {
            const subId = updateRes.rows[0].id;
            await dbQuery(`
              INSERT INTO approval_history (submission_id, from_status, to_status, comments)
              VALUES ($1, 'SUBMITTED', $2, $3);
            `, [subId, params.toStatus, params.comments || 'Status transitioned']);
          }
        }
      } catch (err) {
        console.warn('Database workflow transition failed, using local store:', err);
      }
    }

    const store = loadStore();
    const key = `${params.territoryId}_${params.reportDate}`;
    let record = store.submissions[key];

    if (!record) {
      // Find by matching territory name if key not found
      const matching = Object.values(store.submissions).find(
        r => (r.territoryId === params.territoryId || r.territoryName === params.territoryId) && r.reportDate === params.reportDate
      );
      if (matching) {
        record = matching;
      }
    }

    if (record) {
      const oldStatus = record.status;
      record.status = params.toStatus;

      store.auditLogs.push({
        id: `audit-${Date.now()}`,
        userId: params.userId,
        eventType: `STATUS_${params.toStatus}`,
        entityName: 'daily_submissions',
        entityId: key,
        oldValues: { status: oldStatus },
        newValues: { 
          status: params.toStatus, 
          comments: params.comments, 
          unlockReason: params.unlockReason 
        },
        timestamp: new Date().toISOString(),
      });

      saveStore(store);
      return record;
    }

    return {
      territoryId: params.territoryId,
      territoryName: params.territoryId,
      regionName: 'Satkania',
      reportDate: params.reportDate,
      dayNumber: 6,
      status: params.toStatus,
      cigaretteSales: { wilson: 0, shahara: 0, express: 0, nexus: 0, sb: 0, sm: 0 },
      cigaretteStock: { wilson: 0, shahara: 0, express: 0, nexus: 0, sb: 0, sm: 0 },
      zardaSales: { slb: 0, qty_22_25: 0, qty_99_14: 0, qty_33_15: 0 },
      zardaStock: { slb: 0, qty_22_25: 0, qty_99_14: 0, qty_33_15: 0 },
      emptyPackets: 0,
      remarks: '',
      totalCigaretteSales: 0,
      totalCigaretteStock: 0,
      totalZardaSalesValue: 0,
      totalZardaStockValue: 0,
    };
  }

  /**
   * Records an explicit audit log entry
   */
  static async recordAuditLog(
    eventType: string,
    userId: string,
    entityName: string,
    entityId: string,
    oldValues?: any,
    newValues?: any
  ): Promise<AuditLogEntry> {
    if (getDbPool()) {
      try {
        const userRes = await dbQuery(
          'SELECT id FROM user_profiles WHERE id::text = $1 OR email ILIKE $2 LIMIT 1;',
          [userId, userId]
        );
        const userUuid = userRes.rows[0]?.id;

        const res = await dbQuery(`
          INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, old_values, new_values)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, created_at;
        `, [
          userUuid,
          eventType,
          entityName,
          entityId.includes('-') ? entityId : null,
          oldValues ? JSON.stringify(oldValues) : null,
          newValues ? JSON.stringify(newValues) : null,
        ]);

        return {
          id: res.rows[0].id,
          userId,
          eventType,
          entityName,
          entityId,
          oldValues,
          newValues,
          timestamp: res.rows[0].created_at,
        };
      } catch (err) {
        console.warn('Database audit log failed, fallback to local store:', err);
      }
    }

    const store = loadStore();
    const entry: AuditLogEntry = {
      id: `audit-${Date.now()}`,
      userId,
      eventType,
      entityName,
      entityId,
      oldValues,
      newValues,
      timestamp: new Date().toISOString(),
    };
    store.auditLogs.push(entry);
    saveStore(store);
    return entry;
  }

  /**
   * Retrieves audit log entries from Supabase (or local fallback)
   */
  static async getAuditLogs(): Promise<AuditLogEntry[]> {
    if (getDbPool()) {
      try {
        const res = await dbQuery(`
          SELECT 
            al.id::text,
            COALESCE(u.email, al.user_id::text, 'System') as user_id,
            al.event_type,
            al.entity_name,
            COALESCE(al.entity_id::text, '') as entity_id,
            al.old_values,
            al.new_values,
            al.created_at::text as timestamp
          FROM audit_logs al
          LEFT JOIN user_profiles u ON al.user_id = u.id
          ORDER BY al.created_at DESC
          LIMIT 100;
        `);

        if (res.rows.length > 0) {
          return res.rows.map(r => ({
            id: r.id,
            userId: r.user_id,
            eventType: r.event_type,
            entityName: r.entity_name,
            entityId: r.entity_id,
            oldValues: r.old_values,
            newValues: r.new_values,
            timestamp: r.timestamp,
          }));
        }
      } catch (err) {
        console.warn('Database audit logs query failed, falling back to local store:', err);
      }
    }

    const store = loadStore();
    return store.auditLogs.slice().reverse();
  }
}
