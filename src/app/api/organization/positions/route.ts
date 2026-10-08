import { NextRequest, NextResponse } from 'next/server';
import { OrganizationService } from '@/modules/organization';
import { getAuthenticatedUser } from '@/shared/auth';
import { logger } from '@/shared/logger';

export async function GET(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const departmentId = searchParams.get('departmentId');

    const positions = await OrganizationService.getPositions(companyId, departmentId, actor);
    return NextResponse.json({ success: true, data: positions });
  } catch (error: any) {
    logger.error('Error fetching positions', error, 'positions.GET');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch positions' },
      { status: error.statusCode || 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const body = await request.json();

    const position = await OrganizationService.createPosition(body, actor);
    return NextResponse.json({ success: true, data: position });
  } catch (error: any) {
    logger.error('Error creating position', error, 'positions.POST');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create position' },
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
      return NextResponse.json({ success: false, error: 'Position ID is required' }, { status: 400 });
    }

    const updated = await OrganizationService.updatePosition(id, data, actor);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    logger.error('Error updating position', error, 'positions.PUT');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update position' },
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
      return NextResponse.json({ success: false, error: 'Position ID is required' }, { status: 400 });
    }

    await OrganizationService.deletePosition(id, actor);
    return NextResponse.json({ success: true, message: 'Position deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting position', error, 'positions.DELETE');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete position' },
      { status: error.statusCode || 500 }
    );
  }
}
