// Application: Workbook Builder
// Builds the authoritative Excel report (Full 34-Sheet Monthly or Single-Sheet Daily)
// Preserves exact formatting, layout, formulas, and visual hierarchy from excel/TEMPLATE.xlsx
// AGENTS.md Rule 2, 3, 17, 18 & AGENTS1.md Rule 4, 6

import ExcelJS from 'exceljs';
import { excelTemplateAdapter } from '@/infrastructure/excel/ExcelTemplateAdapter';
import { FormulaWriter } from './FormulaWriter';
import { TEMPLATE_TERRITORY_ROWS, TEMPLATE_TOTAL_ROW } from '../domain/ExportSpecification';
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

export interface TerritoryExportConfig {
  rowNumber: number;
  slNo: number;
  territoryName: string;
  regionName: string;
}

export interface BuildWorkbookOptions {
  dailyDataBySheet: Record<string, DailyExportRecord[]>;
  reportingDay: number;
  year: number;
  month: number;
  companyName?: string;
  divisionName?: string;
  wingName?: string;
  territories?: TerritoryExportConfig[];
  isDailyReportOnly?: boolean;
  targetRecords?: Record<string, any>;
}

export class WorkbookBuilder {
  /**
   * Builds the dynamic Excel workbook (34-sheet monthly report or single-day daily report)
   * Populates live database values and resets non-submitted days with clean 0s.
   */
  public async buildWorkbook(
    dailyDataBySheet: Record<string, DailyExportRecord[]>,
    reportingDay: number,
    options?: Partial<BuildWorkbookOptions>
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

    const year = options?.year || 2026;
    const month = options?.month || 10;
    const dateObj = new Date(year, month - 1, 1);
    const monthName = dateObj.toLocaleString('en-US', { month: 'long' });
    const companyDisplayName = options?.companyName || 'Afaz Tobacco Company';
    const divisionDisplayName = options?.divisionName || 'Ctg South';
    const wingDisplayName = options?.wingName || 'Chittagong';

    // Resolved territories list (maps to template rows 8-12 by default or custom configured)
    const territoryConfigs: TerritoryExportConfig[] = options?.territories && options.territories.length > 0
      ? options.territories
      : TEMPLATE_TERRITORY_ROWS;

    const startRow = territoryConfigs[0]?.rowNumber || 8;
    const endRow = territoryConfigs[territoryConfigs.length - 1]?.rowNumber || 12;
    const totalRow = endRow + 1;

    // 2. Populate and format daily sheets '1' to '31'
    for (let day = 1; day <= 31; day++) {
      const sheetName = String(day);
      const worksheet = workbook.getWorksheet(sheetName);
      if (!worksheet) continue;

      // Dynamic Header Binding
      worksheet.getCell('A1').value = `${companyDisplayName} .`;
      worksheet.getCell('A3').value = `Month:${monthName}-${year}`;
      
      const dayFormatted = String(day).padStart(2, '0');
      const monthFormatted = String(month).padStart(2, '0');
      worksheet.getCell('B5').value = `Date:${dayFormatted}.${monthFormatted}.${year}`;
      worksheet.getCell('G5').value = `                                          Division: ${divisionDisplayName}`;
      worksheet.getCell('U5').value = `Wing: ${wingDisplayName}`;

      const records = dailyDataBySheet[sheetName] || [];

      // Iterate through each territory
      territoryConfigs.forEach(({ rowNumber, territoryName, regionName, slNo }) => {
        // Territory and region labels
        worksheet.getCell(`A${rowNumber}`).value = slNo;
        worksheet.getCell(`B${rowNumber}`).value = regionName;
        worksheet.getCell(`C${rowNumber}`).value = territoryName;

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
        } else {
          // Clean 0s for days without submissions (avoids stale template demo data)
          ['D', 'E', 'F', 'G', 'H', 'I'].forEach((col) => {
            worksheet.getCell(`${col}${rowNumber}`).value = 0;
          });
          ['K', 'L', 'M', 'N', 'O', 'P'].forEach((col) => {
            worksheet.getCell(`${col}${rowNumber}`).value = 0;
          });
          ['R', 'S', 'T', 'U'].forEach((col) => {
            worksheet.getCell(`${col}${rowNumber}`).value = 0;
          });
          ['X', 'Y', 'Z', 'AA'].forEach((col) => {
            worksheet.getCell(`${col}${rowNumber}`).value = 0;
          });
          worksheet.getCell(`AD${rowNumber}`).value = 0;
          worksheet.getCell(`AE${rowNumber}`).value = '';
        }

        // Apply Native Formula for the territory row
        FormulaWriter.writeRowFormulas(worksheet, rowNumber);
      });

      // Write Regional Total formulas
      FormulaWriter.writeTotalRowFormulas(worksheet, totalRow, startRow, endRow);
      worksheet.getCell(`A${totalRow}`).value = `${territoryConfigs[0]?.regionName || 'Satkania'} Region Total`;
    }

    // 3. DAILY REPORT MODE: Extract only the requested single day
    if (options?.isDailyReportOnly) {
      const selectedDaySheetName = String(reportingDay);
      const targetSheet = workbook.getWorksheet(selectedDaySheetName) || workbook.getWorksheet('1');

      if (targetSheet) {
        // Collect all other sheets and remove them
        const sheetsToRemove = workbook.worksheets.filter((ws) => ws.id !== targetSheet.id);
        sheetsToRemove.forEach((ws) => workbook.removeWorksheet(ws.id));

        // Rename the daily sheet
        targetSheet.name = `Daily Report - Day ${reportingDay}`;
      }

      return await excelTemplateAdapter.writeToBuffer(workbook);
    }

    // 4. MONTHLY REPORT MODE: Process STD & ADS, Target., and Analysis sheets
    // 4.1 STD & ADS Sheet
    const stdSheet = workbook.getWorksheet('STD & ADS');
    if (stdSheet) {
      stdSheet.getCell('A1').value = `${companyDisplayName} .`;
      stdSheet.getCell('A3').value = `Month:${monthName}-${year}`;
      stdSheet.getCell('G5').value = `                                          Division: ${divisionDisplayName}`;
      stdSheet.getCell('U5').value = `Wing: ${wingDisplayName}`;

      territoryConfigs.forEach(({ rowNumber, territoryName, regionName, slNo }) => {
        stdSheet.getCell(`A${rowNumber}`).value = slNo;
        stdSheet.getCell(`B${rowNumber}`).value = regionName;
        stdSheet.getCell(`C${rowNumber}`).value = territoryName;

        // Calculate actual sum across all days for this territory
        const brandSalesSums: Record<string, number> = {
          wilson: 0, shahara: 0, express: 0, nexus: 0, sb: 0, sm: 0
        };
        let latestStock: DailyExportRecord | null = null;

        for (let d = 1; d <= 31; d++) {
          const dayRecords = dailyDataBySheet[String(d)] || [];
          const rec = dayRecords.find((r) => r.territoryName.toLowerCase() === territoryName.toLowerCase());
          if (rec) {
            brandSalesSums.wilson += rec.wilsonSales || 0;
            brandSalesSums.shahara += rec.shaharaSales || 0;
            brandSalesSums.express += rec.expressSales || 0;
            brandSalesSums.nexus += rec.nexusSales || 0;
            brandSalesSums.sb += rec.sbSales || 0;
            brandSalesSums.sm += rec.smSales || 0;
            latestStock = rec;
          }
        }

        // STD Sales
        stdSheet.getCell(`D${rowNumber}`).value = brandSalesSums.wilson;
        stdSheet.getCell(`E${rowNumber}`).value = brandSalesSums.shahara;
        stdSheet.getCell(`F${rowNumber}`).value = brandSalesSums.express;
        stdSheet.getCell(`G${rowNumber}`).value = brandSalesSums.nexus;
        stdSheet.getCell(`H${rowNumber}`).value = brandSalesSums.sb;
        stdSheet.getCell(`I${rowNumber}`).value = brandSalesSums.sm;
        stdSheet.getCell(`J${rowNumber}`).value = { formula: `SUM(D${rowNumber}:I${rowNumber})` };

        // ADS Calculation (J / 26 working days)
        stdSheet.getCell(`K${rowNumber}`).value = { formula: `J${rowNumber}/26` };

        // Closing Stock from latest active day
        stdSheet.getCell(`L${rowNumber}`).value = latestStock?.wilsonStock || 0;
        stdSheet.getCell(`M${rowNumber}`).value = latestStock?.shaharaStock || 0;
        stdSheet.getCell(`N${rowNumber}`).value = latestStock?.expressStock || 0;
        stdSheet.getCell(`O${rowNumber}`).value = latestStock?.nexusStock || 0;
        stdSheet.getCell(`P${rowNumber}`).value = latestStock?.sbStock || 0;
        stdSheet.getCell(`Q${rowNumber}`).value = latestStock?.smStock || 0;
        stdSheet.getCell(`R${rowNumber}`).value = { formula: `SUM(L${rowNumber}:Q${rowNumber})` };
      });

      // Total row formulas for STD & ADS
      FormulaWriter.writeTotalRowFormulas(stdSheet, totalRow, startRow, endRow);
      stdSheet.getCell(`A${totalRow}`).value = `${territoryConfigs[0]?.regionName || 'Satkania'} Region Total`;
    }

    // 4.2 Target. Sheet
    const targetSheet = workbook.getWorksheet('Target.');
    if (targetSheet) {
      targetSheet.getCell('A1').value = `${companyDisplayName} .`;
      targetSheet.getCell('A3').value = `Month:${monthName}-${year}`;
      targetSheet.getCell('G5').value = `                                          Division: ${divisionDisplayName}`;
      targetSheet.getCell('U5').value = `Wing: ${wingDisplayName}`;

      territoryConfigs.forEach(({ rowNumber, territoryName, regionName, slNo }) => {
        targetSheet.getCell(`A${rowNumber}`).value = slNo;
        targetSheet.getCell(`B${rowNumber}`).value = regionName;
        targetSheet.getCell(`C${rowNumber}`).value = territoryName;

        // If target records provided, populate
        const tRecord = options?.targetRecords?.[territoryName.toLowerCase()];
        if (tRecord) {
          targetSheet.getCell(`D${rowNumber}`).value = tRecord.wilson || 0;
          targetSheet.getCell(`E${rowNumber}`).value = tRecord.shahara || 0;
          targetSheet.getCell(`F${rowNumber}`).value = tRecord.express || 0;
          targetSheet.getCell(`G${rowNumber}`).value = tRecord.nexus || 0;
          targetSheet.getCell(`H${rowNumber}`).value = tRecord.sb || 0;
          targetSheet.getCell(`I${rowNumber}`).value = tRecord.sm || 0;
        }

        // Formulas
        targetSheet.getCell(`J${rowNumber}`).value = { formula: `SUM(D${rowNumber}:I${rowNumber})` };
        targetSheet.getCell(`K${rowNumber}`).value = { formula: `J${rowNumber}/26` };
      });

      FormulaWriter.writeTotalRowFormulas(targetSheet, totalRow, startRow, endRow);
    }

    // 4.3 Analysis Sheet
    const analysisSheet = workbook.getWorksheet('Analysis');
    if (analysisSheet) {
      analysisSheet.getCell('A1').value = { formula: "'1'!A1" };
      analysisSheet.getCell('A3').value = { formula: "'1'!A3" };
    }

    // 5. Return serialized buffer
    return await excelTemplateAdapter.writeToBuffer(workbook);
  }
}

export const workbookBuilder = new WorkbookBuilder();
