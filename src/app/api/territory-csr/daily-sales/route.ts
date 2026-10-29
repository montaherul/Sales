import { NextRequest, NextResponse } from 'next/server';
import { TerritoryCsrService } from '@/modules/territory-csr';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { territoryId, reportDate, sales, companyId } = body;

    if (!territoryId || !reportDate || !Array.isArray(sales)) {
      return NextResponse.json(
        { success: false, error: 'territoryId, reportDate, and sales array are required' },
        { status: 400 }
      );
    }

    const result = await TerritoryCsrService.saveDailySales({
      territoryId,
      reportDate,
      sales,
      companyId,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully saved ${result.count} route sales records`,
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save route daily sales' },
      { status: 500 }
    );
  }
}
