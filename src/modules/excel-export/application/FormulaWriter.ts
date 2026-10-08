// Application: Formula Writer for ExcelJS
// Writes native Excel formulas to prevent hardcoded static values

import ExcelJS from 'exceljs';
import { TEMPLATE_TERRITORY_ROWS, TEMPLATE_TOTAL_ROW } from '../domain/ExportSpecification';

export class FormulaWriter {
  /**
   * Writes native formulas for a single territory data row.
   */
  public static writeRowFormulas(worksheet: ExcelJS.Worksheet, rowNumber: number): void {
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
  }

  /**
   * Writes native formulas for a regional or grand total row across given row range.
   */
  public static writeTotalRowFormulas(
    worksheet: ExcelJS.Worksheet,
    totalRow: number,
    startRow: number,
    endRow: number
  ): void {
    const colsToSum = [
      'D', 'E', 'F', 'G', 'H', 'I', 'J', // Cigarette Sales
      'K', 'L', 'M', 'N', 'O', 'P', 'Q', // Cigarette Stock
      'R', 'S', 'T', 'U', 'W',           // Zarda Sales
      'X', 'Y', 'Z', 'AA', 'AC',         // Zarda Stock
      'AD',                              // Empty Packets
    ];

    colsToSum.forEach((col) => {
      worksheet.getCell(`${col}${totalRow}`).value = {
        formula: `SUM(${col}${startRow}:${col}${endRow})`,
      };
    });
  }

  /**
   * Injects daily row-level and regional sum formulas for a worksheet.
   */
  public static writeDailySheetFormulas(worksheet: ExcelJS.Worksheet, startRow: number = 8, endRow: number = 12, totalRow: number = 13): void {
    for (let r = startRow; r <= endRow; r++) {
      this.writeRowFormulas(worksheet, r);
    }
    this.writeTotalRowFormulas(worksheet, totalRow, startRow, endRow);
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
