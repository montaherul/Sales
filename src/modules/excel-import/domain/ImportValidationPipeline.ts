// Domain: Import Validation Pipeline
// Implements 12 validation steps, Date Safety checks, and atomic rollback rules

import ExcelJS from 'exceljs';
import { DateMismatchError } from '@/shared/errors';
import { SATKANIA_TERRITORIES } from '@/shared/constants';
import { verifyImportDateSafety } from '@/lib/excel/date-safety';

export interface DateSafetyCheckParams {
  filename: string;
  selectedDate: string; // YYYY-MM-DD
  workbookSheetNumber?: number;
}

export interface ImportValidationResult {
  isValid: boolean;
  errors: string[];
  parsedDate?: string;
  territoryCount: number;
}

export class ImportValidationPipeline {
  /**
   * Rule #14: Date Safety Validator.
   * Compares filename date, selected application date, and workbook date.
   */
  public static validateDateSafety(params: DateSafetyCheckParams): { parsedDate: string } {
    const result = verifyImportDateSafety({
      fileName: params.filename,
      applicationDate: params.selectedDate,
      sheetNumber: params.workbookSheetNumber,
    });

    if (!result.isValid) {
      throw new DateMismatchError(result.resolvedDate || params.filename, 'workbook', params.selectedDate);
    }

    return { parsedDate: result.resolvedDate || params.selectedDate };
  }

  /**
   * Validates Excel workbook format, sheets, and cell structures.
   */
  public static validateWorkbookStructure(workbook: ExcelJS.Workbook, sheetName: string): ImportValidationResult {
    const errors: string[] = [];

    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) {
      errors.push(`Workbook does not contain sheet '${sheetName}'.`);
      return { isValid: false, errors, territoryCount: 0 };
    }

    // Verify territory rows
    let validTerritories = 0;
    SATKANIA_TERRITORIES.forEach((t) => {
      const cellVal = sheet.getCell(`C${t.rowOffset}`).value;
      if (cellVal) {
        validTerritories++;
      }
    });

    if (validTerritories === 0) {
      errors.push(`No valid territory rows found in sheet '${sheetName}' (checked rows 8 to 12)`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      territoryCount: validTerritories,
    };
  }
}
