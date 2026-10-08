// Infrastructure: Period Control Repository
// Database access for Years, Months, and Dates operational periods
// AGENTS1.md Rule 4 (Data-Access Layer)

import { dbQuery } from '@/shared/database/db';
import { 
  ReportingYear, 
  MonthlyPeriod, 
  DailyPeriodDate 
} from '../domain/PeriodSpecification';
import { MONTH_NAMES } from '@/shared/constants';

export class PeriodRepository {
  /**
   * Retrieves all reporting years with aggregated month and working day statistics.
   */
  public async getYears(companyId?: string | null): Promise<ReportingYear[]> {
    const sql = `
      SELECT 
        ry.id,
        ry.company_id,
        c.name as company_name,
        ry.year,
        ry.status,
        ry.is_locked,
        ry.notes,
        ry.created_at,
        ry.updated_at,
        COUNT(wd.id)::INT as total_months,
        COUNT(CASE WHEN wd.status = 'OPEN' THEN 1 END)::INT as open_months,
        COALESCE(SUM(wd.working_days), 0)::INT as total_working_days
      FROM reporting_years ry
      JOIN companies c ON ry.company_id = c.id
      LEFT JOIN working_days wd ON wd.company_id = ry.company_id AND wd.year = ry.year
      WHERE ($1::uuid IS NULL OR ry.company_id = $1)
      GROUP BY ry.id, ry.company_id, c.name, ry.year, ry.status, ry.is_locked, ry.notes, ry.created_at, ry.updated_at
      ORDER BY ry.year DESC;
    `;
    const res = await dbQuery(sql, [companyId || null]);
    return res.rows;
  }

  /**
   * Creates a single reporting year.
   */
  public async createYear(
    companyId: string, 
    year: number, 
    status: string = 'ACTIVE', 
    notes?: string
  ): Promise<ReportingYear> {
    const res = await dbQuery(
      `INSERT INTO reporting_years (company_id, year, status, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [companyId, year, status, notes || null]
    );
    return res.rows[0];
  }

  /**
   * Updates reporting year status or notes.
   */
  public async updateYear(
    id: string, 
    updates: { status?: string; is_locked?: boolean; notes?: string }
  ): Promise<ReportingYear> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [id];
    let paramIndex = 2;

    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      params.push(updates.status);
    }
    if (updates.is_locked !== undefined) {
      setClauses.push(`is_locked = $${paramIndex++}`);
      params.push(updates.is_locked);
    }
    if (updates.notes !== undefined) {
      setClauses.push(`notes = $${paramIndex++}`);
      params.push(updates.notes);
    }

    const res = await dbQuery(
      `UPDATE reporting_years SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return res.rows[0];
  }

  /**
   * Deletes a reporting year and associated periods.
   */
  public async deleteYear(id: string): Promise<void> {
    const yearRes = await dbQuery(`SELECT company_id, year FROM reporting_years WHERE id = $1`, [id]);
    if (yearRes.rows.length > 0) {
      const { company_id, year } = yearRes.rows[0];
      await dbQuery(`DELETE FROM reporting_dates WHERE company_id = $1 AND year = $2`, [company_id, year]);
      await dbQuery(`DELETE FROM working_days WHERE company_id = $1 AND year = $2`, [company_id, year]);
      await dbQuery(`DELETE FROM reporting_years WHERE id = $1`, [id]);
    }
  }

  /**
   * Retrieves all 12 monthly periods for a given year.
   */
  public async getMonths(year: number, companyId?: string | null): Promise<MonthlyPeriod[]> {
    const sql = `
      SELECT wd.id, wd.company_id, wd.year, wd.month, wd.working_days, wd.status, wd.is_locked, wd.notes
      FROM working_days wd
      WHERE wd.year = $1 AND ($2::uuid IS NULL OR wd.company_id = $2)
      ORDER BY wd.month ASC;
    `;
    const res = await dbQuery(sql, [year, companyId || null]);
    return res.rows.map((row: any) => ({
      ...row,
      month_name: MONTH_NAMES[(row.month || 1) - 1] || `Month ${row.month}`,
    }));
  }

  /**
   * Updates a monthly period (working days, open/closed status, notes).
   */
  public async updateMonth(
    id: string,
    updates: { working_days?: number; status?: string; is_locked?: boolean; notes?: string }
  ): Promise<MonthlyPeriod> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [id];
    let paramIndex = 2;

    if (updates.working_days !== undefined) {
      setClauses.push(`working_days = $${paramIndex++}`);
      params.push(updates.working_days);
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      params.push(updates.status);
    }
    if (updates.is_locked !== undefined) {
      setClauses.push(`is_locked = $${paramIndex++}`);
      params.push(updates.is_locked);
    }
    if (updates.notes !== undefined) {
      setClauses.push(`notes = $${paramIndex++}`);
      params.push(updates.notes);
    }

    const res = await dbQuery(
      `UPDATE working_days SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    const row = res.rows[0];
    return {
      ...row,
      month_name: MONTH_NAMES[(row.month || 1) - 1] || `Month ${row.month}`,
    };
  }

  /**
   * Retrieves daily period dates for a given month and year.
   */
  public async getDates(year: number, month: number, companyId?: string | null): Promise<DailyPeriodDate[]> {
    const sql = `
      SELECT rd.id, rd.company_id, TO_CHAR(rd.reporting_date, 'YYYY-MM-DD') as reporting_date,
             rd.year, rd.month, rd.day, rd.is_working_day, rd.is_locked, rd.status, rd.holiday_name
      FROM reporting_dates rd
      WHERE rd.year = $1 AND rd.month = $2 AND ($3::uuid IS NULL OR rd.company_id = $3)
      ORDER BY rd.day ASC;
    `;
    const res = await dbQuery(sql, [year, month, companyId || null]);
    return res.rows;
  }

  /**
   * Updates a daily period date (working day flag, status, holiday name).
   * Supports updating by record UUID or by (companyId, reporting_date).
   */
  public async updateDate(
    idOrDate: string | { id?: string; companyId?: string | null; date?: string },
    updates: { is_working_day?: boolean; is_locked?: boolean; status?: string; holiday_name?: string | null }
  ): Promise<DailyPeriodDate> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.is_working_day !== undefined) {
      setClauses.push(`is_working_day = $${paramIndex++}`);
      params.push(updates.is_working_day);
    }
    if (updates.is_locked !== undefined) {
      setClauses.push(`is_locked = $${paramIndex++}`);
      params.push(updates.is_locked);
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      params.push(updates.status);
    }
    if (updates.holiday_name !== undefined) {
      setClauses.push(`holiday_name = $${paramIndex++}`);
      params.push(updates.holiday_name);
    }

    let whereClause = '';
    if (typeof idOrDate === 'string') {
      whereClause = `WHERE id = $${paramIndex++}`;
      params.push(idOrDate);
    } else if (idOrDate.id) {
      whereClause = `WHERE id = $${paramIndex++}`;
      params.push(idOrDate.id);
    } else if (idOrDate.date) {
      whereClause = `WHERE (company_id = $${paramIndex++} OR company_id IS NULL) AND reporting_date = $${paramIndex++}::date`;
      params.push(idOrDate.companyId || null, idOrDate.date);
    } else {
      throw new Error('Either date ID or reporting date is required to update');
    }

    const res = await dbQuery(
      `UPDATE reporting_dates SET ${setClauses.join(', ')} ${whereClause} 
       RETURNING id, company_id, TO_CHAR(reporting_date, 'YYYY-MM-DD') as reporting_date,
                 year, month, day, is_working_day, is_locked, status, holiday_name`,
      params
    );
    return res.rows[0];
  }

  /**
   * Auto-provisions Year -> 12 Months -> All 365 Days via stored procedure.
   */
  public async autoCreatePeriod(
    companyId: string, 
    year: number, 
    defaultWorkingDays: number = 26
  ): Promise<any> {
    const res = await dbQuery(
      `SELECT sp_auto_create_reporting_period($1, $2, $3) as result;`,
      [companyId, year, defaultWorkingDays]
    );
    return res.rows[0]?.result;
  }

  /**
   * Verifies if a specific date's period is currently open for submissions.
   */
  public async checkPeriodStatus(
    companyId: string,
    dateStr: string
  ): Promise<{ isOpen: boolean; reason?: string }> {
    const [y, m, d] = dateStr.split('-').map(Number);

    // 1. Check Year status
    const yRes = await dbQuery(
      `SELECT status, is_locked FROM reporting_years 
       WHERE (company_id = $1 OR company_id IS NULL) AND year = $2 
       ORDER BY company_id NULLS LAST LIMIT 1`,
      [companyId, y]
    );
    if (yRes.rows.length > 0) {
      if (yRes.rows[0].status === 'CLOSED' || yRes.rows[0].is_locked) {
        return { isOpen: false, reason: `Fiscal Year ${y} is closed or locked.` };
      }
    }

    // 2. Check Month status
    const mRes = await dbQuery(
      `SELECT status, is_locked FROM working_days 
       WHERE (company_id = $1 OR company_id IS NULL) AND year = $2 AND month = $3 
       ORDER BY company_id NULLS LAST LIMIT 1`,
      [companyId, y, m]
    );
    if (mRes.rows.length > 0) {
      if (mRes.rows[0].status === 'CLOSED' || mRes.rows[0].is_locked) {
        const monthName = MONTH_NAMES[m - 1] || `Month ${m}`;
        return { isOpen: false, reason: `Reporting period for ${monthName} ${y} is closed or locked by Administrator.` };
      }
    }

    // 3. Check Day status
    const dRes = await dbQuery(
      `SELECT status, is_locked, holiday_name FROM reporting_dates 
       WHERE (company_id = $1 OR company_id IS NULL) AND reporting_date = $2 
       ORDER BY company_id NULLS LAST LIMIT 1`,
      [companyId, dateStr]
    );
    if (dRes.rows.length > 0) {
      if (dRes.rows[0].is_locked || dRes.rows[0].status === 'CLOSED') {
        return { isOpen: false, reason: `Date ${dateStr} is locked for submissions.` };
      }
    }

    return { isOpen: true };
  }
}

export const periodRepository = new PeriodRepository();
