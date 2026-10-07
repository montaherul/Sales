// Next.js Route Handler: /api/daily-sales
// Connects API requests directly to Application Use Case and Authorization Policies

import { NextRequest, NextResponse } from 'next/server';
import { DailySalesService } from '@/modules/daily-sales';
import { getAuthenticatedUser } from '@/shared/auth';
import { DailySubmissionInputSchema } from '@/shared/validation';
import { AppError } from '@/shared/errors';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const records = await DailySalesService.getSubmissions(date);

    return NextResponse.json({
      success: true,
      data: records,
    });
  } catch (error: any) {
    const status = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch sales records' },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const body = await request.json();

    // Validate DTO with Zod schema
    const validatedData = DailySubmissionInputSchema.parse(body);

    const submissionId = await DailySalesService.saveEntry(
      {
        territoryId: validatedData.territoryId,
        reportingDate: validatedData.reportingDate,
        status: validatedData.status as any,
        remarks: validatedData.remarks,
        cigaretteSales: validatedData.cigaretteSales,
        cigaretteStock: validatedData.cigaretteStock,
        zardaSales: validatedData.zardaSales,
        zardaStock: validatedData.zardaStock,
        emptyPackets: validatedData.emptyPackets,
      },
      user
    );

    return NextResponse.json({
      success: true,
      data: { submissionId, status: validatedData.status },
    });
  } catch (error: any) {
    const status = error instanceof AppError ? error.statusCode : 400;
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save daily entry' },
      { status }
    );
  }
}
