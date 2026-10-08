// Infrastructure: Selective Daily Sales Repository
// Encapsulates complex daily operational persistence via authoritative SubmissionRepository
// Rules: AGENTS1.md Rule 11 (No Duplicate Abstractions) & Rule 4 (Separation of Responsibilities)

import { DailySalesEntry } from '../domain/DailySalesEntry';
import { SubmissionRepository } from '@/lib/repositories/submission.repository';
import { DailyOperationalRecord, SubmissionStatus } from '@/lib/types';
import { dbQuery } from '@/shared/database/db';
import { PaginationHelper, PaginatedResult } from '@/shared/database/pagination';
import { logger } from '@/shared/logger';

export interface SubmissionFilterOptions {
  page: number;
  pageSize: number;
  search?: string;
  date?: string | null;
  territoryId?: string | null;
  status?: string | null;
  companyId?: string | null;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class DailySalesRepository {
  /**
   * Queries paginated daily submissions via stored procedure.
   */
  public async getPaginatedSubmissions(options: SubmissionFilterOptions): Promise<PaginatedResult<any>> {
    const cleanSortBy = (options.sortBy || 's.reporting_date').replace(/^s\./, '');
    return await PaginationHelper.executeFunction(
      'sp_get_daily_submissions_paginated',
      [
        options.page,
        options.pageSize,
        options.search || null,
        options.date || null,
        options.territoryId || null,
        options.status || null,
        options.companyId || null,
        cleanSortBy,
        options.sortOrder || 'desc',
      ]
    );
  }

  /**
   * Upserts a daily submission with its associated sales, stock, and zarda records.
   */
  public async upsertSubmission(entry: DailySalesEntry, userId: string = 'system'): Promise<string> {
    try {
      const emptyPacketsTotal = typeof entry.emptyPackets === 'number' 
        ? entry.emptyPackets 
        : Object.values(entry.emptyPackets || {}).reduce((a: number, b: any) => a + (Number(b) || 0), 0);

      const record: DailyOperationalRecord = {
        territoryId: entry.territoryId,
        territoryName: '',
        regionName: '',
        reportDate: entry.reportingDate,
        dayNumber: new Date(entry.reportingDate).getDate() || 1,
        status: (entry.status as any) || 'DRAFT',
        cigaretteSales: entry.cigaretteSales,
        cigaretteStock: entry.cigaretteStock,
        zardaSales: entry.zardaSales,
        zardaStock: entry.zardaStock,
        emptyPackets: emptyPacketsTotal,
        remarks: entry.remarks,
        totalCigaretteSales: 0,
        totalCigaretteStock: 0,
        totalZardaSalesValue: 0,
        totalZardaStockValue: 0,
      };

      const saved = await SubmissionRepository.saveSubmission(record, userId);
      return saved.id || entry.territoryId;
    } catch (err) {
      logger.error('Failed to upsert submission through repository', err, 'DailySalesRepository');
      throw err;
    }
  }

  /**
   * Saves raw operational record using SubmissionRepository.
   */
  public async saveOperationalRecord(record: DailyOperationalRecord, userId: string, changeReason?: string): Promise<any> {
    return await SubmissionRepository.saveSubmission(record, userId, changeReason);
  }

  /**
   * Transitions workflow status.
   */
  public async transitionWorkflow(params: {
    territoryId: string;
    reportDate: string;
    toStatus: SubmissionStatus;
    userId: string;
    comments?: string;
    unlockReason?: string;
  }): Promise<any> {
    return await SubmissionRepository.transitionStatus(params);
  }

  /**
   * Retrieves submissions for given date.
   */
  public async getByDate(reportingDate: string): Promise<any[]> {
    try {
      return await SubmissionRepository.getSubmissions({ date: reportingDate });
    } catch (err) {
      logger.warn('Failed to query submissions by date', 'DailySalesRepository', { err });
      return [];
    }
  }

  /**
   * Retrieves submissions for given date and territory.
   */
  public async getByDateAndTerritory(date: string, territoryId: string): Promise<any[]> {
    return await SubmissionRepository.getSubmissions({ date, territoryId });
  }

  /**
   * Checks company ID and locked/finalized status of submissions for deletion authorization.
   */
  public async getSubmissionsForDeletionCheck(ids: string[]): Promise<Array<{ id: string; company_id: string | null; status: string; is_locked: boolean }>> {
    const res = await dbQuery(
      `SELECT id, company_id, status, is_locked FROM daily_submissions WHERE id = ANY($1::uuid[])`,
      [ids]
    );
    return res.rows;
  }

  /**
   * Deletes daily submissions by ID.
   */
  public async deleteSubmissions(ids: string[]): Promise<void> {
    await dbQuery(`DELETE FROM daily_submissions WHERE id = ANY($1::uuid[])`, [ids]);
  }

  /**
   * Resolves company ID for territory.
   */
  public async resolveTerritoryCompany(territoryId: string): Promise<string | null> {
    const res = await dbQuery(
      `SELECT d.company_id 
       FROM territories t 
       JOIN regions r ON t.region_id = r.id 
       JOIN wings w ON r.wing_id = w.id 
       JOIN divisions d ON w.division_id = d.id 
       WHERE t.id = $1 LIMIT 1`,
      [territoryId]
    );
    return res.rows[0]?.company_id || null;
  }
}

export const dailySalesRepository = new DailySalesRepository();
