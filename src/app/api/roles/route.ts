// Tier 2: Role Management Presentation Controller & Route Handler
// Thin HTTP endpoint delegating to RoleService
// AGENTS1.md Rule 4 & Rule 5 (Thin Controllers / Separation of Concerns)

import { NextRequest, NextResponse } from 'next/server';
import { RoleService } from '@/modules/identity';
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
    const sortBy = searchParams.get('sortBy') || 'name';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc';
    const isExport = searchParams.get('export') === 'csv';
    const isAll = searchParams.get('all') === 'true';

    const filterOptions = {
      page,
      pageSize: isAll ? -1 : pageSize,
      search,
      companyId,
      sortBy,
      sortOrder,
    };

    if (isExport) {
      const csv = await RoleService.exportRolesCsv(filterOptions, actor);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="Roles_Catalog_${Date.now()}.csv"`,
        },
      });
    }

    const result = await RoleService.getRolesPaginated(filterOptions, actor);
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    const status = error instanceof AppError ? error.statusCode : 500;
    logger.error('Failed to fetch roles', error, 'RoleController.GET');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch roles' },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const body = await request.json();

    const created = await RoleService.createRole(body, actor);

    return NextResponse.json({
      success: true,
      message: 'Role created successfully',
      data: created,
    });
  } catch (error: any) {
    const status = error instanceof AppError ? error.statusCode : 400;
    logger.warn('Failed to create role', 'RoleController.POST', { error: error.message });
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create role' },
      { status }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ success: false, error: 'Role ID is required' }, { status: 400 });
    }

    const updated = await RoleService.updateRole(body, actor);

    return NextResponse.json({
      success: true,
      message: 'Role updated successfully',
      data: updated,
    });
  } catch (error: any) {
    const status = error instanceof AppError ? error.statusCode : 400;
    logger.warn('Failed to update role', 'RoleController.PUT', { error: error.message });
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update role' },
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

    const count = await RoleService.deleteRoles(idsToDelete, actor);

    return NextResponse.json({
      success: true,
      message: `Deleted ${count} role(s) successfully`,
    });
  } catch (error: any) {
    const status = error instanceof AppError ? error.statusCode : 400;
    logger.warn('Failed to delete roles', 'RoleController.DELETE', { error: error.message });
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete roles' },
      { status }
    );
  }
}
