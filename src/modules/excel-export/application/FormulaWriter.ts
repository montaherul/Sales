// Application: Formula Writer for ExcelJS
// Writes native Excel formulas to prevent hardcoded static values

import ExcelJS from 'exceljs';
import { TEMPLATE_TERRITORY_ROWS, TEMPLATE_TOTAL_ROW } from '../domain/ExportSpecification';

export class FormulaWriter {
  /**
   * Injects daily row-level and regional sum formulas for a worksheet.
   */
  public static writeDailySheetFormulas(worksheet: ExcelJS.Worksheet): void {
    // 1. Territory rows (Row 8 to 12)
    TEMPLATE_TERRITORY_ROWS.forEach(({ rowNumber }) => {
      // J = Total Cigarette Sales =SUM(D{r}:I{r})
      worksheet.getCell(`J${rowNumber}`).value = { formula: `SUM(D${rowNumber}:I${rowNumber})` };

      // Q = Total Cigarette Stock =SUM(K{r}:P{r})
      worksheet.getCell(`Q${rowNumber}`).value = { formula: `SUM(K${rowNumber}:P${rowNumber})` };

      // W = Total Zarda Sales Value =S{r}*15+T{r}*6+U{r}*8
      worksheet.getCell(`W${rowNumber}`).value = {
        formula: `S${rowNumber}*15+T${rowNumber}*6+U${rowNumber}*8`,
      };

      // AC = Total Zarda Stock Value =Y{r}*15+Z{r}*6+AA{r}*8
      worksheet.getCell(`AC${rowNumber}`).value = {
        formula: `Y${rowNumber}*15+Z${rowNumber}*6+AA${rowNumber}*8`,
      };
    });

    // 2. Regional Total Row (Row 13)
    const colsToSum = [
      'D', 'E', 'F', 'G', 'H', 'I', 'J', // Cigarette Sales
      'K', 'L', 'M', 'N', 'O', 'P', 'Q', // Cigarette Stock
      'R', 'S', 'T', 'U', 'W',           // Zarda Sales
      'X', 'Y', 'Z', 'AA', 'AC',         // Zarda Stock
      'AD',                              // Empty Packets
    ];

    colsToSum.forEach((col) => {
      worksheet.getCell(`${col}${TEMPLATE_TOTAL_ROW}`).value = {
        formula: `SUM(${col}8:${col}12)`,
      };
    });
  }

  /**
   * Injects STD & ADS dynamic cross-sheet aggregation formulas.
   */
  public static writeSTDAndADSFormulas(worksheet: ExcelJS.Worksheet, activeDay: number): void {
    const endDay = Math.min(31, Math.max(1, activeDay));

    TEMPLATE_TERRITORY_ROWS.forEach(({ rowNumber }) => {
      // Dynamic 3D reference aggregation: SUM('1:endDay'!cell)
      // Excel syntax: =SUM('1:31'!D8)
      worksheet.getCell(`D${rowNumber}`).value = { formula: `SUM('1:${endDay}'!D${rowNumber})` };
      worksheet.getCell(`E${rowNumber}`).value = { formula: `SUM('1:${endDay}'!E${rowNumber})` };
      worksheet.getCell(`F${rowNumber}`).value = { formula: `SUM('1:${endDay}'!F${rowNumber})` };
      worksheet.getCell(`G${rowNumber}`).value = { formula: `SUM('1:${endDay}'!G${rowNumber})` };
      worksheet.getCell(`H${rowNumber}`).value = { formula: `SUM('1:${endDay}'!H${rowNumber})` };
      worksheet.getCell(`I${rowNumber}`).value = { formula: `SUM('1:${endDay}'!I${rowNumber})` };
      worksheet.getCell(`J${rowNumber}`).value = { formula: `SUM(D${rowNumber}:I${rowNumber})` };
    });
  }
}
