// Next.js Route Handler: /api/google-sheets/sync
// Thin presentation layer connecting requests to GoogleSheetsService

import { NextRequest, NextResponse } from 'next/server';
import { GoogleSheetsService } from '@/modules/google-sheets';
import { getAuthenticatedUser } from '@/shared/auth';
import { AppError } from '@/shared/errors';
import { logger } from '@/shared/logger';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const body = await request.json().catch(() => ({}));

    const year = Number(body.year) || new Date().getFullYear();
    const month = Number(body.month) || (new Date().getMonth() + 1);
    const day = Number(body.day) || new Date().getDate();

    const result = await GoogleSheetsService.syncReport({
      year,
      month,
      day,
      user,
      companyId: body.companyId,
      spreadsheetId: body.spreadsheetId,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    const status = error instanceof AppError ? error.statusCode : 500;
    logger.warn('Google Sheets sync request failed', 'GoogleSheetsSyncRoute', { error: error.message });
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to synchronize with Google Sheets' },
      { status }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    const history = await GoogleSheetsService.getHistory(user, companyId);

    return NextResponse.json({
      success: true,
      data: history,
    });
  } catch (error: any) {
    const status = error instanceof AppError ? error.statusCode : 500;
    logger.warn('Google Sheets history query failed', 'GoogleSheetsSyncRoute', { error: error.message });
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch Google Sheets sync history' },
      { status }
    );
  }
}
