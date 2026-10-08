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
    userId: string = 'system',
    companyId?: string
  ): Promise<{ filename: string; buffer: Buffer }> {
    const filename = generateExportFilename(year, month, reportingDay);

    // 1. Fetch all submissions for the month from PostgreSQL
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    const dailyDataBySheet: Record<string, DailyExportRecord[]> = {};

    try {
      const res = await dbQuery(
        `SELECT s.id, s.report_date, s.remarks, t.name as territory_name,
                EXTRACT(DAY FROM s.report_date) as day_num,
                COALESCE(MAX(CASE WHEN b.name ILIKE '%wilson%' THEN ds.quantity END), 0) as c_wilson_sales,
                COALESCE(MAX(CASE WHEN b.name ILIKE '%shahara%' THEN ds.quantity END), 0) as c_shahara_sales,
                COALESCE(MAX(CASE WHEN b.name ILIKE '%express%' THEN ds.quantity END), 0) as c_express_sales,
                COALESCE(MAX(CASE WHEN b.name ILIKE '%nexus%' THEN ds.quantity END), 0) as c_nexus_sales,
                COALESCE(MAX(CASE WHEN b.name ILIKE '%sb%' THEN ds.quantity END), 0) as c_sb_sales,
                COALESCE(MAX(CASE WHEN b.name ILIKE '%sm%' THEN ds.quantity END), 0) as c_sm_sales,
                COALESCE(MAX(CASE WHEN b.name ILIKE '%wilson%' THEN dst.closing_stock END), 0) as c_wilson_stock,
                COALESCE(MAX(CASE WHEN b.name ILIKE '%shahara%' THEN dst.closing_stock END), 0) as c_shahara_stock,
                COALESCE(MAX(CASE WHEN b.name ILIKE '%express%' THEN dst.closing_stock END), 0) as c_express_stock,
                COALESCE(MAX(CASE WHEN b.name ILIKE '%nexus%' THEN dst.closing_stock END), 0) as c_nexus_stock,
                COALESCE(MAX(CASE WHEN b.name ILIKE '%sb%' THEN dst.closing_stock END), 0) as c_sb_stock,
                COALESCE(MAX(CASE WHEN b.name ILIKE '%sm%' THEN dst.closing_stock END), 0) as c_sm_stock,
                COALESCE((SELECT SUM(zs.quantity) FROM zarda_sales zs JOIN brands zb ON zs.brand_id = zb.id WHERE zs.submission_id = s.id AND zb.name ILIKE '%slb%'), 0) as z_slb_sales,
                COALESCE((SELECT SUM(zs.quantity) FROM zarda_sales zs JOIN brands zb ON zs.brand_id = zb.id WHERE zs.submission_id = s.id AND zb.name ILIKE '%22%'), 0) as z_22_25_sales,
                COALESCE((SELECT SUM(zs.quantity) FROM zarda_sales zs JOIN brands zb ON zs.brand_id = zb.id WHERE zs.submission_id = s.id AND zb.name ILIKE '%99%'), 0) as z_99_14_sales,
                COALESCE((SELECT SUM(zs.quantity) FROM zarda_sales zs JOIN brands zb ON zs.brand_id = zb.id WHERE zs.submission_id = s.id AND zb.name ILIKE '%33%'), 0) as z_33_15_sales,
                COALESCE((SELECT SUM(zst.closing_stock) FROM zarda_stock zst JOIN brands zb ON zst.brand_id = zb.id WHERE zst.submission_id = s.id AND zb.name ILIKE '%slb%'), 0) as z_slb_stock,
                COALESCE((SELECT SUM(zst.closing_stock) FROM zarda_stock zst JOIN brands zb ON zst.brand_id = zb.id WHERE zst.submission_id = s.id AND zb.name ILIKE '%22%'), 0) as z_22_25_stock,
                COALESCE((SELECT SUM(zst.closing_stock) FROM zarda_stock zst JOIN brands zb ON zst.brand_id = zb.id WHERE zst.submission_id = s.id AND zb.name ILIKE '%99%'), 0) as z_99_14_stock,
                COALESCE((SELECT SUM(zst.closing_stock) FROM zarda_stock zst JOIN brands zb ON zst.brand_id = zb.id WHERE zst.submission_id = s.id AND zb.name ILIKE '%33%'), 0) as z_33_15_stock,
                COALESCE((SELECT SUM(ep.quantity) FROM empty_packets ep WHERE ep.submission_id = s.id), 0) as empty_packets
         FROM daily_submissions s
         JOIN territories t ON s.territory_id = t.id
         JOIN regions r ON t.region_id = r.id
         JOIN wings w ON r.wing_id = w.id
         JOIN divisions d ON w.division_id = d.id
         LEFT JOIN daily_sales ds ON s.id = ds.submission_id
         LEFT JOIN daily_stock dst ON s.id = dst.submission_id
         LEFT JOIN brands b ON (ds.brand_id = b.id OR dst.brand_id = b.id)
         WHERE s.report_date >= $1 AND s.report_date <= $2
           AND ($3::uuid IS NULL OR d.company_id = $3 OR s.company_id = $3)
         GROUP BY s.id, s.report_date, s.remarks, t.name`,
        [startDate, endDate, companyId || null]
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
          zardaSlbSales: parseFloat(row.z_slb_sales || 0),
          zarda22_25Sales: parseFloat(row.z_22_25_sales || 0),
          zarda99_14Sales: parseFloat(row.z_99_14_sales || 0),
          zarda33_15Sales: parseFloat(row.z_33_15_sales || 0),
          zardaSlbStock: parseFloat(row.z_slb_stock || 0),
          zarda22_25Stock: parseFloat(row.z_22_25_stock || 0),
          zarda99_14Stock: parseFloat(row.z_99_14_stock || 0),
          zarda33_15Stock: parseFloat(row.z_33_15_stock || 0),
          emptyPackets: parseInt(row.empty_packets || 0, 10),
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
    } catch (auditErr) {
      logger.warn('Failed to write report export audit log', 'ExcelExportService', { auditErr });
    }

    logger.info(`Monthly 34-sheet report generated: ${filename} (${buffer.length} bytes)`, 'ExcelExportService');

    return { filename, buffer };
  }
}
