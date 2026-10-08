// Infrastructure: Selective Daily Sales Repository
// Encapsulates complex daily operational persistence in PostgreSQL with seamless fallback

import { DailySalesEntry } from '../domain/DailySalesEntry';
import { dbQuery } from '@/shared/database/db';
import { logger } from '@/shared/logger';
import { AUDIT_ACTIONS } from '@/shared/constants';
import fs from 'fs';
import path from 'path';

const FALLBACK_STORE_FILE = path.resolve(process.cwd(), '.submissions-store.json');

export class DailySalesRepository {
  /**
   * Upserts a daily submission with its associated sales, stock, and zarda records.
   */
  public async upsertSubmission(entry: DailySalesEntry, userId: string = 'system'): Promise<string> {
    const poolAvailable = !!process.env.DATABASE_URL;

    if (poolAvailable) {
      try {
        // 1. Upsert daily_submissions master row
        const subRes = await dbQuery(
          `INSERT INTO daily_submissions (territory_id, reporting_date, status, remarks, submitted_by_user_id)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (territory_id, reporting_date)
           DO UPDATE SET status = EXCLUDED.status, remarks = EXCLUDED.remarks, updated_at = NOW()
           RETURNING id`,
          [entry.territoryId, entry.reportingDate, entry.status, entry.remarks, userId]
        );

        const submissionId = subRes.rows[0].id;

        // 2. Upsert daily_sales for cigarette brands
        const brands = ['wilson', 'shahara', 'express', 'nexus', 'sb', 'sm'] as const;
        for (const brand of brands) {
          const qty = entry.cigaretteSales[brand] || 0;
          await dbQuery(
            `INSERT INTO daily_sales (submission_id, brand_id, sales_quantity)
             VALUES ($1, $2, $3)
             ON CONFLICT (submission_id, brand_id)
             DO UPDATE SET sales_quantity = EXCLUDED.sales_quantity`,
            [submissionId, brand, qty]
          );
        }

        // 3. Upsert daily_stock for cigarette brands
        for (const brand of brands) {
          const qty = entry.cigaretteStock[brand] || 0;
          await dbQuery(
            `INSERT INTO daily_stock (submission_id, brand_id, closing_stock_quantity)
             VALUES ($1, $2, $3)
             ON CONFLICT (submission_id, brand_id)
             DO UPDATE SET closing_stock_quantity = EXCLUDED.closing_stock_quantity`,
            [submissionId, brand, qty]
          );
        }

        // 4. Upsert zarda_sales
        const zardaBrands = [
          { id: 'slb', qty: entry.zardaSales.slb || 0 },
          { id: 'qty_22_25', qty: entry.zardaSales.qty_22_25 || 0 },
          { id: 'qty_99_14', qty: entry.zardaSales.qty_99_14 || 0 },
          { id: 'qty_33_15', qty: entry.zardaSales.qty_33_15 || 0 },
        ];
        for (const z of zardaBrands) {
          await dbQuery(
            `INSERT INTO zarda_sales (submission_id, brand_id, sales_quantity)
             VALUES ($1, $2, $3)
             ON CONFLICT (submission_id, brand_id)
             DO UPDATE SET sales_quantity = EXCLUDED.sales_quantity`,
            [submissionId, z.id, z.qty]
          );
        }

        // 5. Upsert zarda_stock
        const zardaStockBrands = [
          { id: 'slb', qty: entry.zardaStock.slb || 0 },
          { id: 'qty_22_25', qty: entry.zardaStock.qty_22_25 || 0 },
          { id: 'qty_99_14', qty: entry.zardaStock.qty_99_14 || 0 },
          { id: 'qty_33_15', qty: entry.zardaStock.qty_33_15 || 0 },
        ];
        for (const z of zardaStockBrands) {
          await dbQuery(
            `INSERT INTO zarda_stock (submission_id, brand_id, closing_stock_quantity)
             VALUES ($1, $2, $3)
             ON CONFLICT (submission_id, brand_id)
             DO UPDATE SET closing_stock_quantity = EXCLUDED.closing_stock_quantity`,
            [submissionId, z.id, z.qty]
          );
        }

        // 6. Centralized Audit Log
        try {
          await dbQuery(
            `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, new_values)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              userId,
              AUDIT_ACTIONS.CREATE,
              'daily_submissions',
              submissionId,
              JSON.stringify({
                territoryId: entry.territoryId,
                date: entry.reportingDate,
                status: entry.status,
              }),
            ]
          );
        } catch (auditErr) {
          logger.warn('Audit log write skipped in upsert', 'DailySalesRepository');
        }

        return submissionId;
      } catch (dbErr) {
        logger.warn('PostgreSQL write failed, falling back to local store file', 'DailySalesRepository', { dbErr });
      }
    }

    // Fallback store
    return this.upsertLocalFallback(entry, userId);
  }

  /**
   * Retrieves submissions for given date or territory.
   */
  public async getByDate(reportingDate: string): Promise<any[]> {
    try {
      const res = await dbQuery(
        `SELECT s.id, s.territory_id, s.reporting_date, s.status, s.remarks,
                t.name as territory_name
         FROM daily_submissions s
         LEFT JOIN territories t ON s.territory_id = t.id
         WHERE s.reporting_date = $1`,
        [reportingDate]
      );
      return res.rows;
    } catch {
      return this.getLocalByDate(reportingDate);
    }
  }

  private upsertLocalFallback(entry: DailySalesEntry, userId: string): string {
    const id = `sub_${entry.territoryId}_${entry.reportingDate}`;
    let store = { submissions: {} as Record<string, any> };
    if (fs.existsSync(FALLBACK_STORE_FILE)) {
      try {
        store = JSON.parse(fs.readFileSync(FALLBACK_STORE_FILE, 'utf-8'));
      } catch (parseErr) {
        logger.warn('Failed to parse local fallback store file, creating fresh store', 'DailySalesRepository', { parseErr });
      }
    }

    store.submissions[id] = {
      id,
      ...entry,
      submittedBy: userId,
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(FALLBACK_STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
    return id;
  }

  private getLocalByDate(reportingDate: string): any[] {
    if (!fs.existsSync(FALLBACK_STORE_FILE)) return [];
    try {
      const store = JSON.parse(fs.readFileSync(FALLBACK_STORE_FILE, 'utf-8'));
      return Object.values(store.submissions || {}).filter(
        (sub: any) => sub.reportingDate === reportingDate
      );
    } catch {
      return [];
    }
  }
}

export const dailySalesRepository = new DailySalesRepository();
