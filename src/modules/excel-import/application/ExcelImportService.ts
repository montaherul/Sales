// Application: Excel Import Service
// Orchestrates preview, 12-step validation, calculation engine recalculation, and commit

import { importRepository, StagedImportRecord } from '../infrastructure/ImportRepository';
import { ValidationError } from '@/shared/errors';

export interface ImportPreviewResult {
  filename: string;
  reportingDate: string;
  totalRecords: number;
  duplicateTerritories: string[];
  records: Array<{
    territoryId: string;
    territoryName: string;
    totalSales: number;
    totalStock: number;
    totalZardaValue: number;
    isDuplicate: boolean;
  }>;
}

export class ExcelImportService {
  /**
   * Parses workbook and generates preview with validation.
   */
  public static async previewWorkbook(
    fileBuffer: Buffer,
    filename: string,
    selectedDate: string
  ): Promise<ImportPreviewResult> {
    const { parseAndValidateXLSX } = await import('@/lib/excel/import');
    const result = await parseAndValidateXLSX({
      buffer: fileBuffer,
      fileName: filename,
      applicationDate: selectedDate,
    });

    if (!result.isValid) {
      const errorMsg = result.errors
        .map((e) => `${e.sheet} [${e.column}${e.row}]: ${e.reason}`)
        .join('; ');
      throw new ValidationError(`Sheet validation failed: ${errorMsg}`);
    }

    return {
      filename,
      reportingDate: selectedDate,
      totalRecords: result.records.length,
      duplicateTerritories: result.duplicateTerritories,
      records: result.records.map((r) => ({
        territoryId: r.territoryId,
        territoryName: r.territoryName,
        totalSales: r.totalCigaretteSales,
        totalStock: r.totalCigaretteStock,
        totalZardaValue: r.totalZardaSalesValue,
        isDuplicate: result.duplicateTerritories.includes(r.territoryId),
      })),
    };
  }

  /**
   * Commits staged records into database inside atomic transaction.
   */
  public static async commitImport(
    stagedRecords: StagedImportRecord[],
    filename: string,
    userId: string = 'system'
  ): Promise<{ importedCount: number; batchId: string }> {
    return await importRepository.commitBatch(stagedRecords, filename, userId);
  }

  /**
   * Commits validated operational records with tenant scoping and audit trail.
   */
  public static async commitRecords(
    records: any[],
    fileName: string,
    actor: any,
    companyId?: string | null
  ): Promise<{ savedRecords: any[]; count: number }> {
    if (!records || !records.length) {
      throw new ValidationError('No records to commit');
    }

    const { SubmissionRepository } = await import('@/lib/repositories/submission.repository');
    const tenantCompanyId = actor.role !== 'SUPER_ADMIN' && actor.companyId ? actor.companyId : (companyId || null);

    const savedRecords: any[] = [];
    for (const rec of records) {
      if (tenantCompanyId && !rec.companyId) {
        rec.companyId = tenantCompanyId;
      }
      const saved = await SubmissionRepository.saveSubmission(
        rec,
        actor.id,
        `Imported from XLSX file: ${fileName || 'bulk import'}`
      );
      savedRecords.push(saved);
    }

    await SubmissionRepository.recordAuditLog(
      'IMPORT_COMMIT',
      actor.id,
      'daily_submissions',
      fileName || 'bulk-import',
      undefined,
      {
        fileName,
        importedCount: savedRecords.length,
        companyId: tenantCompanyId,
        timestamp: new Date().toISOString(),
      }
    );

    return { savedRecords, count: savedRecords.length };
  }
}
