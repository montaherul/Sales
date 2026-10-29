import { NextRequest, NextResponse } from 'next/server';
import { TerritoryCsrService } from '@/modules/territory-csr';

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { territoryId, year, month, benchmarks, targets, companyId } = body;

    if (!territoryId || !year || !month || !Array.isArray(targets)) {
      return NextResponse.json(
        { success: false, error: 'territoryId, year, month, and targets array are required' },
        { status: 400 }
      );
    }

    const result = await TerritoryCsrService.saveTargets({
      territoryId,
      year: parseInt(String(year), 10),
      month: parseInt(String(month), 10),
      benchmarks,
      targets,
      companyId,
    });

    return NextResponse.json({
      success: true,
      message: 'Route targets and benchmarks updated successfully',
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update route targets' },
      { status: 500 }
    );
  }
}
