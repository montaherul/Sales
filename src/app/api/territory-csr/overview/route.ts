import { NextRequest, NextResponse } from 'next/server';
import { TerritoryCsrService } from '@/modules/territory-csr';
import { getAuthenticatedUser } from '@/shared/auth';

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
    const companyId = searchParams.get('companyId') || undefined;

    const overview = await TerritoryCsrService.getOverview({
      territoryId,
      year,
      month,
      day,
      companyId,
    });

    return NextResponse.json({
      success: true,
      data: overview,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch territory CSR overview' },
      { status: 500 }
    );
  }
}
