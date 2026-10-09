import { NextRequest, NextResponse } from 'next/server';
import { parseAndValidateXLSX } from '@/lib/excel/import';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const applicationDate = (formData.get('applicationDate') as string) || '';
    const sheetName = (formData.get('sheetName') as string) || '';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No XLSX file provided' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const preview = await parseAndValidateXLSX({
      buffer,
      fileName: file.name,
      applicationDate: applicationDate || undefined,
      sheetName: sheetName || undefined,
    });

    return NextResponse.json({
      success: true,
      data: preview,
    });
  } catch (error: any) {
    const { logger } = await import('@/shared/logger');
    logger.error('Import processing error', error, 'imports.xlsx.POST');
    return NextResponse.json(
      { success: false, error: error.message || 'Error parsing Excel workbook' },
      { status: 500 }
    );
  }
}
