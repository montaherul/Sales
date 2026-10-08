// Infrastructure: Selective Daily Sales Repository
// Encapsulates complex daily operational persistence via authoritative SubmissionRepository
// Rules: AGENTS1.md Rule 11 (No Duplicate Abstractions) & Rule 4 (Separation of Responsibilities)

import { DailySalesEntry } from '../domain/DailySalesEntry';
import { SubmissionRepository } from '@/lib/repositories/submission.repository';
import { DailyOperationalRecord } from '@/lib/types';
import { logger } from '@/shared/logger';

export class DailySalesRepository {
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
}

export const dailySalesRepository = new DailySalesRepository();
