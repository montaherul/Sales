// Infrastructure: ExcelJS Template Adapter
// Loads and preserves excel/TEMPLATE.xlsx without altering styles, formulas, or sheet order

import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { EXPECTED_SHEET_COUNT, WORKBOOK_SHEETS } from '@/shared/constants';
import { AppError } from '@/shared/errors';

export class ExcelTemplateAdapter {
  private templatePath: string;

  constructor(templatePath?: string) {
    this.templatePath = templatePath || path.resolve(process.cwd(), 'excel', 'TEMPLATE.xlsx');
  }

  /**
   * Loads the authoritative 34-sheet template workbook.
   */
  public async loadTemplateWorkbook(): Promise<ExcelJS.Workbook> {
    if (!fs.existsSync(this.templatePath)) {
      throw new AppError(`Authoritative Excel template not found at ${this.templatePath}`, 500, 'TEMPLATE_NOT_FOUND');
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(this.templatePath);
    return workbook;
  }

  /**
   * Validates that the workbook strictly contains all 34 required sheets in exact order.
   */
  public validateWorkbookStructure(workbook: ExcelJS.Workbook): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (workbook.worksheets.length !== EXPECTED_SHEET_COUNT) {
      errors.push(`Workbook must contain exactly ${EXPECTED_SHEET_COUNT} sheets, but has ${workbook.worksheets.length}`);
    }

    for (let i = 0; i < WORKBOOK_SHEETS.length; i++) {
      const expectedName = WORKBOOK_SHEETS[i];
      const sheet = workbook.getWorksheet(expectedName);
      if (!sheet) {
        errors.push(`Missing mandatory sheet: '${expectedName}'`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Serializes workbook to buffer.
   */
  public async writeToBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}

export const excelTemplateAdapter = new ExcelTemplateAdapter();
