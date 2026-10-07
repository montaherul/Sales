// Next.js Route Handler: /api/targets
// Fetches territory brand targets from Target Module

import { NextRequest, NextResponse } from 'next/server';
import { TargetService } from '@/modules/target';
import { AppError } from '@/shared/errors';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || '2026', 10);
    const month = parseInt(searchParams.get('month') || '10', 10);

    const targets = await TargetService.getTargets(year, month);

    return NextResponse.json({
      success: true,
      data: targets,
    });
  } catch (error: any) {
    const status = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch targets' },
      { status }
    );
  }
}
