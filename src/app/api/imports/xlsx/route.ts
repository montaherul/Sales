import { NextRequest, NextResponse } from 'next/server';
import { parseAndValidateXLSX } from '@/lib/excel/import';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const applicationDate = (formData.get('applicationDate') as string) || '';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No XLSX file provided' },
        { status: 400 }
      );
    }

    if (!applicationDate) {
      return NextResponse.json(
        { success: false, error: 'applicationDate parameter is required (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const preview = await parseAndValidateXLSX({
      buffer,
      fileName: file.name,
      applicationDate,
    });

    return NextResponse.json({
      success: true,
      data: preview,
    });
  } catch (error: any) {
    console.error('Import processing error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error parsing Excel workbook' },
      { status: 500 }
    );
  }
}
