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
    const now = new Date();
    const year = parseInt(body.year || String(now.getFullYear()), 10);
    const month = parseInt(body.month || String(now.getMonth() + 1), 10);
    const day = parseInt(body.day || String(now.getDate()), 10);
    const companyId = user.role === 'SUPER_ADMIN' ? (body.companyId || null) : user.companyId;

    const { filename, buffer } = await ExcelExportService.generateMonthlyReport(
      year,
      month,
      day,
      user.id,
      companyId || undefined
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
