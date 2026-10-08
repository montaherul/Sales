// Tier 2 Presentation Controller: Google Drive Upload Route Handler
// Handles HTTP request/response, actor resolution, and delegates to GoogleDriveService
// AGENTS1.md Rule 4 & Rule 5 (Presentation Layer / Thin Controllers)

import { NextRequest, NextResponse } from 'next/server';
import { GoogleDriveService } from '@/modules/google-drive';
import { getAuthenticatedUser } from '@/shared/auth';
import { logger } from '@/shared/logger';

export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const body = await request.json().catch(() => ({}));

    const year = Number(body.year) || 2026;
    const month = Number(body.month) || 10;
    const day = Number(body.day) || 6;

    const result = await GoogleDriveService.archiveReport({
      year,
      month,
      day,
      user: actor,
    });

    return NextResponse.json({
      success: true,
      data: {
        fileId: result.fileId,
        fileName: result.fileName,
        folderPath: result.folderPath,
        sha256: result.checksum,
        webViewLink: result.webUrl,
      },
    });
  } catch (error: any) {
    logger.error('Drive upload error', error, 'GoogleDriveUploadController.POST');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to archive report to Google Drive' },
      { status: error.statusCode || 500 }
    );
  }
}
