// Tier 2 Presentation Controller: Periods Route Handler (/api/periods)
// Handles Year -> Month -> Date queries, CRUD, auto-generation, and period status checks
// AGENTS1.md Rule 4 & Rule 5 (Presentation Layer / Thin Controllers)

import { NextRequest, NextResponse } from 'next/server';
import { PeriodService } from '@/modules/period-control';
import { getAuthenticatedUser } from '@/shared/auth';
import { logger } from '@/shared/logger';

export async function GET(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'years';
    const companyId = searchParams.get('companyId');
    const now = new Date();
    const year = parseInt(searchParams.get('year') || String(now.getFullYear()), 10);
    const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1), 10);
    const date = searchParams.get('date');

    if (type === 'check' && date) {
      const targetCompany = (actor.role !== 'SUPER_ADMIN' ? actor.companyId : companyId) || actor.companyId || '';
      const checkResult = await PeriodService.checkPeriodOpen(targetCompany, date);
      return NextResponse.json({ success: true, data: checkResult });
    }

    if (type === 'months') {
      const months = await PeriodService.getMonths(year, companyId, actor);
      return NextResponse.json({ success: true, data: months });
    }

    if (type === 'dates') {
      const dates = await PeriodService.getDates(year, month, companyId, actor);
      return NextResponse.json({ success: true, data: dates });
    }

    // Default: return years list
    const years = await PeriodService.getYears(companyId, actor);
    return NextResponse.json({ success: true, data: years });
  } catch (error: any) {
    logger.error('Error fetching periods', error, 'periods.GET');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch periods' },
      { status: error.statusCode || 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const body = await request.json();
    const action = body.action || 'create_year';

    if (action === 'auto_create') {
      const result = await PeriodService.autoCreatePeriod(
        body.companyId,
        parseInt(body.year, 10),
        body.defaultWorkingDays ? parseInt(body.defaultWorkingDays, 10) : 26,
        actor
      );
      return NextResponse.json({ success: true, data: result });
    }

    const yearRecord = await PeriodService.createYear(
      {
        companyId: body.companyId,
        year: parseInt(body.year, 10),
        status: body.status,
        notes: body.notes,
        autoGenerate: body.autoGenerate !== false,
      },
      actor
    );

    return NextResponse.json({ success: true, data: yearRecord }, { status: 201 });
  } catch (error: any) {
    logger.error('Error creating period', error, 'periods.POST');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create period' },
      { status: error.statusCode || 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const body = await request.json();
    const type = body.type || body.target || 'year';

    if (type === 'month') {
      const updatedMonth = await PeriodService.updateMonth(
        body.id,
        {
          working_days: (body.working_days !== undefined ? body.working_days : body.workingDays) !== undefined 
            ? parseInt(body.working_days ?? body.workingDays, 10) 
            : undefined,
          status: body.status,
          is_locked: body.is_locked !== undefined ? body.is_locked : body.isLocked,
          notes: body.notes,
        },
        actor
      );
      return NextResponse.json({ success: true, data: updatedMonth });
    }

    if (type === 'date') {
      const identifier = body.id 
        ? { id: body.id } 
        : { companyId: body.companyId, date: body.date || body.reporting_date };

      const updatedDate = await PeriodService.updateDate(
        identifier,
        {
          is_working_day: body.is_working_day !== undefined ? body.is_working_day : body.isWorkingDay,
          is_locked: body.is_locked !== undefined ? body.is_locked : body.isLocked,
          status: body.status,
          holiday_name: body.holiday_name !== undefined ? body.holiday_name : body.holidayName,
        },
        actor
      );
      return NextResponse.json({ success: true, data: updatedDate });
    }

    // Default: update year
    const updatedYear = await PeriodService.updateYear(
      body.id,
      {
        status: body.status,
        is_locked: body.is_locked,
        notes: body.notes,
      },
      actor
    );

    return NextResponse.json({ success: true, data: updatedYear });
  } catch (error: any) {
    logger.error('Error updating period', error, 'periods.PUT');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update period' },
      { status: error.statusCode || 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const actor = await getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Year ID is required' }, { status: 400 });
    }

    await PeriodService.deleteYear(id, actor);
    return NextResponse.json({ success: true, message: 'Reporting year deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting period', error, 'periods.DELETE');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete period' },
      { status: error.statusCode || 500 }
    );
  }
}
