import { NextRequest, NextResponse } from 'next/server';
import { OrganizationService } from '@/modules/organization';
import { getAuthenticatedUser } from '@/shared/auth';
import { logger } from '@/shared/logger';

export async function GET(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    const departments = await OrganizationService.getDepartments(companyId, actor);
    return NextResponse.json({ success: true, data: departments });
  } catch (error: any) {
    logger.error('Error fetching departments', error, 'departments.GET');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch departments' },
      { status: error.statusCode || 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const body = await request.json();

    const department = await OrganizationService.createDepartment(body, actor);
    return NextResponse.json({ success: true, data: department });
  } catch (error: any) {
    logger.error('Error creating department', error, 'departments.POST');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create department' },
      { status: error.statusCode || 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Department ID is required' }, { status: 400 });
    }

    const updated = await OrganizationService.updateDepartment(id, data, actor);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    logger.error('Error updating department', error, 'departments.PUT');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update department' },
      { status: error.statusCode || 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Department ID is required' }, { status: 400 });
    }

    await OrganizationService.deleteDepartment(id, actor);
    return NextResponse.json({ success: true, message: 'Department deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting department', error, 'departments.DELETE');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete department' },
      { status: error.statusCode || 500 }
    );
  }
}
