// Tier 2 Presentation Controller: Platform Analytics Route Handler
// Returns aggregate multi-tenant platform statistics via CompanyService
// AGENTS1.md Rule 4 & Rule 5 (Presentation Layer / Thin Controllers)

import { NextRequest, NextResponse } from 'next/server';
import { CompanyService } from '@/modules/organization';
import { getAuthenticatedUser } from '@/shared/auth';
import { logger } from '@/shared/logger';

export async function GET(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const stats = await CompanyService.getPlatformStats(actor);

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    logger.error('Failed to fetch platform stats', error, 'PlatformStatsController.GET');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch platform statistics' },
      { status: error.statusCode || 500 }
    );
  }
}
