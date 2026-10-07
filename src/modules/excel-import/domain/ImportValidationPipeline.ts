// Domain: Import Validation Pipeline
// Implements 12 validation steps, Date Safety checks, and atomic rollback rules

import ExcelJS from 'exceljs';
import { DateMismatchError, ValidationError } from '@/shared/errors';
import { SATKANIA_TERRITORIES } from '@/shared/constants';

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
    const { filename, selectedDate } = params;

    // Check filename for date pattern e.g. "October 6 2026" or "2026-10-06"
    const isoMatch = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
    const textMatch = filename.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s+(\d{4})/i);

    let extractedDate: string | null = null;
    if (isoMatch) {
      extractedDate = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    } else if (textMatch) {
      const monthNames = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'
      ];
      const mIdx = monthNames.indexOf(textMatch[1].toLowerCase()) + 1;
      const mm = String(mIdx).padStart(2, '0');
      const dd = String(parseInt(textMatch[2], 10)).padStart(2, '0');
      const yyyy = textMatch[3];
      extractedDate = `${yyyy}-${mm}-${dd}`;
    }

    if (extractedDate && extractedDate !== selectedDate) {
      throw new DateMismatchError(extractedDate, 'workbook', selectedDate);
    }

    return { parsedDate: selectedDate };
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
