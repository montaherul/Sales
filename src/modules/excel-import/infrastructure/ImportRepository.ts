// Infrastructure: Selective Import Repository
// Executes atomic import transaction and logs import batches

import { withTransaction, dbQuery } from '@/shared/database/db';
import { logger } from '@/shared/logger';
import { AUDIT_ACTIONS } from '@/shared/constants';

export interface StagedImportRecord {
  territoryId: string;
  reportingDate: string;
  cigaretteSales: Record<string, number>;
  cigaretteStock: Record<string, number>;
  zardaSales: Record<string, number>;
  zardaStock: Record<string, number>;
  remarks?: string;
}

export class ImportRepository {
  /**
   * Commits staged records inside an atomic PostgreSQL transaction.
   * If any record fails, the entire batch rolls back.
   */
  public async commitBatch(
    records: StagedImportRecord[],
    filename: string,
    userId: string = 'system'
  ): Promise<{ importedCount: number; batchId: string }> {
    const batchId = `import_${Date.now()}`;

    return await withTransaction(async (client) => {
      // 1. Insert imports batch header
      await client.query(
        `INSERT INTO imports (id, file_name, status, imported_by_user_id)
         VALUES ($1, $2, $3, $4)`,
        [batchId, filename, 'SUCCESS', userId]
      );

      // 2. Insert or update each daily submission
      for (const rec of records) {
        const subRes = await client.query(
          `INSERT INTO daily_submissions (territory_id, reporting_date, status, remarks, submitted_by_user_id)
           VALUES ($1, $2, 'SUBMITTED', $3, $4)
           ON CONFLICT (territory_id, reporting_date)
           DO UPDATE SET status = 'SUBMITTED', remarks = EXCLUDED.remarks, updated_at = NOW()
           RETURNING id`,
          [rec.territoryId, rec.reportingDate, rec.remarks || 'Imported from XLSX', userId]
        );

        const subId = subRes.rows[0].id;

        // Cigarette Sales
        for (const [brand, qty] of Object.entries(rec.cigaretteSales)) {
          await client.query(
            `INSERT INTO daily_sales (submission_id, brand_id, sales_quantity)
             VALUES ($1, $2, $3)
             ON CONFLICT (submission_id, brand_id)
             DO UPDATE SET sales_quantity = EXCLUDED.sales_quantity`,
            [subId, brand, qty]
          );
        }

        // Cigarette Stock
        for (const [brand, qty] of Object.entries(rec.cigaretteStock)) {
          await client.query(
            `INSERT INTO daily_stock (submission_id, brand_id, closing_stock_quantity)
             VALUES ($1, $2, $3)
             ON CONFLICT (submission_id, brand_id)
             DO UPDATE SET closing_stock_quantity = EXCLUDED.closing_stock_quantity`,
            [subId, brand, qty]
          );
        }
      }

      // 3. Centralized Audit Log
      await client.query(
        `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, new_values)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          AUDIT_ACTIONS.IMPORT,
          'imports',
          batchId,
          JSON.stringify({ filename, recordCount: records.length }),
        ]
      );

      logger.info(`Import transaction committed: ${batchId} (${records.length} records)`, 'ImportRepository');
      return { importedCount: records.length, batchId };
    });
  }

  /**
   * Checks for duplicate records before importing.
   */
  public async checkDuplicates(territoryIds: string[], reportingDate: string): Promise<string[]> {
    try {
      const res = await dbQuery(
        `SELECT territory_id FROM daily_submissions
         WHERE reporting_date = $1 AND territory_id = ANY($2::text[])`,
        [reportingDate, territoryIds]
      );
      return res.rows.map((r: any) => r.territory_id);
    } catch {
      return [];
    }
  }
}

export const importRepository = new ImportRepository();
