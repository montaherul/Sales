import { NextRequest, NextResponse } from 'next/server';
import { SubmissionRepository } from '@/lib/repositories/submission.repository';
import { DailyOperationalRecord } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || undefined;
    const territoryId = searchParams.get('territoryId') || undefined;
    const status = (searchParams.get('status') as any) || undefined;

    const records = await SubmissionRepository.getSubmissions({
      date,
      territoryId,
      status,
    });

    return NextResponse.json({
      success: true,
      data: records,
    });
  } catch (error: any) {
    console.error('Error fetching submissions:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch submissions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const record: DailyOperationalRecord = body.record;
    const userId = body.userId || 'current-user-id';
    const changeReason = body.changeReason;

    if (!record || !record.territoryId || !record.reportDate) {
      return NextResponse.json(
        { success: false, error: 'territoryId and reportDate are required' },
        { status: 400 }
      );
    }

    const saved = await SubmissionRepository.saveSubmission(record, userId, changeReason);

    return NextResponse.json({
      success: true,
      data: saved,
    });
  } catch (error: any) {
    console.error('Error saving submission:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save submission' },
      { status: 500 }
    );
  }
}
