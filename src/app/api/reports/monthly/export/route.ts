// Next.js Route Handler: /api/reports/monthly/export
// User clicks "Export Monthly XLSX" -> Server-side export service -> Authoritative 34-sheet workbook

import { NextRequest, NextResponse } from 'next/server';
import { ExcelExportService } from '@/modules/excel-export';
import { getAuthenticatedUser } from '@/shared/auth';
import { hasPermission } from '@/shared/authorization';
import { ForbiddenError } from '@/shared/errors';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!hasPermission(user, 'reports.export')) {
      throw new ForbiddenError('User does not have reports.export permission');
    }

    const body = await request.json().catch(() => ({}));
    const year = parseInt(body.year || '2026', 10);
    const month = parseInt(body.month || '10', 10);
    const day = parseInt(body.day || '6', 10);

    const { filename, buffer } = await ExcelExportService.generateMonthlyReport(
      year,
      month,
      day,
      user.id
    );

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Export failed' },
      { status: error.statusCode || 500 }
    );
  }
}
