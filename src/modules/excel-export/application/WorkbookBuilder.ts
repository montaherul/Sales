// Application: Workbook Builder
// Builds the authoritative 34-sheet report using ExcelJS template adapter

import { excelTemplateAdapter } from '@/infrastructure/excel/ExcelTemplateAdapter';
import { FormulaWriter } from './FormulaWriter';
import { TEMPLATE_TERRITORY_ROWS } from '../domain/ExportSpecification';
import { AppError } from '@/shared/errors';

export interface DailyExportRecord {
  territoryName: string;
  wilsonSales: number;
  shaharaSales: number;
  expressSales: number;
  nexusSales: number;
  sbSales: number;
  smSales: number;
  wilsonStock: number;
  shaharaStock: number;
  expressStock: number;
  nexusStock: number;
  sbStock: number;
  smStock: number;
  zardaSlbSales: number;
  zarda22_25Sales: number;
  zarda99_14Sales: number;
  zarda33_15Sales: number;
  zardaSlbStock: number;
  zarda22_25Stock: number;
  zarda99_14Stock: number;
  zarda33_15Stock: number;
  emptyPackets: number;
  remarks: string;
}

export class WorkbookBuilder {
  /**
   * Generates the 34-sheet workbook filled with monthly data.
   */
  public async buildWorkbook(
    dailyDataBySheet: Record<string, DailyExportRecord[]>,
    reportingDay: number
  ): Promise<Buffer> {
    const workbook = await excelTemplateAdapter.loadTemplateWorkbook();

    // 1. Validate template structure
    const validation = excelTemplateAdapter.validateWorkbookStructure(workbook);
    if (!validation.isValid) {
      throw new AppError(
        `Template structure validation failed: ${validation.errors.join('; ')}`,
        500,
        'INVALID_TEMPLATE'
      );
    }

    // 2. Populate daily sheets '1' to '31'
    for (let day = 1; day <= 31; day++) {
      const sheetName = String(day);
      const worksheet = workbook.getWorksheet(sheetName);
      if (!worksheet) continue;

      const records = dailyDataBySheet[sheetName] || [];

      TEMPLATE_TERRITORY_ROWS.forEach(({ rowNumber, territoryName }) => {
        const rowData = records.find(
          (r) => r.territoryName.toLowerCase() === territoryName.toLowerCase()
        );

        if (rowData) {
          // Cigarette Sales
          worksheet.getCell(`D${rowNumber}`).value = rowData.wilsonSales || 0;
          worksheet.getCell(`E${rowNumber}`).value = rowData.shaharaSales || 0;
          worksheet.getCell(`F${rowNumber}`).value = rowData.expressSales || 0;
          worksheet.getCell(`G${rowNumber}`).value = rowData.nexusSales || 0;
          worksheet.getCell(`H${rowNumber}`).value = rowData.sbSales || 0;
          worksheet.getCell(`I${rowNumber}`).value = rowData.smSales || 0;

          // Cigarette Stock
          worksheet.getCell(`K${rowNumber}`).value = rowData.wilsonStock || 0;
          worksheet.getCell(`L${rowNumber}`).value = rowData.shaharaStock || 0;
          worksheet.getCell(`M${rowNumber}`).value = rowData.expressStock || 0;
          worksheet.getCell(`N${rowNumber}`).value = rowData.nexusStock || 0;
          worksheet.getCell(`O${rowNumber}`).value = rowData.sbStock || 0;
          worksheet.getCell(`P${rowNumber}`).value = rowData.smStock || 0;

          // Zarda Sales
          worksheet.getCell(`R${rowNumber}`).value = rowData.zardaSlbSales || 0;
          worksheet.getCell(`S${rowNumber}`).value = rowData.zarda22_25Sales || 0;
          worksheet.getCell(`T${rowNumber}`).value = rowData.zarda99_14Sales || 0;
          worksheet.getCell(`U${rowNumber}`).value = rowData.zarda33_15Sales || 0;

          // Zarda Stock
          worksheet.getCell(`X${rowNumber}`).value = rowData.zardaSlbStock || 0;
          worksheet.getCell(`Y${rowNumber}`).value = rowData.zarda22_25Stock || 0;
          worksheet.getCell(`Z${rowNumber}`).value = rowData.zarda99_14Stock || 0;
          worksheet.getCell(`AA${rowNumber}`).value = rowData.zarda33_15Stock || 0;

          // Operational
          worksheet.getCell(`AD${rowNumber}`).value = rowData.emptyPackets || 0;
          worksheet.getCell(`AE${rowNumber}`).value = rowData.remarks || '';
        }
      });

      // Write native Excel formulas for the daily sheet
      FormulaWriter.writeDailySheetFormulas(worksheet);
    }

    // 3. Process STD & ADS sheet
    const stdSheet = workbook.getWorksheet('STD & ADS');
    if (stdSheet) {
      FormulaWriter.writeSTDAndADSFormulas(stdSheet, reportingDay);
      FormulaWriter.writeDailySheetFormulas(stdSheet);
    }

    // 4. Return serialized buffer
    return await excelTemplateAdapter.writeToBuffer(workbook);
  }
}

export const workbookBuilder = new WorkbookBuilder();
