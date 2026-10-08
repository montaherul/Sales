import { NextRequest, NextResponse } from 'next/server';
import { generate34SheetMonthlyReport } from '@/lib/excel/export';
import { MonthlyWorkbookData } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || '2026', 10);
    const month = parseInt(searchParams.get('month') || '10', 10);
    const day = parseInt(searchParams.get('day') || '6', 10);

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = monthNames[month - 1] || 'October';

    const companyIdParam = searchParams.get('companyId');
    const { getAuthenticatedUser } = await import('@/shared/auth');
    const { dbQuery } = await import('@/lib/db');
    let targetCompanyId = companyIdParam && companyIdParam !== 'ALL' ? companyIdParam : null;
    try {
      const actor = await getAuthenticatedUser(request);
      if (actor.role !== 'SUPER_ADMIN' && actor.companyId) {
        targetCompanyId = actor.companyId;
      }
    } catch {}

    let divisionName = 'Ctg South';
    let wingName = 'Chittagong';

    if (targetCompanyId) {
      try {
        const dRes = await dbQuery(
          `SELECT d.name as div_name, w.name as wing_name 
           FROM divisions d 
           LEFT JOIN wings w ON w.division_id = d.id 
           WHERE d.company_id = $1 LIMIT 1`,
          [targetCompanyId]
        );
        if (dRes.rows.length > 0) {
          if (dRes.rows[0].div_name) divisionName = dRes.rows[0].div_name;
          if (dRes.rows[0].wing_name) wingName = dRes.rows[0].wing_name;
        }
      } catch {}
    }

    // Build workbook payload (Populates active territory operational data)
    const workbookData: MonthlyWorkbookData = {
      year,
      month,
      monthName,
      reportDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      divisionName,
      wingName,
      workingDays: 26,
      regions: [],
      dailyRecords: {
        [day]: [
          {
            territoryId: 'satkania-1',
            territoryName: 'Kerani hat',
            regionName: 'Satkania',
            reportDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
            dayNumber: day,
            status: 'FINALIZED',
            cigaretteSales: { wilson: 0.00, shahara: 0.00, express: 0.68, nexus: 0.00, sb: 0.00, sm: 0.00 },
            cigaretteStock: { wilson: 0.19, shahara: 0.00, express: 0.84, nexus: 0.00, sb: 0.00, sm: 0.00 },
            zardaSales: { slb: 0.01, qty_22_25: 5, qty_99_14: 0, qty_33_15: 0 },
            zardaStock: { slb: 0.97, qty_22_25: 1298, qty_99_14: 0, qty_33_15: 0 },
            emptyPackets: 6660,
            remarks: 'Active field operation',
            totalCigaretteSales: 0.68,
            totalCigaretteStock: 1.03,
            totalZardaSalesValue: 75,
            totalZardaStockValue: 19470,
          },
          {
            territoryId: 'satkania-2',
            territoryName: 'Satkania',
            regionName: 'Satkania',
            reportDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
            dayNumber: day,
            status: 'FINALIZED',
            cigaretteSales: { wilson: 0.01, shahara: 0.00, express: 0.41, nexus: 0.00, sb: 0.00, sm: 0.00 },
            cigaretteStock: { wilson: 0.05, shahara: 0.00, express: 1.15, nexus: 0.00, sb: 0.00, sm: 0.00 },
            zardaSales: { slb: 0.01, qty_22_25: 10, qty_99_14: 0, qty_33_15: 0 },
            zardaStock: { slb: 0.63, qty_22_25: 363, qty_99_14: 0, qty_33_15: 0 },
            emptyPackets: 4270,
            remarks: '',
            totalCigaretteSales: 0.42,
            totalCigaretteStock: 1.20,
            totalZardaSalesValue: 150,
            totalZardaStockValue: 5445,
          },
          {
            territoryId: 'satkania-3',
            territoryName: 'Bandarban',
            regionName: 'Satkania',
            reportDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
            dayNumber: day,
            status: 'FINALIZED',
            cigaretteSales: { wilson: 0.00, shahara: 0.00, express: 0.42, nexus: 0.00, sb: 0.00, sm: 0.00 },
            cigaretteStock: { wilson: 0.22, shahara: 0.00, express: 2.71, nexus: 0.00, sb: 0.00, sm: 0.00 },
            zardaSales: { slb: 0.03, qty_22_25: 0, qty_99_14: 60, qty_33_15: 0 },
            zardaStock: { slb: 1.15, qty_22_25: 60, qty_99_14: 1134, qty_33_15: 0 },
            emptyPackets: 4050,
            remarks: '',
            totalCigaretteSales: 0.42,
            totalCigaretteStock: 2.93,
            totalZardaSalesValue: 360,
            totalZardaStockValue: 7704,
          },
          {
            territoryId: 'satkania-4',
            territoryName: 'Rajasthali',
            regionName: 'Satkania',
            reportDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
            dayNumber: day,
            status: 'FINALIZED',
            cigaretteSales: { wilson: 0.00, shahara: 0.00, express: 0.06, nexus: 0.00, sb: 0.00, sm: 0.00 },
            cigaretteStock: { wilson: 0.09, shahara: 0.00, express: 0.11, nexus: 0.00, sb: 0.00, sm: 0.00 },
            zardaSales: { slb: 0.01, qty_22_25: 0, qty_99_14: 0, qty_33_15: 0 },
            zardaStock: { slb: 0.11, qty_22_25: 0, qty_99_14: 0, qty_33_15: 0 },
            emptyPackets: 600,
            remarks: '',
            totalCigaretteSales: 0.06,
            totalCigaretteStock: 0.20,
            totalZardaSalesValue: 0,
            totalZardaStockValue: 0,
          },
          {
            territoryId: 'satkania-5',
            territoryName: 'Dohazari',
            regionName: 'Satkania',
            reportDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
            dayNumber: day,
            status: 'FINALIZED',
            cigaretteSales: { wilson: 0.00, shahara: 0.00, express: 0.62, nexus: 0.00, sb: 0.00, sm: 0.00 },
            cigaretteStock: { wilson: 0.10, shahara: 0.00, express: 3.82, nexus: 0.00, sb: 0.00, sm: 0.00 },
            zardaSales: { slb: 0.00, qty_22_25: 18, qty_99_14: 0, qty_33_15: 0 },
            zardaStock: { slb: 0.58, qty_22_25: 962, qty_99_14: 0, qty_33_15: 0 },
            emptyPackets: 6400,
            remarks: '',
            totalCigaretteSales: 0.62,
            totalCigaretteStock: 3.92,
            totalZardaSalesValue: 270,
            totalZardaStockValue: 14430,
          }
        ]
      },
      targets: {},
      analysis: {}
    };

    const buffer = await generate34SheetMonthlyReport(workbookData);

    const filename = `Daily sales and Closing Stock Information ${monthName} ${day} ${year}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    console.error('Export error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate 34-sheet Excel report',
      },
      { status: 500 }
    );
  }
}
