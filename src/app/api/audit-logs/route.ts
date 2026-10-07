import { NextResponse } from 'next/server';
import { SubmissionRepository } from '@/lib/repositories/submission.repository';

export async function GET() {
  try {
    const logs = await SubmissionRepository.getAuditLogs();
    return NextResponse.json({
      success: true,
      data: logs,
    });
  } catch (error: any) {
    console.error('Audit logs error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
