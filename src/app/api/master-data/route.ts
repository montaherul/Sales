// Tier 2 Presentation Controller: Master Data Route Handler
// Handles HTTP request/response, actor resolution, and delegates to MasterDataService
// AGENTS1.md Rule 4 & Rule 5 (Presentation Layer / Thin Controllers)

import { NextRequest, NextResponse } from 'next/server';
import { MasterDataService } from '@/modules/organization';
import { getAuthenticatedUser } from '@/shared/auth';
import { logger } from '@/shared/logger';

export async function GET(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    const reqCompanyId = searchParams.get('companyId');
    const now = new Date();
    const reqYear = parseInt(searchParams.get('year') || String(now.getFullYear()), 10);
    const reqMonth = parseInt(searchParams.get('month') || String(now.getMonth() + 1), 10);

    const data = await MasterDataService.getMasterData(actor, reqCompanyId, reqYear, reqMonth);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    logger.error('Master data query error', error, 'MasterDataController.GET');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load master data' },
      { status: error.statusCode || 500 }
    );
  }
}
