// Application: Excel Import Service
// Orchestrates preview, 12-step validation, calculation engine recalculation, and commit

import ExcelJS from 'exceljs';
import { ImportValidationPipeline } from '../domain/ImportValidationPipeline';
import { importRepository, StagedImportRecord } from '../infrastructure/ImportRepository';
import { calculationEngine } from '@/modules/calculation';
import { SATKANIA_TERRITORIES } from '@/shared/constants';
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
    // 1. Date Safety Check
    ImportValidationPipeline.validateDateSafety({ filename, selectedDate });

    // 2. Parse workbook
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as any);

    const dayNum = parseInt(selectedDate.split('-')[2], 10);
    const sheetName = String(dayNum);

    // 3. Structure validation
    const structureVal = ImportValidationPipeline.validateWorkbookStructure(workbook, sheetName);
    if (!structureVal.isValid) {
      throw new ValidationError(`Sheet validation failed: ${structureVal.errors.join('; ')}`);
    }

    const sheet = workbook.getWorksheet(sheetName)!;

    // 4. Extract raw cells and recalculate totals via CalculationEngine
    const records: Array<any> = [];
    const territoryIds: string[] = [];

    SATKANIA_TERRITORIES.forEach((t) => {
      const row = t.rowOffset;
      const cigaretteSales = {
        wilson: parseFloat(sheet.getCell(`D${row}`).value as any || 0),
        shahara: parseFloat(sheet.getCell(`E${row}`).value as any || 0),
        express: parseFloat(sheet.getCell(`F${row}`).value as any || 0),
        nexus: parseFloat(sheet.getCell(`G${row}`).value as any || 0),
        sb: parseFloat(sheet.getCell(`H${row}`).value as any || 0),
        sm: parseFloat(sheet.getCell(`I${row}`).value as any || 0),
      };

      const cigaretteStock = {
        wilson: parseFloat(sheet.getCell(`K${row}`).value as any || 0),
        shahara: parseFloat(sheet.getCell(`L${row}`).value as any || 0),
        express: parseFloat(sheet.getCell(`M${row}`).value as any || 0),
        nexus: parseFloat(sheet.getCell(`N${row}`).value as any || 0),
        sb: parseFloat(sheet.getCell(`O${row}`).value as any || 0),
        sm: parseFloat(sheet.getCell(`P${row}`).value as any || 0),
      };

      const zardaSales = {
        slb: parseFloat(sheet.getCell(`R${row}`).value as any || 0),
        qty_22_25: parseInt(sheet.getCell(`S${row}`).value as any || 0, 10),
        qty_99_14: parseInt(sheet.getCell(`T${row}`).value as any || 0, 10),
        qty_33_15: parseInt(sheet.getCell(`U${row}`).value as any || 0, 10),
      };

      const zardaStock = {
        slb: parseFloat(sheet.getCell(`X${row}`).value as any || 0),
        qty_22_25: parseInt(sheet.getCell(`Y${row}`).value as any || 0, 10),
        qty_99_14: parseInt(sheet.getCell(`Z${row}`).value as any || 0, 10),
        qty_33_15: parseInt(sheet.getCell(`AA${row}`).value as any || 0, 10),
      };

      // Recalculate using centralized engine
      const calculated = calculationEngine.evaluateDailyRecord(
        cigaretteSales,
        cigaretteStock,
        zardaSales,
        zardaStock
      );

      records.push({
        territoryId: t.id,
        territoryName: t.name,
        cigaretteSales,
        cigaretteStock,
        zardaSales,
        zardaStock,
        totalSales: calculated.totalCigaretteSales,
        totalStock: calculated.totalCigaretteStock,
        totalZardaValue: calculated.totalZardaSalesValue,
        isDuplicate: false,
      });

      territoryIds.push(t.id);
    });

    // 5. Duplicate detection
    const duplicates = await importRepository.checkDuplicates(territoryIds, selectedDate);
    records.forEach((r) => {
      if (duplicates.includes(r.territoryId)) {
        r.isDuplicate = true;
      }
    });

    return {
      filename,
      reportingDate: selectedDate,
      totalRecords: records.length,
      duplicateTerritories: duplicates,
      records,
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
}
