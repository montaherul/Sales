// Tier 2: User Presentation Controller & Route Handler
// Thin HTTP endpoint delegating to IdentityService
// AGENTS1.md Rule 4 & Rule 5 (Thin Controllers / Separation of Concerns)

import { NextRequest, NextResponse } from 'next/server';
import { IdentityService } from '@/modules/identity';
import { getAuthenticatedUser } from '@/shared/auth';
import { AppError } from '@/shared/errors';
import { logger } from '@/shared/logger';

export async function GET(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    const search = searchParams.get('search') || '';
    const companyId = searchParams.get('companyId');
    const roleName = searchParams.get('roleName');
    const sortBy = searchParams.get('sortBy') || 'u.created_at';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc';
    const isExport = searchParams.get('export') === 'csv';

    const filterOptions = {
      page,
      pageSize,
      search,
      companyId,
      roleName,
      sortBy,
      sortOrder,
    };

    if (isExport) {
      const csv = await IdentityService.exportUsersCsv(filterOptions, actor);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="Users_Directory_${Date.now()}.csv"`,
        },
      });
    }

    const result = await IdentityService.getUsersPaginated(filterOptions, actor);
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    const status = error instanceof AppError ? error.statusCode : 500;
    logger.error('Failed to fetch users', error, 'UserController.GET');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch users' },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const body = await request.json();

    const userId = await IdentityService.createUser(body, actor);

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      data: { id: userId, email: body.email, role: body.roleName },
    });
  } catch (error: any) {
    const status = error instanceof AppError ? error.statusCode : 400;
    logger.warn('Failed to create user', 'UserController.POST', { error: error.message });
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create user' },
      { status }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    await IdentityService.updateUser(body, actor);

    return NextResponse.json({
      success: true,
      message: 'User updated successfully',
    });
  } catch (error: any) {
    const status = error instanceof AppError ? error.statusCode : 400;
    logger.warn('Failed to update user', 'UserController.PUT', { error: error.message });
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update user' },
      { status }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const body = await request.json().catch(() => ({}));
    const idsToDelete: string[] = body.ids || (id ? [id] : []);

    const count = await IdentityService.deleteUsers(idsToDelete, actor);

    return NextResponse.json({
      success: true,
      message: `Deleted ${count} user(s) successfully`,
    });
  } catch (error: any) {
    const status = error instanceof AppError ? error.statusCode : 400;
    logger.warn('Failed to delete users', 'UserController.DELETE', { error: error.message });
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete users' },
      { status }
    );
  }
}
