// Application: Excel Export Service
// Orchestrates monthly report data aggregation and generates authoritative 34-sheet XLSX

import { workbookBuilder, DailyExportRecord } from './WorkbookBuilder';
import { dbQuery } from '@/shared/database/db';
import { generateExportFilename } from '@/shared/utils';
import { logger } from '@/shared/logger';
import { AUDIT_ACTIONS } from '@/shared/constants';

export class ExcelExportService {
  /**
   * Generates the monthly report buffer.
   */
  public static async generateMonthlyReport(
    year: number,
    month: number,
    reportingDay: number,
    userId: string = 'system'
  ): Promise<{ filename: string; buffer: Buffer }> {
    const filename = generateExportFilename(year, month, reportingDay);

    // 1. Fetch all submissions for the month from PostgreSQL
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    const dailyDataBySheet: Record<string, DailyExportRecord[]> = {};

    try {
      const res = await dbQuery(
        `SELECT s.id, s.reporting_date, s.remarks, t.name as territory_name,
                EXTRACT(DAY FROM s.reporting_date) as day_num,
                COALESCE(MAX(CASE WHEN ds.brand_id = 'wilson' THEN ds.sales_quantity END), 0) as c_wilson_sales,
                COALESCE(MAX(CASE WHEN ds.brand_id = 'shahara' THEN ds.sales_quantity END), 0) as c_shahara_sales,
                COALESCE(MAX(CASE WHEN ds.brand_id = 'express' THEN ds.sales_quantity END), 0) as c_express_sales,
                COALESCE(MAX(CASE WHEN ds.brand_id = 'nexus' THEN ds.sales_quantity END), 0) as c_nexus_sales,
                COALESCE(MAX(CASE WHEN ds.brand_id = 'sb' THEN ds.sales_quantity END), 0) as c_sb_sales,
                COALESCE(MAX(CASE WHEN ds.brand_id = 'sm' THEN ds.sales_quantity END), 0) as c_sm_sales,
                COALESCE(MAX(CASE WHEN dst.brand_id = 'wilson' THEN dst.closing_stock_quantity END), 0) as c_wilson_stock,
                COALESCE(MAX(CASE WHEN dst.brand_id = 'shahara' THEN dst.closing_stock_quantity END), 0) as c_shahara_stock,
                COALESCE(MAX(CASE WHEN dst.brand_id = 'express' THEN dst.closing_stock_quantity END), 0) as c_express_stock,
                COALESCE(MAX(CASE WHEN dst.brand_id = 'nexus' THEN dst.closing_stock_quantity END), 0) as c_nexus_stock,
                COALESCE(MAX(CASE WHEN dst.brand_id = 'sb' THEN dst.closing_stock_quantity END), 0) as c_sb_stock,
                COALESCE(MAX(CASE WHEN dst.brand_id = 'sm' THEN dst.closing_stock_quantity END), 0) as c_sm_stock
         FROM daily_submissions s
         JOIN territories t ON s.territory_id = t.id
         LEFT JOIN daily_sales ds ON s.id = ds.submission_id
         LEFT JOIN daily_stock dst ON s.id = dst.submission_id
         WHERE s.reporting_date >= $1 AND s.reporting_date <= $2
         GROUP BY s.id, s.reporting_date, s.remarks, t.name`,
        [startDate, endDate]
      );

      res.rows.forEach((row: any) => {
        const sheetName = String(row.day_num);
        if (!dailyDataBySheet[sheetName]) {
          dailyDataBySheet[sheetName] = [];
        }

        dailyDataBySheet[sheetName].push({
          territoryName: row.territory_name,
          wilsonSales: parseFloat(row.c_wilson_sales || 0),
          shaharaSales: parseFloat(row.c_shahara_sales || 0),
          expressSales: parseFloat(row.c_express_sales || 0),
          nexusSales: parseFloat(row.c_nexus_sales || 0),
          sbSales: parseFloat(row.c_sb_sales || 0),
          smSales: parseFloat(row.c_sm_sales || 0),
          wilsonStock: parseFloat(row.c_wilson_stock || 0),
          shaharaStock: parseFloat(row.c_shahara_stock || 0),
          expressStock: parseFloat(row.c_express_stock || 0),
          nexusStock: parseFloat(row.c_nexus_stock || 0),
          sbStock: parseFloat(row.c_sb_stock || 0),
          smStock: parseFloat(row.c_sm_stock || 0),
          zardaSlbSales: 0,
          zarda22_25Sales: 0,
          zarda99_14Sales: 0,
          zarda33_15Sales: 0,
          zardaSlbStock: 0,
          zarda22_25Stock: 0,
          zarda99_14Stock: 0,
          zarda33_15Stock: 0,
          emptyPackets: 0,
          remarks: row.remarks || '',
        });
      });
    } catch (err) {
      logger.warn('Failed to query daily_submissions from DB for export, using empty sheet fallback', 'ExcelExportService', { err });
    }

    // 2. Build workbook buffer using template adapter
    const buffer = await workbookBuilder.buildWorkbook(dailyDataBySheet, reportingDay);

    // 3. Centralized Audit Log
    try {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, new_values)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          AUDIT_ACTIONS.EXPORT,
          'reports',
          filename,
          JSON.stringify({ year, month, reportingDay, size: buffer.length }),
        ]
      );
    } catch {}

    logger.info(`Monthly 34-sheet report generated: ${filename} (${buffer.length} bytes)`, 'ExcelExportService');

    return { filename, buffer };
  }
}
