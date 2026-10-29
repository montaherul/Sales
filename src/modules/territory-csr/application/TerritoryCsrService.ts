// Application Service: Territory CSR & Route Sales Intelligence
// Handles dynamic database querying, aggregation, calculations, and persistence

import { dbQuery } from '@/shared/database/db';
import { logger } from '@/shared/logger';
import { 
  TerritoryPerformanceOverview, 
  RoutePerformanceSummary, 
  RouteDailySaleEntry, 
  TerritoryBenchmarks 
} from '../domain/types';
import { TerritoryCalculationEngine } from '../domain/TerritoryCalculationEngine';
import { MONTH_NAMES } from '@/shared/constants';

export class TerritoryCsrService {
  /**
   * Generates complete Territory CSR performance overview for a territory on a given day/month/year
   */
  public static async getOverview(params: {
    territoryId: string;
    year: number;
    month: number;
    day: number;
    companyId?: string;
  }): Promise<TerritoryPerformanceOverview> {
    const { territoryId, year, month, day, companyId } = params;

    // 1. Fetch Territory & Region metadata
    const terrRes = await dbQuery(`
      SELECT t.id, t.name as territory_name, r.name as region_name, r.id as region_id
      FROM territories t
      JOIN regions r ON t.region_id = r.id
      WHERE t.id = $1
      LIMIT 1;
    `, [territoryId]);

    if (terrRes.rows.length === 0) {
      throw new Error(`Territory with ID ${territoryId} not found.`);
    }

    const terrRow = terrRes.rows[0];
    const territoryName = terrRow.territory_name;
    const regionName = terrRow.region_name;

    // 2. Fetch or initialize benchmarks
    const benchRes = await dbQuery(`
      SELECT lms, lm_ads, working_days
      FROM territory_target_benchmarks
      WHERE territory_id = $1 AND year = $2 AND month = $3
      LIMIT 1;
    `, [territoryId, year, month]);

    const totalWorkingDays = benchRes.rows[0]?.working_days || TerritoryCalculationEngine.calculateTotalWorkingDays(year, month);
    const lms = parseFloat(benchRes.rows[0]?.lms || 0);
    const lmAds = parseFloat(benchRes.rows[0]?.lm_ads || 0);

    // 3. Calculate working days elapsed and remaining
    const elapsedWorkingDays = TerritoryCalculationEngine.calculateElapsedWorkingDays(year, month, day);
    const remainingWorkingDays = Math.max(0, totalWorkingDays - elapsedWorkingDays);

    const dayStr = String(day).padStart(2, '0');
    const monthStr = String(month).padStart(2, '0');
    const reportingDate = `${year}-${monthStr}-${dayStr}`;

    // 4. Fetch routes for this territory
    const routesRes = await dbQuery(`
      SELECT id, name, code, csr_id, csr_name, outlet_count, sort_order
      FROM routes
      WHERE territory_id = $1 AND is_active = TRUE
      ORDER BY sort_order ASC, name ASC;
    `, [territoryId]);

    const routesList = routesRes.rows;

    // 5. Fetch targets for all routes in this territory for (year, month)
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

    // 6. Fetch all daily sales for this month up to selected day to compute MTD
    const startDate = `${year}-${monthStr}-01`;
    const endDate = `${year}-${monthStr}-31`;

    const allSalesRes = await dbQuery(`
      SELECT route_id, report_date, sales_cigarette, sales_bidi, remarks
      FROM route_daily_sales
      WHERE territory_id = $1 AND report_date >= $2 AND report_date <= $3
      ORDER BY report_date ASC;
    `, [territoryId, startDate, endDate]);

    // Group sales: MTD sales by route and sales on selected day
    const mtdSalesByRoute = new Map<string, { cig: number; bidi: number }>();
    const selectedDaySalesByRoute = new Map<string, { cig: number; bidi: number; remarks: string }>();

    for (const s of allSalesRes.rows) {
      const sDateStr = typeof s.report_date === 'string' 
        ? s.report_date.slice(0, 10) 
        : new Date(s.report_date).toISOString().slice(0, 10);
      const sDay = parseInt(sDateStr.split('-')[2], 10);

      const rId = s.route_id;
      const cSales = parseFloat(s.sales_cigarette || 0);
      const bSales = parseFloat(s.sales_bidi || 0);

      // Add to MTD only if <= selectedDay
      if (sDay <= day) {
        const curMtd = mtdSalesByRoute.get(rId) || { cig: 0, bidi: 0 };
        curMtd.cig += cSales;
        curMtd.bidi += bSales;
        mtdSalesByRoute.set(rId, curMtd);
      }

      // If exactly selected day
      if (sDay === day) {
        selectedDaySalesByRoute.set(rId, {
          cig: cSales,
          bidi: bSales,
          remarks: s.remarks || '',
        });
      }
    }

    // 7. Calculate Route Performance Summaries
    let totalMonthlyTarget = 0;
    let totalMtdTarget = 0;
    let totalActualSalesMtdCig = 0;
    let totalActualSalesMtdBidi = 0;

    const routeSummaries: RoutePerformanceSummary[] = [];
    const selectedDayEntries: RouteDailySaleEntry[] = [];

    routesList.forEach((r, idx) => {
      const slNo = r.sort_order || idx + 1;
      const tg = targetMap.get(r.id) || { cig: 0, bidi: 0 };
      const monthlyTargetCig = tg.cig;
      const monthlyTargetBidi = tg.bidi;
      const routeMonthlyTarget = Number((monthlyTargetCig + monthlyTargetBidi).toFixed(2));

      const dailyTargetCig = TerritoryCalculationEngine.calculateDailyTarget(monthlyTargetCig, totalWorkingDays);
      const dailyTargetBidi = TerritoryCalculationEngine.calculateDailyTarget(monthlyTargetBidi, totalWorkingDays);
      const totalDailyTarget = Number((dailyTargetCig + dailyTargetBidi).toFixed(2));

      // MTD target to date = daily target * elapsed working days
      const mtdTargetToDate = Number((totalDailyTarget * elapsedWorkingDays).toFixed(2));

      const mtd = mtdSalesByRoute.get(r.id) || { cig: 0, bidi: 0 };
      const actualSalesMtdCig = Number(mtd.cig.toFixed(2));
      const actualSalesMtdBidi = Number(mtd.bidi.toFixed(2));
      const actualSalesMtdTotal = Number((actualSalesMtdCig + actualSalesMtdBidi).toFixed(2));

      const varianceMtd = Number((actualSalesMtdTotal - mtdTargetToDate).toFixed(2));
      const atdaPct = mtdTargetToDate > 0 ? Number((actualSalesMtdTotal / mtdTargetToDate).toFixed(4)) : 0;
      const ads = elapsedWorkingDays > 0 ? Number((actualSalesMtdTotal / elapsedWorkingDays).toFixed(4)) : 0;

      // Required Run Rate for remaining days
      const remainingTarget = Math.max(0, routeMonthlyTarget - actualSalesMtdTotal);
      const reqRunRate = remainingWorkingDays > 0 ? Number((remainingTarget / remainingWorkingDays).toFixed(2)) : 0;

      // Projected Sales
      const projectedSales = Number((ads * totalWorkingDays).toFixed(2));
      const projectedAchPct = routeMonthlyTarget > 0 ? Number((projectedSales / routeMonthlyTarget).toFixed(4)) : 0;

      const tier = TerritoryCalculationEngine.getPerformanceTier(atdaPct);

      totalMonthlyTarget += routeMonthlyTarget;
      totalMtdTarget += mtdTargetToDate;
      totalActualSalesMtdCig += actualSalesMtdCig;
      totalActualSalesMtdBidi += actualSalesMtdBidi;

      routeSummaries.push({
        slNo,
        routeId: r.id,
        routeName: r.name,
        csrName: r.csr_name || 'Unassigned',
        outletCount: r.outlet_count || 0,
        monthlyTargetCigarette: monthlyTargetCig,
        monthlyTargetBidi: monthlyTargetBidi,
        totalMonthlyTarget: routeMonthlyTarget,
        dailyTargetCigarette: dailyTargetCig,
        dailyTargetBidi: dailyTargetBidi,
        totalDailyTarget,
        mtdTargetToDate,
        actualSalesMtdCigarette: actualSalesMtdCig,
        actualSalesMtdBidi: actualSalesMtdBidi,
        actualSalesMtdTotal,
        varianceMtd,
        atdaPct,
        ads,
        reqRunRate,
        projectedSales,
        projectedAchPct,
        rank: 0, // calculated below
        performanceTier: tier,
      });

      // Daily Entry for selected date
      const dEntry = selectedDaySalesByRoute.get(r.id) || { cig: 0, bidi: 0, remarks: '' };
      const dTotalSales = Number((dEntry.cig + dEntry.bidi).toFixed(2));
      const dVariance = Number((dTotalSales - totalDailyTarget).toFixed(2));
      const dAchPct = totalDailyTarget > 0 ? Number((dTotalSales / totalDailyTarget).toFixed(4)) : 0;
      const dTier = TerritoryCalculationEngine.getPerformanceTier(dAchPct);

      selectedDayEntries.push({
        routeId: r.id,
        routeName: r.name,
        csrName: r.csr_name || 'Unassigned',
        reportDate: reportingDate,
        salesCigarette: dEntry.cig,
        salesBidi: dEntry.bidi,
        totalSales: dTotalSales,
        dailyTargetCigarette: dailyTargetCig,
        dailyTargetBidi: dailyTargetBidi,
        totalDailyTarget,
        variance: dVariance,
        achievementPct: dAchPct,
        remarks: dEntry.remarks,
        performanceTier: dTier,
      });
    });

    // 8. Sort and Rank routes by ATDA % descending for Leaderboard
    const sortedForRanking = [...routeSummaries].sort((a, b) => b.atdaPct - a.atdaPct);
    sortedForRanking.forEach((item, rk) => {
      const found = routeSummaries.find(r => r.routeId === item.routeId);
      if (found) found.rank = rk + 1;
    });

    // 9. Territory Totals
    const totalActualSalesMtdTotal = Number((totalActualSalesMtdCig + totalActualSalesMtdBidi).toFixed(2));
    const totalVarianceMtd = Number((totalActualSalesMtdTotal - totalMtdTarget).toFixed(2));
    const overallAtdaPct = totalMtdTarget > 0 ? Number((totalActualSalesMtdTotal / totalMtdTarget).toFixed(4)) : 0;
    const overallAds = elapsedWorkingDays > 0 ? Number((totalActualSalesMtdTotal / elapsedWorkingDays).toFixed(4)) : 0;
    const overallRemainingTarget = Math.max(0, totalMonthlyTarget - totalActualSalesMtdTotal);
    const overallReqRunRate = remainingWorkingDays > 0 ? Number((overallRemainingTarget / remainingWorkingDays).toFixed(2)) : 0;
    const monthEndProjectedSales = Number((overallAds * totalWorkingDays).toFixed(2));
    const overallProjectedAchPct = totalMonthlyTarget > 0 ? Number((monthEndProjectedSales / totalMonthlyTarget).toFixed(4)) : 0;

    const tmTargetAds = totalWorkingDays > 0 ? Number((totalMonthlyTarget / totalWorkingDays).toFixed(2)) : 0;

    const benchmarks: TerritoryBenchmarks = {
      territoryId,
      territoryName,
      regionName,
      year,
      month,
      lms,
      lmAds,
      workingDays: totalWorkingDays,
      tmTarget: Number(totalMonthlyTarget.toFixed(2)),
      tmTargetAds,
    };

    return {
      territory: {
        id: territoryId,
        name: territoryName,
        regionName,
      },
      period: {
        year,
        month,
        day,
        monthName: MONTH_NAMES[month - 1] || 'October',
        reportingDate,
        workingDaysTotal: totalWorkingDays,
        workingDaysElapsed: elapsedWorkingDays,
        workingDaysRemaining: remainingWorkingDays,
      },
      benchmarks,
      routes: routeSummaries,
      dailySalesForSelectedDate: selectedDayEntries,
      territoryTotals: {
        totalMonthlyTarget: Number(totalMonthlyTarget.toFixed(2)),
        mtdTargetToDate: Number(totalMtdTarget.toFixed(2)),
        actualSalesMtdTotal: totalActualSalesMtdTotal,
        actualSalesMtdCigarette: Number(totalActualSalesMtdCig.toFixed(2)),
        actualSalesMtdBidi: Number(totalActualSalesMtdBidi.toFixed(2)),
        varianceMtd: totalVarianceMtd,
        overallAtdaPct,
        ads: overallAds,
        reqRunRate: overallReqRunRate,
        monthEndProjectedSales,
        projectedAchPct: overallProjectedAchPct,
        pacingStatus: overallAtdaPct >= 1.0 ? 'Overall Achieved' : 'Needs Pacing',
      },
    };
  }

  /**
   * Batch upserts daily sales for routes on a date
   */
  public static async saveDailySales(params: {
    territoryId: string;
    reportDate: string;
    sales: Array<{
      routeId: string;
      salesCigarette: number;
      salesBidi: number;
      remarks?: string;
    }>;
    companyId?: string;
  }): Promise<{ success: boolean; count: number }> {
    const { territoryId, reportDate, sales, companyId } = params;

    let savedCount = 0;
    for (const item of sales) {
      await dbQuery(`
        INSERT INTO route_daily_sales (company_id, territory_id, route_id, report_date, sales_cigarette, sales_bidi, remarks, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (route_id, report_date)
        DO UPDATE SET 
          sales_cigarette = EXCLUDED.sales_cigarette,
          sales_bidi = EXCLUDED.sales_bidi,
          remarks = EXCLUDED.remarks,
          updated_at = NOW();
      `, [
        companyId || null,
        territoryId,
        item.routeId,
        reportDate,
        item.salesCigarette || 0,
        item.salesBidi || 0,
        item.remarks || null,
      ]);
      savedCount++;
    }

    return { success: true, count: savedCount };
  }

  /**
   * Batch upserts targets and benchmarks
   */
  public static async saveTargets(params: {
    territoryId: string;
    year: number;
    month: number;
    benchmarks?: {
      lms?: number;
      lmAds?: number;
      workingDays?: number;
    };
    targets: Array<{
      routeId: string;
      targetCigarette: number;
      targetBidi: number;
    }>;
    companyId?: string;
  }): Promise<{ success: boolean }> {
    const { territoryId, year, month, benchmarks, targets, companyId } = params;

    if (benchmarks) {
      await dbQuery(`
        INSERT INTO territory_target_benchmarks (company_id, territory_id, year, month, lms, lm_ads, working_days, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (territory_id, year, month)
        DO UPDATE SET
          lms = COALESCE(EXCLUDED.lms, territory_target_benchmarks.lms),
          lm_ads = COALESCE(EXCLUDED.lm_ads, territory_target_benchmarks.lm_ads),
          working_days = COALESCE(EXCLUDED.working_days, territory_target_benchmarks.working_days),
          updated_at = NOW();
      `, [
        companyId || null,
        territoryId,
        year,
        month,
        benchmarks.lms || 0,
        benchmarks.lmAds || 0,
        benchmarks.workingDays || 26,
      ]);
    }

    for (const tg of targets) {
      await dbQuery(`
        INSERT INTO route_targets (company_id, territory_id, route_id, year, month, target_cigarette, target_bidi, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (route_id, year, month)
        DO UPDATE SET
          target_cigarette = EXCLUDED.target_cigarette,
          target_bidi = EXCLUDED.target_bidi,
          updated_at = NOW();
      `, [
        companyId || null,
        territoryId,
        tg.routeId,
        year,
        month,
        tg.targetCigarette || 0,
        tg.targetBidi || 0,
      ]);
    }

    return { success: true };
  }
}
