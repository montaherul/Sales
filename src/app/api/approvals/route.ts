// Next.js Route Handler: /api/approvals
// Connects approval requests directly to Approval State Machine and Service

import { NextRequest, NextResponse } from 'next/server';
import { ApprovalService } from '@/modules/approval';
import { getAuthenticatedUser } from '@/shared/auth';
import { WorkflowTransitionInputSchema } from '@/shared/validation';
import { AppError } from '@/shared/errors';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const body = await request.json();

    // Validate DTO with Zod schema
    const validatedData = WorkflowTransitionInputSchema.parse(body);

    const result = await ApprovalService.executeTransition({
      submissionId: validatedData.id,
      action: validatedData.action as any,
      reason: validatedData.reason,
      user,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    const status = error instanceof AppError ? error.statusCode : 400;
    return NextResponse.json(
      { success: false, error: error.message || 'Workflow transition failed' },
      { status }
    );
  }
}
