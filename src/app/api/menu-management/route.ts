// Tier 2 Presentation Controller: Menu Management Route Handler
// Handles HTTP request/response, actor resolution, and delegates to MenuAccessService
// AGENTS1.md Rule 4 & Rule 5 (Presentation Layer / Thin Controllers)

import { NextRequest, NextResponse } from 'next/server';
import { MenuAccessService } from '@/modules/identity';
import { getAuthenticatedUser } from '@/shared/auth';
import { logger } from '@/shared/logger';

export async function GET(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    const data = await MenuAccessService.getMatrix(actor, companyId);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    logger.error('Menu management GET error', error, 'MenuAccessController.GET');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch menu access data' },
      { status: error.statusCode || 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const body = await request.json();
    const { type, roleName, userId, menuId, canView, canEdit } = body;

    if (type === 'RWMA') {
      await MenuAccessService.updateRoleMenuAccess(actor, roleName, menuId, canView ?? true, canEdit ?? false);
      return NextResponse.json({
        success: true,
        message: `Updated RWMA for role ${roleName} on menu ${menuId}.`,
      });
    }

    if (type === 'UWMA') {
      await MenuAccessService.updateUserMenuAccess(actor, userId, menuId, canView ?? true, canEdit ?? false);
      return NextResponse.json({
        success: true,
        message: `Updated UWMA for user ${userId} on menu ${menuId}.`,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid update type' }, { status: 400 });
  } catch (error: any) {
    logger.error('Menu management POST error', error, 'MenuAccessController.POST');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update menu permissions' },
      { status: error.statusCode || 500 }
    );
  }
}
