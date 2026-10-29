import { NextRequest, NextResponse } from 'next/server';
import { TerritoryWorkbookBuilder } from '@/modules/territory-csr';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const territoryId = searchParams.get('territoryId');

    if (!territoryId) {
      return NextResponse.json(
        { success: false, error: 'territoryId is required' },
        { status: 400 }
      );
    }

    const now = new Date();
    const year = parseInt(searchParams.get('year') || String(now.getFullYear()), 10);
    const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1), 10);
    const day = parseInt(searchParams.get('day') || String(now.getDate()), 10);

    const { filename, buffer } = await TerritoryWorkbookBuilder.buildWorkbook({
      territoryId,
      year,
      month,
      day,
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to export territory CSR workbook' },
      { status: 500 }
    );
  }
}
