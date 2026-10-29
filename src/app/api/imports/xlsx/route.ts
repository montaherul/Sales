// Tier 2 Presentation Controller: Single & Multi-File XLSX Import Route Handler
// Enforces server-side authentication, permission checks, and multi-file consolidation
// AGENTS1.md Rule 4, 5, 13, 14, 15, 25

import { NextRequest, NextResponse } from 'next/server';
import { ExcelImportService } from '@/modules/excel-import';
import { getAuthenticatedUser } from '@/shared/auth';
import { hasPermission } from '@/shared/authorization';
import { logger } from '@/shared/logger';

export async function POST(request: NextRequest) {
  try {
    // 1. Server-side Authentication & Authorization (Rule 6, 7, 25)
    const actor = await getAuthenticatedUser(request);
    if (!hasPermission(actor, 'reports.import')) {
      logger.warn('Unauthorized import attempt blocked', 'imports.xlsx.POST', {
        userId: actor.id,
        email: actor.email,
        role: actor.role,
      });
      return NextResponse.json(
        { success: false, error: 'Unauthorized: User lacks reports.import permission.' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const applicationDate = (formData.get('applicationDate') as string) || '';
    const sheetName = (formData.get('sheetName') as string) || '';
    const companyId = (formData.get('companyId') as string) || undefined;

    // Collect all uploaded files (supports 'files' array or 'file' single/multiple)
    const filesList: File[] = [];
    const filesFromArray = formData.getAll('files') as File[];
    const filesFromSingle = formData.getAll('file') as File[];

    for (const f of [...filesFromArray, ...filesFromSingle]) {
      if (f && typeof f === 'object' && f.name) {
        filesList.push(f);
      }
    }

    if (filesList.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No XLSX file(s) provided in request' },
        { status: 400 }
      );
    }

    // Verify .xlsx extension on all files
    for (const f of filesList) {
      if (!f.name.toLowerCase().endsWith('.xlsx')) {
        return NextResponse.json(
          { success: false, error: `Invalid file format for '${f.name}'. Only valid .xlsx Excel workbooks are permitted.` },
          { status: 400 }
        );
      }
    }

    // Read buffers
    const preparedFiles: Array<{ buffer: Buffer; fileName: string }> = [];
    for (const f of filesList) {
      const arrayBuffer = await f.arrayBuffer();
      preparedFiles.push({
        buffer: Buffer.from(arrayBuffer),
        fileName: f.name,
      });
    }

    logger.info('Processing server-side Excel import', 'imports.xlsx.POST', {
      actor: actor.email,
      role: actor.role,
      fileCount: preparedFiles.length,
      fileNames: preparedFiles.map((p) => p.fileName).join(', '),
      applicationDate,
      sheetName,
    });

    // 2. Delegate to Application Service Layer
    const result = await ExcelImportService.processMultiFileUpload({
      files: preparedFiles,
      applicationDate: applicationDate || undefined,
      sheetName: sheetName || undefined,
      actor,
      companyId,
    });

    if (!result.consolidatedPreview && result.fileStatuses.every((s) => s.status === 'ERROR')) {
      const firstError = result.fileStatuses[0]?.error || 'Failed to parse uploaded workbooks';
      return NextResponse.json(
        {
          success: false,
          error: firstError,
          fileStatuses: result.fileStatuses,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.consolidatedPreview,
      fileStatuses: result.fileStatuses,
    });
  } catch (error: any) {
    logger.error('Import processing error', error, 'imports.xlsx.POST');
    return NextResponse.json(
      { success: false, error: error.message || 'Error parsing Excel workbook' },
      { status: error.statusCode || 500 }
    );
  }
}
