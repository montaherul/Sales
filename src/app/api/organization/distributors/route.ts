import { NextRequest, NextResponse } from 'next/server';
import { OrganizationService } from '@/modules/organization';
import { getAuthenticatedUser } from '@/shared/auth';
import { logger } from '@/shared/logger';

export async function GET(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const territoryId = searchParams.get('territoryId');

    const distributors = await OrganizationService.getDistributors(companyId, territoryId, actor);
    return NextResponse.json({ success: true, data: distributors });
  } catch (error: any) {
    logger.error('Error fetching distributors', error, 'distributors.GET');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch distributors' },
      { status: error.statusCode || 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const body = await request.json();

    const distributor = await OrganizationService.createDistributor(body, actor);
    return NextResponse.json({ success: true, data: distributor });
  } catch (error: any) {
    logger.error('Error creating distributor', error, 'distributors.POST');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create distributor' },
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
      return NextResponse.json({ success: false, error: 'Distributor ID is required' }, { status: 400 });
    }

    const updated = await OrganizationService.updateDistributor(id, data, actor);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    logger.error('Error updating distributor', error, 'distributors.PUT');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update distributor' },
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
      return NextResponse.json({ success: false, error: 'Distributor ID is required' }, { status: 400 });
    }

    await OrganizationService.deleteDistributor(id, actor);
    return NextResponse.json({ success: true, message: 'Distributor deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting distributor', error, 'distributors.DELETE');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete distributor' },
      { status: error.statusCode || 500 }
    );
  }
}
