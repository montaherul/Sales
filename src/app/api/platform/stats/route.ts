// Platform Analytics API for SaaS Super Administrator
// Returns aggregate multi-tenant platform statistics

import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/shared/database/db';
import { getAuthenticatedUser } from '@/shared/auth';
import { ROLES } from '@/shared/constants';
import { ForbiddenError } from '@/shared/errors';
import { logger } from '@/shared/logger';

export async function GET(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    if (actor.role !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only SUPER_ADMIN can view SaaS platform statistics');
    }

    const result = await dbQuery('SELECT sp_get_platform_stats() as stats;');
    const stats = result.rows[0]?.stats || {};

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    logger.error('Failed to fetch platform stats', error, 'PlatformStatsController');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch platform statistics' },
      { status: error.statusCode || 500 }
    );
  }
}
