// Infrastructure: Company Repository
// Data-Access layer handling PostgreSQL queries and stored procedures for tenants
// AGENTS1.md Rule 4 & Rule 8 (Data Access Layer)

import { dbQuery } from '@/shared/database/db';
import { PaginationHelper, PaginatedResult } from '@/shared/database/pagination';

export interface CompanyFilterOptions {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateCompanyData {
  id: string;
  name: string;
  code: string;
  status: string;
  plan: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  currency: string;
  timezone: string;
}

export interface UpdateCompanyData {
  id: string;
  name?: string;
  code?: string;
  status?: string;
  plan?: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  currency?: string;
  timezone?: string;
}

export class CompanyRepository {
  /**
   * Queries paginated companies using stored procedure sp_get_companies_paginated.
   */
  public async getPaginatedCompanies(options: CompanyFilterOptions): Promise<PaginatedResult<any>> {
    const cleanSortBy = (options.sortBy || 'created_at').replace(/^c\./, '');
    return await PaginationHelper.executeFunction(
      'sp_get_companies_paginated',
      [
        options.page,
        options.pageSize,
        options.search || null,
        cleanSortBy,
        options.sortOrder || 'desc',
      ]
    );
  }

  /**
   * Retrieves company by ID.
   */
  public async getCompanyById(id: string): Promise<any | null> {
    const res = await dbQuery(
      `SELECT id, name, code, status, plan, contact_email, contact_phone, address, currency, timezone, created_at
       FROM companies WHERE id = $1 LIMIT 1`,
      [id]
    );
    return res.rows[0] || null;
  }

  /**
   * Retrieves company by code.
   */
  public async getCompanyByCode(code: string): Promise<any | null> {
    const res = await dbQuery(
      `SELECT id, name, code FROM companies WHERE code = $1 LIMIT 1`,
      [code.toUpperCase().trim()]
    );
    return res.rows[0] || null;
  }

  /**
   * Inserts new company into PostgreSQL.
   */
  public async createCompany(data: CreateCompanyData): Promise<any> {
    const res = await dbQuery(
      `INSERT INTO companies (
        id, name, code, status, plan, contact_email, contact_phone, address, currency, timezone
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        data.id,
        data.name.trim(),
        data.code.toUpperCase().trim(),
        data.status,
        data.plan,
        data.contactEmail || null,
        data.contactPhone || null,
        data.address || null,
        data.currency,
        data.timezone,
      ]
    );
    return res.rows[0];
  }

  /**
   * Updates company record.
   */
  public async updateCompany(data: UpdateCompanyData): Promise<any> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [data.id];

    if (data.name !== undefined) {
      params.push(data.name.trim());
      setClauses.push(`name = $${params.length}`);
    }
    if (data.code !== undefined) {
      params.push(data.code.toUpperCase().trim());
      setClauses.push(`code = $${params.length}`);
    }
    if (data.status !== undefined) {
      params.push(data.status);
      setClauses.push(`status = $${params.length}`);
    }
    if (data.plan !== undefined) {
      params.push(data.plan);
      setClauses.push(`plan = $${params.length}`);
    }
    if (data.contactEmail !== undefined) {
      params.push(data.contactEmail || null);
      setClauses.push(`contact_email = $${params.length}`);
    }
    if (data.contactPhone !== undefined) {
      params.push(data.contactPhone || null);
      setClauses.push(`contact_phone = $${params.length}`);
    }
    if (data.address !== undefined) {
      params.push(data.address || null);
      setClauses.push(`address = $${params.length}`);
    }
    if (data.currency !== undefined) {
      params.push(data.currency);
      setClauses.push(`currency = $${params.length}`);
    }
    if (data.timezone !== undefined) {
      params.push(data.timezone);
      setClauses.push(`timezone = $${params.length}`);
    }

    const res = await dbQuery(
      `UPDATE companies SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return res.rows[0];
  }

  /**
   * Deletes companies by ID array.
   */
  public async deleteCompanies(ids: string[]): Promise<void> {
    await dbQuery(`DELETE FROM companies WHERE id = ANY($1::uuid[])`, [ids]);
  }

  /**
   * Retrieves SaaS platform aggregate stats via stored procedure.
   */
  public async getPlatformStats(): Promise<any> {
    const result = await dbQuery('SELECT sp_get_platform_stats() as stats;');
    return result.rows[0]?.stats || {};
  }
}

export const companyRepository = new CompanyRepository();
