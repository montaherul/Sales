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

    const { getAuthenticatedUser } = await import('@/shared/auth');
    const { logger } = await import('@/shared/logger');
    let actorId = 'system';
    let tenantCompanyId = body.companyId || null;
    try {
      const actor = await getAuthenticatedUser(request);
      actorId = actor.id;
      if (actor.role !== 'SUPER_ADMIN' && actor.companyId) {
        tenantCompanyId = actor.companyId;
      }
    } catch (authErr) {
      logger.debug('Import commit evaluated with client body scope', 'imports.commit.POST', { authErr });
    }

    const savedRecords: DailyOperationalRecord[] = [];
    for (const rec of records) {
      if (tenantCompanyId && !rec.companyId) {
        rec.companyId = tenantCompanyId;
      }
      const saved = await SubmissionRepository.saveSubmission(
        rec,
        actorId,
        `Imported from XLSX file: ${body.fileName || 'bulk import'}`
      );
      savedRecords.push(saved);
    }

    await SubmissionRepository.recordAuditLog(
      'IMPORT_COMMIT',
      actorId,
      'daily_submissions',
      body.fileName || 'bulk-import',
      undefined,
      {
        fileName: body.fileName,
        importedCount: savedRecords.length,
        timestamp: new Date().toISOString(),
      }
    );

    return NextResponse.json({
      success: true,
      message: `Successfully committed ${savedRecords.length} records into database.`,
      count: savedRecords.length,
    });
  } catch (error: any) {
    const { logger } = await import('@/shared/logger');
    logger.error('Import commit error', error, 'imports.commit.POST');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to commit import records' },
      { status: 500 }
    );
  }
}
