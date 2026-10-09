// Tier 2 Presentation Controller: Multi-Date XLSX Import Route Handler
// Parses multiple daily sheets from a single workbook without touching single-date endpoints
// AGENTS1.md Rule 4, Rule 5, Rule 13, Rule 14, Rule 15

import { NextRequest, NextResponse } from 'next/server';
import { parseMultiDateXLSX } from '@/lib/excel/import';
import { getAuthenticatedUser } from '@/shared/auth';
import { logger } from '@/shared/logger';

export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const applicationYearMonth = (formData.get('applicationYearMonth') as string) || undefined;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No Excel file (.xlsx) was provided.' },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json(
        { success: false, error: 'Only valid .xlsx Excel workbooks are permitted.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    logger.info('Processing multi-date XLSX import request', 'imports.multi-date.POST', {
      actor: actor.email,
      fileName: file.name,
      fileSize: file.size,
      applicationYearMonth,
    });

    const parsedData = await parseMultiDateXLSX({
      buffer,
      fileName: file.name,
      applicationYearMonth,
    });

    return NextResponse.json({
      success: true,
      data: parsedData,
    });
  } catch (error: any) {
    logger.error('Multi-date import parsing error', error, 'imports.multi-date.POST');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to parse multi-date workbook' },
      { status: error.statusCode || 500 }
    );
  }
}
