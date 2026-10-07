import { NextRequest, NextResponse } from 'next/server';
import { SubmissionRepository } from '@/lib/repositories/submission.repository';
import { DailyOperationalRecord } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const records: DailyOperationalRecord[] = body.records || [];
    const userId = body.userId || 'current-user-id';

    if (!records.length) {
      return NextResponse.json(
        { success: false, error: 'No records to commit' },
        { status: 400 }
      );
    }

    const savedRecords: DailyOperationalRecord[] = [];
    for (const rec of records) {
      const saved = await SubmissionRepository.saveSubmission(
        rec,
        userId,
        `Imported from XLSX file: ${body.fileName || 'bulk import'}`
      );
      savedRecords.push(saved);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully committed ${savedRecords.length} records into database.`,
      count: savedRecords.length,
    });
  } catch (error: any) {
    console.error('Import commit error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to commit import records' },
      { status: 500 }
    );
  }
}
