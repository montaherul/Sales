// Application: Excel Import Service
// Orchestrates preview, 12-step validation, multi-file server-side consolidation,
// calculation engine recalculation, scope authorization, and atomic commit

import { importRepository, StagedImportRecord } from '../infrastructure/ImportRepository';
import { ValidationError, ForbiddenError } from '@/shared/errors';
import { hasPermission, validateOrganizationalScope } from '@/shared/authorization';
import {
  calculateCigaretteSalesTotal,
  calculateCigaretteStockTotal,
  calculateZardaSalesValuation,
  calculateZardaStockValuation,
} from '@/lib/calculations/engine';
import { ImportPreviewPayload, parseAndValidateXLSX } from '@/lib/excel/import';
import { DailyOperationalRecord } from '@/lib/types';
import { SubmissionRepository } from '@/lib/repositories/submission.repository';

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

export interface UploadedFileStatusInfo {
  fileName: string;
  status: 'SUCCESS' | 'ERROR';
  matchedSheetName?: string;
  territoryCount?: number;
  totalSheetsFound?: number;
  error?: string;
  previewData?: ImportPreviewPayload;
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
   * Consolidates multiple successfully parsed workbook previews into a single unified preview.
   * Merges territory records, adds source file attribution, recalculates totals using
   * the server-side calculation engine, and detects duplicates against PostgreSQL.
   */
  public static async consolidatePreviews(
    fileResults: Array<{ fileName: string; preview: ImportPreviewPayload }>,
    targetDate: string,
    actor?: any,
    companyId?: string
  ): Promise<ImportPreviewPayload> {
    if (fileResults.length === 0) {
      throw new ValidationError('No valid workbooks available to consolidate');
    }

    if (fileResults.length === 1) {
      const single = fileResults[0];
      const recordsWithSources = single.preview.records.map((r) => ({
        ...r,
        sourceFiles: r.sourceFiles || [single.fileName],
      }));
      return {
        ...single.preview,
        records: recordsWithSources,
      };
    }

    // Consolidate data across all files for the selected date
    const territoryMap = new Map<
      string,
      {
        record: DailyOperationalRecord & { sourceFiles?: string[] };
        sources: string[];
      }
    >();

    for (const item of fileResults) {
      const payload = item.preview;
      for (const rec of payload.records) {
        const key = (rec.territoryId || rec.territoryName || '').trim().toLowerCase();
        if (!key) continue;

        if (!territoryMap.has(key)) {
          const copy: any = JSON.parse(JSON.stringify(rec));
          copy.sourceFiles = [item.fileName];
          territoryMap.set(key, {
            record: copy,
            sources: [item.fileName],
          });
        } else {
          const entry = territoryMap.get(key)!;
          if (!entry.sources.includes(item.fileName)) {
            entry.sources.push(item.fileName);
          }
          const r = entry.record as any;
          r.sourceFiles = entry.sources;

          // Merge Cigarette Sales
          for (const b of ['wilson', 'shahara', 'express', 'nexus', 'sb', 'sm'] as const) {
            const val1 = Number(r.cigaretteSales?.[b]) || 0;
            const val2 = Number(rec.cigaretteSales?.[b]) || 0;
            r.cigaretteSales[b] = Number((val1 + val2).toFixed(4));
          }
          r.totalCigaretteSales = calculateCigaretteSalesTotal(r.cigaretteSales);

          // Merge Cigarette Stock
          for (const b of ['wilson', 'shahara', 'express', 'nexus', 'sb', 'sm'] as const) {
            const val1 = Number(r.cigaretteStock?.[b]) || 0;
            const val2 = Number(rec.cigaretteStock?.[b]) || 0;
            r.cigaretteStock[b] = Number((val1 + val2).toFixed(4));
          }
          r.totalCigaretteStock = calculateCigaretteStockTotal(r.cigaretteStock);

          // Merge Zarda Sales
          for (const b of ['slb', 'qty_22_25', 'qty_99_14', 'qty_33_15'] as const) {
            const val1 = Number(r.zardaSales?.[b]) || 0;
            const val2 = Number(rec.zardaSales?.[b]) || 0;
            r.zardaSales[b] = val1 + val2;
          }
          r.totalZardaSalesValue = calculateZardaSalesValuation(r.zardaSales);

          // Merge Zarda Stock
          for (const b of ['slb', 'qty_22_25', 'qty_99_14', 'qty_33_15'] as const) {
            const val1 = Number(r.zardaStock?.[b]) || 0;
            const val2 = Number(rec.zardaStock?.[b]) || 0;
            r.zardaStock[b] = val1 + val2;
          }
          r.totalZardaStockValue = calculateZardaStockValuation(r.zardaStock);

          // Merge Empty Packets
          r.emptyPackets = (Number(r.emptyPackets) || 0) + (Number(rec.emptyPackets) || 0);

          // Merge Remarks
          if (rec.remarks && rec.remarks.trim()) {
            if (r.remarks && r.remarks.trim()) {
              r.remarks = `${r.remarks} | [${item.fileName}]: ${rec.remarks.trim()}`;
            } else {
              r.remarks = `[${item.fileName}]: ${rec.remarks.trim()}`;
            }
          }
        }
      }
    }

    const combinedRecords = Array.from(territoryMap.values()).map((v) => v.record);

    // Recalculate combined totals
    let totalCigaretteSales = 0;
    let totalCigaretteStock = 0;
    let totalZardaSalesValue = 0;
    let totalZardaStockValue = 0;
    let totalEmptyPackets = 0;

    for (const r of combinedRecords) {
      totalCigaretteSales += r.totalCigaretteSales;
      totalCigaretteStock += r.totalCigaretteStock;
      totalZardaSalesValue += r.totalZardaSalesValue;
      totalZardaStockValue += r.totalZardaStockValue;
      totalEmptyPackets += r.emptyPackets;
    }

    // Check duplicate territories against database (Rule 16)
    const existingSubmissions = await SubmissionRepository.getSubmissions({
      date: targetDate,
    });
    const existingTerritoryIds = new Set(existingSubmissions.map((s) => s.territoryId.toLowerCase()));
    const duplicateTerritories: string[] = [];
    let revisionRecordsCount = 0;

    for (const r of combinedRecords) {
      if (existingTerritoryIds.has(r.territoryId.toLowerCase())) {
        duplicateTerritories.push(r.territoryId);
        revisionRecordsCount++;
      }
    }

    const allErrors = fileResults.flatMap((s) => s.preview.errors || []);
    const allWarnings = fileResults.flatMap((s) => s.preview.warnings || []);
    const totalSheetsSum = fileResults.reduce(
      (acc, s) => acc + (s.preview.totalSheetsFound || 0),
      0
    );

    return {
      isValid: allErrors.length === 0,
      targetDate,
      matchedSheet: {
        name: `${fileResults.length} Workbooks Combined`,
        index: 0,
        matchMethod: 'SEARCHED_TAB_MATCH',
        headerDateText: targetDate,
        resolvedDate: targetDate,
      },
      availableSheets: fileResults[0]?.preview.availableSheets || [],
      summary: {
        totalRecords: combinedRecords.length,
        newRecordsCount: combinedRecords.length - revisionRecordsCount,
        revisionRecordsCount,
        totalCigaretteSales: Number(totalCigaretteSales.toFixed(2)),
        totalCigaretteStock: Number(totalCigaretteStock.toFixed(2)),
        totalZardaSalesValue,
        totalZardaStockValue,
        totalEmptyPackets,
      },
      dateVerification: {
        isValid: true,
        resolvedDate: targetDate,
        conflicts: [],
        warnings: allWarnings,
      },
      totalSheetsFound: totalSheetsSum,
      totalValidRecords: combinedRecords.length,
      duplicateTerritories,
      records: combinedRecords,
      errors: allErrors,
      warnings: allWarnings,
    };
  }

  /**
   * Processes single or multiple uploaded Excel files entirely on the server.
   * Parses, validates each file against date safety & structure, validates user scope,
   * consolidates records across workbooks, and returns the unified preview payload.
   */
  public static async processMultiFileUpload(params: {
    files: Array<{ buffer: Buffer; fileName: string }>;
    applicationDate?: string;
    sheetName?: string;
    actor?: any;
    companyId?: string;
  }): Promise<{
    fileStatuses: UploadedFileStatusInfo[];
    consolidatedPreview: ImportPreviewPayload | null;
  }> {
    if (!params.files || params.files.length === 0) {
      throw new ValidationError('No files provided for processing');
    }

    // Role permission check
    if (params.actor && !hasPermission(params.actor, 'reports.import')) {
      throw new ForbiddenError('Unauthorized: User does not possess the reports.import permission.');
    }

    const fileStatuses: UploadedFileStatusInfo[] = [];
    const successfulPreviews: Array<{ fileName: string; preview: ImportPreviewPayload }> = [];

    for (const f of params.files) {
      try {
        const preview = await parseAndValidateXLSX({
          buffer: f.buffer,
          fileName: f.fileName,
          applicationDate: params.applicationDate,
          sheetName: params.sheetName,
        });

        // Scope validation on extracted records (Rule 8)
        if (params.actor && params.actor.role !== 'SUPER_ADMIN') {
          for (const rec of preview.records) {
            try {
              validateOrganizationalScope(
                params.actor,
                rec.territoryId,
                rec.regionName,
                params.companyId || params.actor.companyId
              );
            } catch (scopeErr: any) {
              preview.errors.push({
                sheet: preview.matchedSheet.name,
                row: 0,
                column: 'C',
                field: 'territoryScope',
                invalidValue: rec.territoryName,
                expectedValue: params.actor.territoryId || 'Authorized territory',
                reason: scopeErr.message || 'Territory is outside authorized user scope',
              });
              preview.isValid = false;
            }
          }
        }

        if (preview.isValid) {
          fileStatuses.push({
            fileName: f.fileName,
            status: 'SUCCESS',
            matchedSheetName: preview.matchedSheet?.name || 'N/A',
            territoryCount: preview.records?.length || 0,
            totalSheetsFound: preview.totalSheetsFound || 0,
            previewData: preview,
          });
          successfulPreviews.push({ fileName: f.fileName, preview });
        } else {
          const firstErr = preview.errors[0]?.reason || 'File contains validation errors';
          fileStatuses.push({
            fileName: f.fileName,
            status: 'ERROR',
            matchedSheetName: preview.matchedSheet?.name,
            totalSheetsFound: preview.totalSheetsFound,
            error: firstErr,
            previewData: preview,
          });
        }
      } catch (err: any) {
        fileStatuses.push({
          fileName: f.fileName,
          status: 'ERROR',
          error: err.message || 'Error parsing workbook',
        });
      }
    }

    let consolidatedPreview: ImportPreviewPayload | null = null;
    if (successfulPreviews.length > 0) {
      const resolvedTargetDate =
        params.applicationDate || successfulPreviews[0].preview.targetDate;
      consolidatedPreview = await this.consolidatePreviews(
        successfulPreviews,
        resolvedTargetDate,
        params.actor,
        params.companyId
      );
    }

    return {
      fileStatuses,
      consolidatedPreview,
    };
  }

  /**
   * Commits validated operational records with strict server-side authorization,
   * organizational scope verification, value sanitization, and formula recalculation (Rule 15).
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

    if (actor && !hasPermission(actor, 'reports.import')) {
      throw new ForbiddenError('Unauthorized: User does not possess the reports.import permission.');
    }

    const tenantCompanyId =
      actor?.role !== 'SUPER_ADMIN' && actor?.companyId ? actor.companyId : companyId || null;

    const sanitizedRecords: DailyOperationalRecord[] = [];

    for (const rec of records) {
      if (tenantCompanyId && !rec.companyId) {
        rec.companyId = tenantCompanyId;
      }

      // 1. Server-side Organizational Scope Check (Rule 8 & Rule 25)
      if (actor) {
        validateOrganizationalScope(
          actor,
          rec.territoryId,
          rec.regionName || rec.regionId,
          rec.companyId
        );
      }

      // 2. Sanitize and validate raw inputs (Rule 13)
      const cigaretteSales = {
        wilson: Math.max(0, Number(rec.cigaretteSales?.wilson) || 0),
        shahara: Math.max(0, Number(rec.cigaretteSales?.shahara) || 0),
        express: Math.max(0, Number(rec.cigaretteSales?.express) || 0),
        nexus: Math.max(0, Number(rec.cigaretteSales?.nexus) || 0),
        sb: Math.max(0, Number(rec.cigaretteSales?.sb) || 0),
        sm: Math.max(0, Number(rec.cigaretteSales?.sm) || 0),
      };

      const cigaretteStock = {
        wilson: Math.max(0, Number(rec.cigaretteStock?.wilson) || 0),
        shahara: Math.max(0, Number(rec.cigaretteStock?.shahara) || 0),
        express: Math.max(0, Number(rec.cigaretteStock?.express) || 0),
        nexus: Math.max(0, Number(rec.cigaretteStock?.nexus) || 0),
        sb: Math.max(0, Number(rec.cigaretteStock?.sb) || 0),
        sm: Math.max(0, Number(rec.cigaretteStock?.sm) || 0),
      };

      const zardaSales = {
        slb: Math.max(0, Number(rec.zardaSales?.slb) || 0),
        qty_22_25: Math.max(0, Math.round(Number(rec.zardaSales?.qty_22_25) || 0)),
        qty_99_14: Math.max(0, Math.round(Number(rec.zardaSales?.qty_99_14) || 0)),
        qty_33_15: Math.max(0, Math.round(Number(rec.zardaSales?.qty_33_15) || 0)),
      };

      const zardaStock = {
        slb: Math.max(0, Number(rec.zardaStock?.slb) || 0),
        qty_22_25: Math.max(0, Math.round(Number(rec.zardaStock?.qty_22_25) || 0)),
        qty_99_14: Math.max(0, Math.round(Number(rec.zardaStock?.qty_99_14) || 0)),
        qty_33_15: Math.max(0, Math.round(Number(rec.zardaStock?.qty_33_15) || 0)),
      };

      const emptyPackets = Math.max(0, Math.round(Number(rec.emptyPackets) || 0));

      // 3. Server-side Formula Recalculation (Rule 15: Never trust client/Excel formulas)
      const totalCigaretteSales = calculateCigaretteSalesTotal(cigaretteSales);
      const totalCigaretteStock = calculateCigaretteStockTotal(cigaretteStock);
      const totalZardaSalesValue = calculateZardaSalesValuation(zardaSales);
      const totalZardaStockValue = calculateZardaStockValuation(zardaStock);

      sanitizedRecords.push({
        ...rec,
        cigaretteSales,
        cigaretteStock,
        zardaSales,
        zardaStock,
        emptyPackets,
        remarks: typeof rec.remarks === 'string' ? rec.remarks.trim() : '',
        totalCigaretteSales,
        totalCigaretteStock,
        totalZardaSalesValue,
        totalZardaStockValue,
      });
    }

    const userId = actor?.id || 'system';
    const savedRecords = await SubmissionRepository.saveSubmissionsBatch(
      sanitizedRecords,
      userId,
      `Imported from XLSX file: ${fileName || 'bulk import'}`
    );

    await SubmissionRepository.recordAuditLog(
      'IMPORT_COMMIT',
      userId,
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
