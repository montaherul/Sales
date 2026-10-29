// Submission Repository Layer
// Connects directly to Supabase PostgreSQL with transparent local fallback

import { DailyOperationalRecord, SubmissionStatus } from '@/lib/types';
import { dbQuery, getDbPool } from '@/lib/db';
import { logger } from '@/shared/logger';
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
    logger.warn('Failed to load local store fallback', 'SubmissionRepository', { err });
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
    logger.warn('Failed to save store', 'SubmissionRepository', { err });
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
            COALESCE((SELECT ds.quantity FROM daily_sales ds JOIN brands b ON ds.brand_id = b.id WHERE ds.submission_id = s.id AND b.name ILIKE 'Wilson' LIMIT 1), 0)::numeric as c_wilson_sales,
            COALESCE((SELECT ds.quantity FROM daily_sales ds JOIN brands b ON ds.brand_id = b.id WHERE ds.submission_id = s.id AND b.name ILIKE 'Shahara' LIMIT 1), 0)::numeric as c_shahara_sales,
            COALESCE((SELECT ds.quantity FROM daily_sales ds JOIN brands b ON ds.brand_id = b.id WHERE ds.submission_id = s.id AND b.name ILIKE 'Express' LIMIT 1), 0)::numeric as c_express_sales,
            COALESCE((SELECT ds.quantity FROM daily_sales ds JOIN brands b ON ds.brand_id = b.id WHERE ds.submission_id = s.id AND b.name ILIKE 'Nexus' LIMIT 1), 0)::numeric as c_nexus_sales,
            COALESCE((SELECT ds.quantity FROM daily_sales ds JOIN brands b ON ds.brand_id = b.id WHERE ds.submission_id = s.id AND b.name ILIKE 'SB' LIMIT 1), 0)::numeric as c_sb_sales,
            COALESCE((SELECT ds.quantity FROM daily_sales ds JOIN brands b ON ds.brand_id = b.id WHERE ds.submission_id = s.id AND b.name ILIKE 'SM' LIMIT 1), 0)::numeric as c_sm_sales,
            COALESCE((SELECT dst.closing_stock FROM daily_stock dst JOIN brands b ON dst.brand_id = b.id WHERE dst.submission_id = s.id AND b.name ILIKE 'Wilson' LIMIT 1), 0)::numeric as c_wilson_stock,
            COALESCE((SELECT dst.closing_stock FROM daily_stock dst JOIN brands b ON dst.brand_id = b.id WHERE dst.submission_id = s.id AND b.name ILIKE 'Shahara' LIMIT 1), 0)::numeric as c_shahara_stock,
            COALESCE((SELECT dst.closing_stock FROM daily_stock dst JOIN brands b ON dst.brand_id = b.id WHERE dst.submission_id = s.id AND b.name ILIKE 'Express' LIMIT 1), 0)::numeric as c_express_stock,
            COALESCE((SELECT dst.closing_stock FROM daily_stock dst JOIN brands b ON dst.brand_id = b.id WHERE dst.submission_id = s.id AND b.name ILIKE 'Nexus' LIMIT 1), 0)::numeric as c_nexus_stock,
            COALESCE((SELECT dst.closing_stock FROM daily_stock dst JOIN brands b ON dst.brand_id = b.id WHERE dst.submission_id = s.id AND b.name ILIKE 'SB' LIMIT 1), 0)::numeric as c_sb_stock,
            COALESCE((SELECT dst.closing_stock FROM daily_stock dst JOIN brands b ON dst.brand_id = b.id WHERE dst.submission_id = s.id AND b.name ILIKE 'SM' LIMIT 1), 0)::numeric as c_sm_stock,
            COALESCE((SELECT zs.quantity FROM zarda_sales zs JOIN brands b ON zs.brand_id = b.id WHERE zs.submission_id = s.id AND b.name ILIKE 'SLB' LIMIT 1), 0)::numeric as z_slb_sales,
            COALESCE((SELECT zs.quantity FROM zarda_sales zs JOIN brands b ON zs.brand_id = b.id WHERE zs.submission_id = s.id AND b.name ILIKE '22/25' LIMIT 1), 0)::int as z_22_25_sales,
            COALESCE((SELECT zs.quantity FROM zarda_sales zs JOIN brands b ON zs.brand_id = b.id WHERE zs.submission_id = s.id AND b.name ILIKE '99/14' LIMIT 1), 0)::int as z_99_14_sales,
            COALESCE((SELECT zs.quantity FROM zarda_sales zs JOIN brands b ON zs.brand_id = b.id WHERE zs.submission_id = s.id AND b.name ILIKE '33/15' LIMIT 1), 0)::int as z_33_15_sales,
            COALESCE((SELECT zst.closing_stock FROM zarda_stock zst JOIN brands b ON zst.brand_id = b.id WHERE zst.submission_id = s.id AND b.name ILIKE 'SLB' LIMIT 1), 0)::numeric as z_slb_stock,
            COALESCE((SELECT zst.closing_stock FROM zarda_stock zst JOIN brands b ON zst.brand_id = b.id WHERE zst.submission_id = s.id AND b.name ILIKE '22/25' LIMIT 1), 0)::int as z_22_25_stock,
            COALESCE((SELECT zst.closing_stock FROM zarda_stock zst JOIN brands b ON zst.brand_id = b.id WHERE zst.submission_id = s.id AND b.name ILIKE '99/14' LIMIT 1), 0)::int as z_99_14_stock,
            COALESCE((SELECT zst.closing_stock FROM zarda_stock zst JOIN brands b ON zst.brand_id = b.id WHERE zst.submission_id = s.id AND b.name ILIKE '33/15' LIMIT 1), 0)::int as z_33_15_stock,
            COALESCE((SELECT ep.quantity FROM empty_packets ep JOIN brands b ON ep.brand_id = b.id WHERE ep.submission_id = s.id AND b.name ILIKE 'Express' LIMIT 1), 0)::int as empty_packets,
            COALESCE((SELECT ep.remarks FROM empty_packets ep JOIN brands b ON ep.brand_id = b.id WHERE ep.submission_id = s.id AND b.name ILIKE 'Express' LIMIT 1), '') as remarks
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
   * High-Performance Bulk Insertion for Import
   * Reduces thousands of individual SQL round-trips down to a single atomic batch
   */
  static async saveSubmissionsBatch(
    records: DailyOperationalRecord[],
    userId: string,
    changeReason?: string
  ): Promise<DailyOperationalRecord[]> {
    if (!records || records.length === 0) return [];

    if (getDbPool()) {
      try {
        const { withTransaction } = await import('@/shared/database/db');
        await withTransaction(async (client) => {
          // 1. Resolve user ID once upfront safely
          const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          let userUuid: string | null = null;
          if (UUID_REGEX.test(userId)) {
            userUuid = userId;
          } else {
            const userRes = await client.query(
              'SELECT id FROM user_profiles WHERE id::text = $1 OR email ILIKE $2 LIMIT 1;',
              [userId, userId]
            );
            userUuid = userRes.rows[0]?.id || null;
          }

          // 2. Pre-fetch all territories and company IDs once upfront
          const terrRes = await client.query(`
            SELECT t.id, t.name, d.company_id 
            FROM territories t 
            JOIN regions r ON t.region_id = r.id 
            JOIN wings w ON r.wing_id = w.id 
            JOIN divisions d ON w.division_id = d.id;
          `);
          const terrLookup = new Map<string, { id: string; name: string; companyId: string }>();
          for (const row of terrRes.rows) {
            terrLookup.set(String(row.id).toLowerCase(), { id: row.id, name: row.name, companyId: row.company_id });
            terrLookup.set(String(row.name).toLowerCase(), { id: row.id, name: row.name, companyId: row.company_id });
            const clean = String(row.name).toLowerCase().replace(/[^a-z0-9]/g, '');
            terrLookup.set(clean, { id: row.id, name: row.name, companyId: row.company_id });
          }

          // 3. Pre-fetch all brands once upfront
          const brandsRes = await client.query('SELECT id, name FROM brands;');
          const brandMap = new Map<string, string>();
          for (const b of brandsRes.rows) {
            brandMap.set(b.name.toLowerCase(), b.id);
          }

          // 4. Batch Upsert daily_submissions in chunks of 100
          const submissionIdMap = new Map<string, string>();
          const chunkSize = 100;

          for (let i = 0; i < records.length; i += chunkSize) {
            const chunk = records.slice(i, i + chunkSize);
            const subPlaceholders: string[] = [];
            const subValues: any[] = [];
            let pIdx = 1;

            for (const r of chunk) {
              const rawKey1 = String(r.territoryId || '').toLowerCase();
              const rawKey2 = String(r.territoryName || '').toLowerCase();
              const cleanKey1 = rawKey1.replace(/[^a-z0-9]/g, '');
              const cleanKey2 = rawKey2.replace(/[^a-z0-9]/g, '');
              const matchedTerr =
                terrLookup.get(rawKey1) ||
                terrLookup.get(rawKey2) ||
                terrLookup.get(cleanKey1) ||
                terrLookup.get(cleanKey2);
              const terrId = matchedTerr?.id || (UUID_REGEX.test(r.territoryId) ? r.territoryId : null);
              if (!terrId) continue;

              const compId = r.companyId || matchedTerr?.companyId || null;

              subPlaceholders.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`);
              subValues.push(terrId, r.reportDate, r.status, userUuid, compId);
            }

            if (subValues.length > 0) {
              const subRes = await client.query(`
                INSERT INTO daily_submissions (territory_id, report_date, status, created_by, company_id)
                VALUES ${subPlaceholders.join(', ')}
                ON CONFLICT (territory_id, report_date) DO UPDATE
                SET status = EXCLUDED.status,
                    company_id = COALESCE(daily_submissions.company_id, EXCLUDED.company_id),
                    updated_at = NOW()
                RETURNING id, territory_id::text, report_date::text;
              `, subValues);

              for (const row of subRes.rows) {
                const dateKey = row.report_date.includes('T') ? row.report_date.split('T')[0] : row.report_date;
                submissionIdMap.set(`${row.territory_id}_${dateKey}`, row.id);
              }
            }
          }

          // 5. Batch multi-row insert for daily_sales & daily_stock
          const salesPlaceholders: string[] = [];
          const salesValues: any[] = [];
          let salesIdx = 1;

          const stockPlaceholders: string[] = [];
          const stockValues: any[] = [];
          let stockIdx = 1;

          // 6. Batch multi-row insert for zarda_sales & zarda_stock
          const zardaSalesPlaceholders: string[] = [];
          const zardaSalesValues: any[] = [];
          let zSalesIdx = 1;

          const zardaStockPlaceholders: string[] = [];
          const zardaStockValues: any[] = [];
          let zStockIdx = 1;

          // 7. Batch multi-row insert for empty_packets
          const emptyPacketsPlaceholders: string[] = [];
          const emptyPacketsValues: any[] = [];
          let epIdx = 1;

          const zardaConfig = [
            { key: 'slb', name: 'SLB', price: 0 },
            { key: 'qty_22_25', name: '22/25', price: 15 },
            { key: 'qty_99_14', name: '99/14', price: 6 },
            { key: 'qty_33_15', name: '33/15', price: 8 },
          ];

          for (const r of records) {
            const matchedTerr =
              terrLookup.get(String(r.territoryId).toLowerCase()) ||
              terrLookup.get(String(r.territoryName).toLowerCase());
            const terrId = matchedTerr?.id || r.territoryId;
            const subId = submissionIdMap.get(`${terrId}_${r.reportDate}`);
            if (!subId) continue;

            // Cigarette Sales & Stock
            for (const [brandKey, qty] of Object.entries(r.cigaretteSales || {})) {
              const bId = brandMap.get(brandKey.toLowerCase());
              if (bId) {
                salesPlaceholders.push(`($${salesIdx++}, $${salesIdx++}, $${salesIdx++})`);
                salesValues.push(subId, bId, qty);
              }
            }
            for (const [brandKey, stk] of Object.entries(r.cigaretteStock || {})) {
              const bId = brandMap.get(brandKey.toLowerCase());
              if (bId) {
                stockPlaceholders.push(`($${stockIdx++}, $${stockIdx++}, $${stockIdx++})`);
                stockValues.push(subId, bId, stk);
              }
            }

            // Zarda Sales & Stock
            for (const zc of zardaConfig) {
              const bId = brandMap.get(zc.name.toLowerCase());
              if (bId) {
                const zQty = (r.zardaSales as any)?.[zc.key] || 0;
                const zStk = (r.zardaStock as any)?.[zc.key] || 0;

                zardaSalesPlaceholders.push(`($${zSalesIdx++}, $${zSalesIdx++}, $${zSalesIdx++}, $${zSalesIdx++}, $${zSalesIdx++})`);
                zardaSalesValues.push(subId, bId, zQty, zc.price, zQty * zc.price);

                zardaStockPlaceholders.push(`($${zStockIdx++}, $${zStockIdx++}, $${zStockIdx++}, $${zStockIdx++}, $${zStockIdx++})`);
                zardaStockValues.push(subId, bId, zStk, zc.price, zStk * zc.price);
              }
            }

            // Empty packets
            const expressId = brandMap.get('express');
            if (expressId) {
              emptyPacketsPlaceholders.push(`($${epIdx++}, $${epIdx++}, $${epIdx++}, $${epIdx++})`);
              emptyPacketsValues.push(subId, expressId, r.emptyPackets || 0, r.remarks || '');
            }
          }

          // Execute bulk sales upsert
          if (salesValues.length > 0) {
            await client.query(`
              INSERT INTO daily_sales (submission_id, brand_id, quantity)
              VALUES ${salesPlaceholders.join(', ')}
              ON CONFLICT (submission_id, brand_id) DO UPDATE SET quantity = EXCLUDED.quantity;
            `, salesValues);
          }

          // Execute bulk stock upsert
          if (stockValues.length > 0) {
            await client.query(`
              INSERT INTO daily_stock (submission_id, brand_id, closing_stock)
              VALUES ${stockPlaceholders.join(', ')}
              ON CONFLICT (submission_id, brand_id) DO UPDATE SET closing_stock = EXCLUDED.closing_stock;
            `, stockValues);
          }

          // Execute bulk zarda sales upsert
          if (zardaSalesValues.length > 0) {
            await client.query(`
              INSERT INTO zarda_sales (submission_id, brand_id, quantity, unit_price, total_value)
              VALUES ${zardaSalesPlaceholders.join(', ')}
              ON CONFLICT (submission_id, brand_id) DO UPDATE
              SET quantity = EXCLUDED.quantity, unit_price = EXCLUDED.unit_price, total_value = EXCLUDED.total_value;
            `, zardaSalesValues);
          }

          // Execute bulk zarda stock upsert
          if (zardaStockValues.length > 0) {
            await client.query(`
              INSERT INTO zarda_stock (submission_id, brand_id, closing_stock, unit_price, total_value)
              VALUES ${zardaStockPlaceholders.join(', ')}
              ON CONFLICT (submission_id, brand_id) DO UPDATE
              SET closing_stock = EXCLUDED.closing_stock, unit_price = EXCLUDED.unit_price, total_value = EXCLUDED.total_value;
            `, zardaStockValues);
          }

          // Execute bulk empty packets upsert
          if (emptyPacketsValues.length > 0) {
            await client.query(`
              INSERT INTO empty_packets (submission_id, brand_id, quantity, remarks)
              VALUES ${emptyPacketsPlaceholders.join(', ')}
              ON CONFLICT (submission_id, brand_id) DO UPDATE
              SET quantity = EXCLUDED.quantity, remarks = EXCLUDED.remarks;
            `, emptyPacketsValues);
          }
        });
      } catch (err) {
        console.warn('Database batch save failed, syncing to local store:', err);
      }
    }

    // Single-pass sync for local store fallback (1 read, 1 write in memory)
    const store = loadStore();
    for (const record of records) {
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
          reason: changeReason || 'Bulk batch import',
          createdAt: new Date().toISOString(),
        });
      }

      store.submissions[key] = record;
      store.auditLogs.push({
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        userId,
        eventType: existing ? 'SALES_UPDATE' : 'SALES_CREATE',
        entityName: 'daily_submissions',
        entityId: key,
        oldValues: existing,
        newValues: record,
        timestamp: new Date().toISOString(),
      });
    }
    saveStore(store);

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
    const results = await this.saveSubmissionsBatch([record], userId, changeReason);
    return results[0] || record;
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
        const terrId = terrRes.rows[0]?.id || params.territoryId;
        const isFinalized = params.toStatus === 'FINALIZED';

        const updateRes = await dbQuery(`
          UPDATE daily_submissions 
          SET status = $1, is_locked = $2, unlock_reason = COALESCE($3, unlock_reason), updated_at = NOW()
          WHERE (territory_id::text = $4 OR id::text = $4) AND (report_date = $5 OR $5 IS NULL)
          RETURNING id, status;
        `, [params.toStatus, isFinalized, params.unlockReason, terrId, params.reportDate || null]);

        if (updateRes.rows.length > 0) {
          const subId = updateRes.rows[0].id;
          await dbQuery(`
            INSERT INTO approval_history (submission_id, from_status, to_status, comments)
            VALUES ($1, 'SUBMITTED', $2, $3);
          `, [subId, params.toStatus, params.comments || 'Status transitioned']);
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
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        let userUuid: string | null = null;
        if (UUID_REGEX.test(userId)) {
          userUuid = userId;
        } else {
          const userRes = await dbQuery(
            'SELECT id FROM user_profiles WHERE id::text = $1 OR email ILIKE $2 LIMIT 1;',
            [userId, userId]
          );
          userUuid = userRes.rows[0]?.id || null;
        }

        const validEntityId = UUID_REGEX.test(entityId) ? entityId : null;
        const auditNewValues = validEntityId
          ? newValues
          : { ...(newValues || {}), entityReference: entityId };

        const res = await dbQuery(`
          INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, old_values, new_values)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, created_at;
        `, [
          userUuid,
          eventType,
          entityName,
          validEntityId,
          oldValues ? JSON.stringify(oldValues) : null,
          auditNewValues ? JSON.stringify(auditNewValues) : null,
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

  /**
   * Retrieves all distinct recorded dates from Supabase PostgreSQL (or local fallback).
   */
  static async getRecordedDates(companyId?: string | null): Promise<string[]> {
    if (getDbPool()) {
      try {
        let sql = `
          SELECT DISTINCT s.report_date::text as report_date
          FROM daily_submissions s
        `;
        const params: any[] = [];
        if (companyId && companyId !== 'ALL') {
          sql += `
            JOIN territories t ON s.territory_id = t.id
            JOIN regions r ON t.region_id = r.id
            JOIN wings w ON r.wing_id = w.id
            JOIN divisions d ON w.division_id = d.id
            WHERE d.company_id = $1
          `;
          params.push(companyId);
        }
        sql += ` ORDER BY report_date DESC LIMIT 31;`;

        const res = await dbQuery(sql, params);
        if (res.rows && res.rows.length > 0) {
          return res.rows.map(r => (r.report_date.includes('T') ? r.report_date.split('T')[0] : r.report_date));
        }
      } catch (err) {
        console.warn('Database getRecordedDates query failed, falling back to local store:', err);
      }
    }

    const store = loadStore();
    const dates = new Set<string>();
    for (const record of Object.values(store.submissions)) {
      if (record.reportDate) {
        dates.add(record.reportDate.includes('T') ? record.reportDate.split('T')[0] : record.reportDate);
      }
    }
    return Array.from(dates).sort().reverse();
  }
}
