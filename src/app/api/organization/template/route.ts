import { NextRequest, NextResponse } from 'next/server';
import { OrganizationService } from '@/modules/organization';
import { getAuthenticatedUser } from '@/shared/auth';
import { logger } from '@/shared/logger';

export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const body = await request.json();
    const companyId = body.companyId || actor.companyId;

    if (!companyId) {
      return NextResponse.json({ success: false, error: 'Company ID is required' }, { status: 400 });
    }

    const result = await OrganizationService.provisionTemplate(companyId, actor);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('Error provisioning tenant organization template', error, 'organizationTemplate.POST');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to provision organization template' },
      { status: error.statusCode || 500 }
    );
  }
}
