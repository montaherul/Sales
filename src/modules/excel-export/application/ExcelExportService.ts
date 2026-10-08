// Application: Excel Export Service
// Orchestrates monthly and daily report data aggregation and generates authoritative XLSX
// Conforms to AGENTS.md Rules 2, 3, 17, 18, 20 & AGENTS1.md Rules 4, 6

import { workbookBuilder, DailyExportRecord, TerritoryExportConfig } from './WorkbookBuilder';
import { dbQuery } from '@/shared/database/db';
import { generateExportFilename } from '@/shared/utils';
import { logger } from '@/shared/logger';
import { AUDIT_ACTIONS } from '@/shared/constants';
import { AuditService } from '@/modules/audit';

export interface GenerateReportOptions {
  year: number;
  month: number;
  day?: number;
  reportType?: 'monthly' | 'daily';
  companyId?: string;
  regionId?: string;
  userId?: string;
}

export class ExcelExportService {
  /**
   * Universal report generation method supporting both 34-sheet Monthly reports
   * and single-sheet Daily reports, dynamically scoped by Company and Region.
   */
  public static async generateReport(
    options: GenerateReportOptions
  ): Promise<{ filename: string; buffer: Buffer }> {
    const year = options.year || 2026;
    const month = options.month || 10;
    const day = options.day || 1;
    const reportType = options.reportType || 'monthly';
    const userId = options.userId || 'system';
    const companyId = options.companyId && options.companyId !== 'ALL' ? options.companyId : undefined;
    const regionId = options.regionId && options.regionId !== 'ALL' ? options.regionId : undefined;

    const dateObj = new Date(year, month - 1, day);
    const monthName = dateObj.toLocaleString('en-US', { month: 'long' });

    // Standard filename according to AGENTS.md Rule 17
    const filename = reportType === 'daily'
      ? `Daily sales and Closing Stock Information ${monthName} ${day} ${year} (Daily).xlsx`
      : generateExportFilename(year, month, day);

    // 1. Resolve Dynamic Company, Division, and Wing Names
    let companyName = 'Afaz Tobacco Company';
    let divisionName = 'Ctg South';
    let wingName = 'Chittagong';

    try {
      if (companyId) {
        const cRes = await dbQuery(`SELECT name FROM companies WHERE id = $1 LIMIT 1`, [companyId]);
        if (cRes.rows.length > 0 && cRes.rows[0].name) {
          companyName = cRes.rows[0].name;
        }
      }

      if (regionId) {
        const rRes = await dbQuery(
          `SELECT d.name as division_name, w.name as wing_name, c.name as company_name
           FROM regions r
           JOIN wings w ON r.wing_id = w.id
           JOIN divisions d ON w.division_id = d.id
           JOIN companies c ON d.company_id = c.id
           WHERE r.id = $1 LIMIT 1`,
          [regionId]
        );
        if (rRes.rows.length > 0) {
          if (rRes.rows[0].division_name) divisionName = rRes.rows[0].division_name;
          if (rRes.rows[0].wing_name) wingName = rRes.rows[0].wing_name;
          if (!companyId && rRes.rows[0].company_name) companyName = rRes.rows[0].company_name;
        }
      } else if (companyId) {
        const dRes = await dbQuery(
          `SELECT d.name as division_name, w.name as wing_name
           FROM divisions d
           LEFT JOIN wings w ON w.division_id = d.id
           WHERE d.company_id = $1 LIMIT 1`,
          [companyId]
        );
        if (dRes.rows.length > 0) {
          if (dRes.rows[0].division_name) divisionName = dRes.rows[0].division_name;
          if (dRes.rows[0].wing_name) wingName = dRes.rows[0].wing_name;
        }
      }
    } catch (metaErr) {
      logger.warn('Failed to resolve dynamic org metadata, falling back to defaults', 'ExcelExportService', { metaErr });
    }

    // 2. Resolve Dynamic Territories & Regions
    let territoryConfigs: TerritoryExportConfig[] = [];
    try {
      const terrRes = await dbQuery(
        `SELECT t.id, t.name as territory_name, r.name as region_name, t.sort_order
         FROM territories t
         JOIN regions r ON t.region_id = r.id
         JOIN wings w ON r.wing_id = w.id
         JOIN divisions d ON w.division_id = d.id
         WHERE ($1::uuid IS NULL OR d.company_id = $1)
           AND ($2::uuid IS NULL OR r.id = $2)
         ORDER BY r.name, t.sort_order ASC`,
        [companyId || null, regionId || null]
      );

      if (terrRes.rows.length > 0) {
        territoryConfigs = terrRes.rows.map((row: any, idx: number) => ({
          rowNumber: 8 + idx,
          slNo: idx + 1,
          territoryName: row.territory_name,
          regionName: row.region_name,
        }));
      }
    } catch (terrErr) {
      logger.warn('Failed to query dynamic territories from DB', 'ExcelExportService', { terrErr });
    }

    // 3. Resolve Dynamic Target Records for Target. sheet
    const targetRecords: Record<string, any> = {};
    try {
      const targetRes = await dbQuery(
        `SELECT t.name as territory_name, b.name as brand_name, tg.target_quantity
         FROM targets tg
         JOIN territories t ON tg.territory_id = t.id
         JOIN brands b ON tg.brand_id = b.id
         WHERE tg.year = $1 AND tg.month = $2`,
        [year, month]
      );

      targetRes.rows.forEach((r: any) => {
        const tKey = (r.territory_name || '').toLowerCase();
        if (!targetRecords[tKey]) targetRecords[tKey] = {};
        const bName = (r.brand_name || '').toLowerCase();
        const val = parseFloat(r.target_quantity || 0);

        if (bName.includes('wilson')) targetRecords[tKey].wilson = val;
        else if (bName.includes('shahara')) targetRecords[tKey].shahara = val;
        else if (bName.includes('express')) targetRecords[tKey].express = val;
        else if (bName.includes('nexus')) targetRecords[tKey].nexus = val;
        else if (bName.includes('sb')) targetRecords[tKey].sb = val;
        else if (bName.includes('sm')) targetRecords[tKey].sm = val;
      });
    } catch (tgErr) {
      logger.warn('Failed to query targets for export', 'ExcelExportService', { tgErr });
    }

    // 4. Fetch Submissions from PostgreSQL
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
           AND ($4::uuid IS NULL OR r.id = $4)
         GROUP BY s.id, s.report_date, s.remarks, t.name`,
        [startDate, endDate, companyId || null, regionId || null]
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

    // 5. Build dynamic workbook using template adapter
    const buffer = await workbookBuilder.buildWorkbook(dailyDataBySheet, day, {
      companyName,
      divisionName,
      wingName,
      year,
      month,
      reportingDay: day,
      isDailyReportOnly: reportType === 'daily',
      territories: territoryConfigs.length > 0 ? territoryConfigs : undefined,
      targetRecords,
    });

    // 6. Centralized Audit Log
    await AuditService.logEvent({
      userId,
      companyId: companyId || null,
      eventType: AUDIT_ACTIONS.EXPORT,
      entityName: 'reports',
      entityId: filename,
      newValues: { year, month, day, reportType, companyName, divisionName, size: buffer.length },
    });

    logger.info(`Excel report generated: ${filename} (${buffer.length} bytes, type: ${reportType})`, 'ExcelExportService');

    return { filename, buffer };
  }

  /**
   * Legacy method preserved for backwards compatibility.
   */
  public static async generateMonthlyReport(
    year: number,
    month: number,
    reportingDay: number,
    userId: string = 'system',
    companyId?: string
  ): Promise<{ filename: string; buffer: Buffer }> {
    return this.generateReport({
      year,
      month,
      day: reportingDay,
      reportType: 'monthly',
      userId,
      companyId,
    });
  }
}
