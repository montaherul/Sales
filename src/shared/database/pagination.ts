// Tier 2 / Backend: Generic Server-Side Pagination, Filtering, Sorting & Export Helper
// Afaz Tobacco Sales & Stock Intelligence Platform

import { dbQuery } from '@/shared/database/db';
import { QueryResultRow } from 'pg';

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  searchFields?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
  exportFormat?: 'json' | 'csv';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export class PaginationHelper {
  /**
   * Executes a parameterized, SQL-injection safe query with server-side pagination, search, sorting, and counts.
   */
  public static async paginate<T extends QueryResultRow = any>(
    baseSelect: string,
    fromClause: string,
    options: PaginationOptions,
    defaultSortBy: string = 'created_at'
  ): Promise<PaginatedResult<T>> {
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.max(1, Math.min(100, options.pageSize || 10));
    const offset = (page - 1) * pageSize;

    const whereConditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // 1. Server-side Search
    if (options.search && options.searchFields && options.searchFields.length > 0) {
      const searchTerms = options.searchFields.map(
        (field) => `LOWER(CAST(${field} AS TEXT)) LIKE LOWER($${paramIndex})`
      );
      whereConditions.push(`(${searchTerms.join(' OR ')})`);
      params.push(`%${options.search.trim()}%`);
      paramIndex++;
    }

    // 2. Additional dynamic filters (e.g., company_id = $x, role = $y)
    if (options.filters) {
      for (const [key, value] of Object.entries(options.filters)) {
        if (value !== undefined && value !== null && value !== '' && value !== 'ALL') {
          whereConditions.push(`${key} = $${paramIndex}`);
          params.push(value);
          paramIndex++;
        }
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // 3. Count total records
    const countSql = `SELECT COUNT(*) as total ${fromClause} ${whereClause}`;
    const countResult = await dbQuery(countSql, params);
    const totalRecords = parseInt(countResult.rows[0]?.total || '0', 10);
    const totalPages = Math.ceil(totalRecords / pageSize);

    // 4. Sorting
    const safeSortBy = options.sortBy && /^[a-zA-Z0-9_.]+$/.test(options.sortBy) ? options.sortBy : defaultSortBy;
    const safeSortOrder = options.sortOrder?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const orderClause = `ORDER BY ${safeSortBy} ${safeSortOrder}`;

    // 5. Paginated Data Query
    const dataSql = `${baseSelect} ${fromClause} ${whereClause} ${orderClause} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    const dataParams = [...params, pageSize, offset];
    const dataResult = await dbQuery<T>(dataSql, dataParams);

    return {
      data: dataResult.rows,
      pagination: {
        page,
        pageSize,
        totalRecords,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Generates a CSV string from an array of objects for server-side export.
   */
  public static toCsv(rows: Record<string, any>[], columnHeaders?: Record<string, string>): string {
    if (!rows || rows.length === 0) return '';

    const keys = columnHeaders ? Object.keys(columnHeaders) : Object.keys(rows[0]);
    const headerRow = columnHeaders ? Object.values(columnHeaders).join(',') : keys.join(',');

    const dataRows = rows.map((row) =>
      keys
        .map((k) => {
          let val = row[k];
          if (val === null || val === undefined) val = '';
          val = String(val).replace(/"/g, '""');
          return `"${val}"`;
        })
        .join(',')
    );

    return [headerRow, ...dataRows].join('\n');
  }
}
