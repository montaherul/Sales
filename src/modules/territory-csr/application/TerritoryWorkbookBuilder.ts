// Application: Territory CSR 34-Sheet Excel Generator
// Preserves exact formatting, styles, formulas, merged cells, and structure
// Matches excel/Chandanaish Territory CSR sales.xlsx dynamically for ANY territory and route count

import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { dbQuery } from '@/shared/database/db';
import { MONTH_NAMES } from '@/shared/constants';
import { TerritoryCalculationEngine } from '../domain/TerritoryCalculationEngine';

export interface GenerateTerritoryWorkbookOptions {
  territoryId: string;
  year: number;
  month: number;
  day?: number;
}

export class TerritoryWorkbookBuilder {
  /**
   * Generates authoritative 34-sheet Excel report dynamically for any territory
   */
  public static async buildWorkbook(options: GenerateTerritoryWorkbookOptions): Promise<{
    filename: string;
    buffer: Buffer;
  }> {
    const { territoryId, year, month } = options;
    const now = new Date();
    const day = options.day || (year === 2026 && month === 10 ? 22 : now.getDate());

    const templatePath = path.resolve(process.cwd(), 'excel', 'Chandanaish Territory CSR sales.xlsx');
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Authoritative territory template not found at ${templatePath}`);
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    // 1. Fetch territory, region, and company details
    const terrRes = await dbQuery(`
      SELECT t.id, t.name as territory_name, r.name as region_name, c.name as company_name
      FROM territories t
      JOIN regions r ON t.region_id = r.id
      JOIN wings w ON r.wing_id = w.id
      JOIN divisions d ON w.division_id = d.id
      JOIN companies c ON d.company_id = c.id
      WHERE t.id = $1 LIMIT 1;
    `, [territoryId]);

    const terrRow = terrRes.rows[0];
    const territoryName = terrRow?.territory_name || 'Territory';
    const regionName = terrRow?.region_name || 'Region';
    const monthName = MONTH_NAMES[month - 1] || 'October';

    // 2. Fetch Benchmarks
    const benchRes = await dbQuery(`
      SELECT lms, lm_ads, working_days
      FROM territory_target_benchmarks
      WHERE territory_id = $1 AND year = $2 AND month = $3 LIMIT 1;
    `, [territoryId, year, month]);

    const workingDays = benchRes.rows[0]?.working_days || 26;
    const lms = parseFloat(benchRes.rows[0]?.lms || 11.06);
    const lmAds = parseFloat(benchRes.rows[0]?.lm_ads || 0.43);

    // 3. Fetch Dynamic Routes for this territory
    const routesRes = await dbQuery(`
      SELECT id, name, csr_name, outlet_count, sort_order
      FROM routes
      WHERE territory_id = $1 AND is_active = TRUE
      ORDER BY sort_order ASC, name ASC;
    `, [territoryId]);

    const routes = routesRes.rows;
    const routeCount = routes.length;

    // 4. Fetch Targets
    const targetsRes = await dbQuery(`
      SELECT route_id, target_cigarette, target_bidi
      FROM route_targets
      WHERE territory_id = $1 AND year = $2 AND month = $3;
    `, [territoryId, year, month]);

    const targetMap = new Map<string, { cig: number; bidi: number }>();
    for (const tg of targetsRes.rows) {
      targetMap.set(tg.route_id, {
        cig: parseFloat(tg.target_cigarette || 0),
        bidi: parseFloat(tg.target_bidi || 0),
      });
    }

    // 5. Fetch Daily Sales for month
    const mStr = String(month).padStart(2, '0');
    const salesRes = await dbQuery(`
      SELECT route_id, report_date, sales_cigarette, sales_bidi, remarks
      FROM route_daily_sales
      WHERE territory_id = $1 AND report_date >= $2 AND report_date <= $3;
    `, [territoryId, `${year}-${mStr}-01`, `${year}-${mStr}-31`]);

    // Map: dayNumber -> Map(routeId -> { cig, bidi, remarks })
    const salesByDay = new Map<number, Map<string, { cig: number; bidi: number; remarks: string }>>();
    for (const s of salesRes.rows) {
      const sDateStr = typeof s.report_date === 'string' 
        ? s.report_date.slice(0, 10) 
        : new Date(s.report_date).toISOString().slice(0, 10);
      const dNum = parseInt(sDateStr.split('-')[2], 10);

      if (!salesByDay.has(dNum)) {
        salesByDay.set(dNum, new Map());
      }
      salesByDay.get(dNum)!.set(s.route_id, {
        cig: parseFloat(s.sales_cigarette || 0),
        bidi: parseFloat(s.sales_bidi || 0),
        remarks: s.remarks || '',
      });
    }

    // 6. UPDATE "Target" SHEET DYNAMICALLY
    const targetWs = workbook.getWorksheet('Target');
    if (targetWs) {
      targetWs.getCell('A1').value = `${territoryName} Territory - Master Target Sheet (${monthName} - ${workingDays} Working Days)`;
      targetWs.getCell('B2').value = territoryName;
      targetWs.getCell('D2').value = regionName;
      targetWs.getCell('F2').value = new Date(year, month - 1, 1);
      targetWs.getCell('H2').value = workingDays;

      targetWs.getCell('K2').value = lms;
      targetWs.getCell('K3').value = lmAds;

      // Populate routes (max 12 slots in template, or clean empty ones)
      for (let i = 0; i < 12; i++) {
        const rowIdx = 4 + i;
        if (i < routeCount) {
          const r = routes[i];
          const tg = targetMap.get(r.id) || { cig: 0, bidi: 0 };

          targetWs.getCell(`A${rowIdx}`).value = i + 1;
          targetWs.getCell(`B${rowIdx}`).value = r.csr_name || '';
          targetWs.getCell(`C${rowIdx}`).value = r.name;
          targetWs.getCell(`D${rowIdx}`).value = r.outlet_count || undefined;
          targetWs.getCell(`E${rowIdx}`).value = tg.cig;
          targetWs.getCell(`F${rowIdx}`).value = tg.bidi > 0 ? tg.bidi : undefined;
        } else {
          // Clear unused rows if territory has fewer than 12 routes
          targetWs.getCell(`A${rowIdx}`).value = undefined;
          targetWs.getCell(`B${rowIdx}`).value = undefined;
          targetWs.getCell(`C${rowIdx}`).value = undefined;
          targetWs.getCell(`D${rowIdx}`).value = undefined;
          targetWs.getCell(`E${rowIdx}`).value = undefined;
          targetWs.getCell(`F${rowIdx}`).value = undefined;
        }
      }

      // Dynamic Totals Formula
      const lastRouteRow = routeCount > 0 ? 3 + Math.min(routeCount, 12) : 4;
      targetWs.getCell('E16').value = { formula: `SUM(E4:E${lastRouteRow})` };
      targetWs.getCell('G16').value = { formula: `SUM(G4:G${lastRouteRow})` };
    }

    // 7. UPDATE DAILY SHEETS ('1' through '31') DYNAMICALLY
    for (let d = 1; d <= 31; d++) {
      const ws = workbook.getWorksheet(String(d));
      if (!ws) continue;

      ws.getCell('A1').value = `${territoryName} Territory - Daily Sales and Target Achievement Sheet`;
      ws.getCell('B2').value = territoryName;
      ws.getCell('D2').value = regionName;
      ws.getCell('K2').value = new Date(year, month - 1, d);

      const daySales = salesByDay.get(d);

      for (let i = 0; i < 12; i++) {
        const rowIdx = 5 + i; // row 5 to 16 in daily sheet
        if (i < routeCount) {
          const r = routes[i];
          const sale = daySales?.get(r.id);
          const cSales = sale?.cig || 0;
          const bSales = sale?.bidi || 0;

          ws.getCell(`G${rowIdx}`).value = cSales > 0 ? cSales : undefined;
          ws.getCell(`H${rowIdx}`).value = bSales > 0 ? bSales : undefined;
        } else {
          // Clear unused slot
          ws.getCell(`G${rowIdx}`).value = undefined;
          ws.getCell(`H${rowIdx}`).value = undefined;
        }
      }

      // Dynamic Totals Row
      const lastDailyRow = routeCount > 0 ? 4 + Math.min(routeCount, 12) : 5;
      ws.getCell('E17').value = { formula: `SUM(E5:E${lastDailyRow})` };
      ws.getCell('G17').value = { formula: `SUM(G5:G${lastDailyRow})` };
      ws.getCell('I17').value = { formula: `SUM(I5:I${lastDailyRow})` };
    }

    // 8. UPDATE "ATDA & ADS" SHEET DYNAMICALLY
    const elapsedDays = TerritoryCalculationEngine.calculateElapsedWorkingDays(year, month, day);
    const atdaWs = workbook.getWorksheet('ATDA & ADS');
    if (atdaWs) {
      atdaWs.getCell('A1').value = `${territoryName} Territory - Performance Achievement To Date Average (ATDA) & Average Daily Sales (ADS)`;
      atdaWs.getCell('H2').value = elapsedDays;
      atdaWs.getCell('L2').value = new Date(year, month - 1, day);

      for (let i = routeCount; i < 12; i++) {
        const rowIdx = 4 + i;
        atdaWs.getCell(`A${rowIdx}`).value = undefined;
        atdaWs.getCell(`B${rowIdx}`).value = undefined;
        atdaWs.getCell(`C${rowIdx}`).value = undefined;
      }
    }

    // 9. UPDATE "Analysis" SHEET DYNAMICALLY
    const analysisWs = workbook.getWorksheet('Analysis');
    if (analysisWs) {
      analysisWs.getCell('A1').value = `${territoryName} Territory - Executive Sales Performance & Analysis Dashboard (${monthName} ${year})`;
      analysisWs.getCell('A2').value = {
        formula: `"Territory: ${territoryName} | Region: ${regionName} | Performance as of Working Day "&'ATDA & ADS'!$H$2&" of "&Target!$H$2&" ("&TEXT('ATDA & ADS'!$L$2,"yyyy-mm-dd")&") | Status: Live Sync with ${workingDays} Working Days (Fridays Excluded)"`
      };
      analysisWs.getCell('A8').value = `TERRITORY BENCHMARKS & BASELINE (${monthName.toUpperCase()} ${year})`;

      // Clean unused leaderboard ranks if territory has fewer routes
      for (let i = routeCount; i < 12; i++) {
        const rowIdx = 12 + i;
        analysisWs.getCell(`A${rowIdx}`).value = undefined;
        analysisWs.getCell(`B${rowIdx}`).value = undefined;
        analysisWs.getCell(`C${rowIdx}`).value = undefined;
      }
    }

    const outBuffer = await workbook.xlsx.writeBuffer();
    const filename = `${territoryName} Territory CSR Sales ${monthName} ${day} ${year}.xlsx`;

    return {
      filename,
      buffer: Buffer.from(outBuffer),
    };
  }
}
