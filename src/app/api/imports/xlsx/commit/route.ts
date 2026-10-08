// Tier 2 Presentation Controller: Import Commit Route Handler
// Handles HTTP request/response, actor resolution, and delegates to ExcelImportService
// AGENTS1.md Rule 4 & Rule 5 (Presentation Layer / Thin Controllers)

import { NextRequest, NextResponse } from 'next/server';
import { ExcelImportService } from '@/modules/excel-import';
import { getAuthenticatedUser } from '@/shared/auth';
import { logger } from '@/shared/logger';

export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const body = await request.json();
    const records = body.records || [];
    const fileName = body.fileName || 'bulk-import';
    const companyId = body.companyId;

    const result = await ExcelImportService.commitRecords(records, fileName, actor, companyId);

    return NextResponse.json({
      success: true,
      message: `Successfully committed ${result.count} records into database.`,
      count: result.count,
    });
  } catch (error: any) {
    logger.error('Import commit error', error, 'imports.commit.POST');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to commit import records' },
      { status: error.statusCode || 500 }
    );
  }
}
