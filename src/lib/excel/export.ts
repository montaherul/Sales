// Authoritative 34-Sheet Excel Generator using ExcelJS
// Preserves every sheet, formula, style, and merged cell from excel/TEMPLATE.xlsx

import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { 
  MonthlyWorkbookData, 
  DailyOperationalRecord 
} from '../types';
import { 
  WORKBOOK_SHEETS, 
  EXPECTED_SHEET_COUNT, 
  SATKANIA_TERRITORIES, 
  SATKANIA_TOTAL_ROW 
} from './template-mapping';

export interface ExportValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates the generated workbook before delivery.
 */
export function validateExportedWorkbook(workbook: ExcelJS.Workbook): ExportValidationResult {
  const errors: string[] = [];

  if (workbook.worksheets.length !== EXPECTED_SHEET_COUNT) {
    errors.push(`Workbook must contain exactly ${EXPECTED_SHEET_COUNT} sheets, but found ${workbook.worksheets.length}.`);
  }

  for (let i = 0; i < WORKBOOK_SHEETS.length; i++) {
    const expectedName = WORKBOOK_SHEETS[i];
    const sheet = workbook.getWorksheet(expectedName);
    if (!sheet) {
      errors.push(`Missing required sheet: '${expectedName}'.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Generates the authoritative 34-sheet Excel report.
 */
export async function generate34SheetMonthlyReport(data: MonthlyWorkbookData): Promise<Buffer> {
  const templatePath = path.resolve(process.cwd(), 'excel', 'TEMPLATE.xlsx');
  
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Authoritative template not found at ${templatePath}`);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);

  // 1. Process Daily Sheets ('1' through '31')
  for (let day = 1; day <= 31; day++) {
    const sheetName = String(day);
    const worksheet = workbook.getWorksheet(sheetName);
    if (!worksheet) continue;

    // Update Header metadata in row 3 and row 5
    const monthCell = worksheet.getCell('A3');
    monthCell.value = `Month:${data.monthName}-${data.year}`;

    const dateCell = worksheet.getCell('B5');
    const dayStr = String(day).padStart(2, '0');
    const monthNumStr = String(data.month).padStart(2, '0');
    dateCell.value = `Date:${dayStr}.${monthNumStr}.${data.year}`;

    // Load records for this day
    const records = data.dailyRecords[day] || [];
    const recordMap = new Map<string, DailyOperationalRecord>();
    for (const r of records) {
      recordMap.set(r.territoryName.toLowerCase().trim(), r);
    }

    // Populate Satkania Region Territory Rows (Rows 8 to 12)
    for (const t of SATKANIA_TERRITORIES) {
      const row = t.row;
      const rec = recordMap.get(t.name.toLowerCase().trim());

      // Cigarette Sales (Cols D..I)
      worksheet.getCell(`D${row}`).value = rec?.cigaretteSales.wilson ?? 0;
      worksheet.getCell(`E${row}`).value = rec?.cigaretteSales.shahara ?? 0;
      worksheet.getCell(`F${row}`).value = rec?.cigaretteSales.express ?? 0;
      worksheet.getCell(`G${row}`).value = rec?.cigaretteSales.nexus ?? 0;
      worksheet.getCell(`H${row}`).value = rec?.cigaretteSales.sb ?? 0;
      worksheet.getCell(`I${row}`).value = rec?.cigaretteSales.sm ?? 0;

      // Col J: Formula =SUM(D:I)
      worksheet.getCell(`J${row}`).value = { formula: `SUM(D${row}:I${row})` };

      // Cigarette Closing Stock (Cols K..P)
      worksheet.getCell(`K${row}`).value = rec?.cigaretteStock.wilson ?? 0;
      worksheet.getCell(`L${row}`).value = rec?.cigaretteStock.shahara ?? 0;
      worksheet.getCell(`M${row}`).value = rec?.cigaretteStock.express ?? 0;
      worksheet.getCell(`N${row}`).value = rec?.cigaretteStock.nexus ?? 0;
      worksheet.getCell(`O${row}`).value = rec?.cigaretteStock.sb ?? 0;
      worksheet.getCell(`P${row}`).value = rec?.cigaretteStock.sm ?? 0;

      // Col Q: Formula =SUM(K:P)
      worksheet.getCell(`Q${row}`).value = { formula: `SUM(K${row}:P${row})` };

      // Zarda Sales (Cols R..U)
      worksheet.getCell(`R${row}`).value = rec?.zardaSales.slb ?? 0;
      worksheet.getCell(`S${row}`).value = rec?.zardaSales.qty_22_25 ?? 0;
      worksheet.getCell(`T${row}`).value = rec?.zardaSales.qty_99_14 ?? 0;
      worksheet.getCell(`U${row}`).value = rec?.zardaSales.qty_33_15 ?? 0;

      // Col W: Formula =S*15+T*6+U*8
      worksheet.getCell(`W${row}`).value = { formula: `S${row}*15+T${row}*6+U${row}*8` };

      // Zarda Closing Stock (Cols X..AA)
      worksheet.getCell(`X${row}`).value = rec?.zardaStock.slb ?? 0;
      worksheet.getCell(`Y${row}`).value = rec?.zardaStock.qty_22_25 ?? 0;
      worksheet.getCell(`Z${row}`).value = rec?.zardaStock.qty_99_14 ?? 0;
      worksheet.getCell(`AA${row}`).value = rec?.zardaStock.qty_33_15 ?? 0;

      // Col AC: Formula =Y*15+Z*6+AA*8
      worksheet.getCell(`AC${row}`).value = { formula: `Y${row}*15+Z${row}*6+AA${row}*8` };

      // Empty Packets and Remarks
      worksheet.getCell(`AD${row}`).value = rec?.emptyPackets ?? 0;
      if (rec?.remarks) {
        worksheet.getCell(`AE${row}`).value = rec.remarks;
      }
    }

    // Row 13: Satkania Region Total Formulas
    const totRow = SATKANIA_TOTAL_ROW;
    worksheet.getCell(`D${totRow}`).value = { formula: `SUM(D8:D12)` };
    worksheet.getCell(`E${totRow}`).value = { formula: `SUM(E8:E12)` };
    worksheet.getCell(`F${totRow}`).value = { formula: `SUM(F8:F12)` };
    worksheet.getCell(`G${totRow}`).value = { formula: `SUM(G8:G12)` };
    worksheet.getCell(`H${totRow}`).value = { formula: `SUM(H8:H12)` };
    worksheet.getCell(`I${totRow}`).value = { formula: `SUM(I8:I12)` };
    worksheet.getCell(`J${totRow}`).value = { formula: `SUM(J8:J12)` };

    worksheet.getCell(`K${totRow}`).value = { formula: `SUM(K8:K12)` };
    worksheet.getCell(`L${totRow}`).value = { formula: `SUM(L8:L12)` };
    worksheet.getCell(`M${totRow}`).value = { formula: `SUM(M8:M12)` };
    worksheet.getCell(`N${totRow}`).value = { formula: `SUM(N8:N12)` };
    worksheet.getCell(`O${totRow}`).value = { formula: `SUM(O8:O12)` };
    worksheet.getCell(`P${totRow}`).value = { formula: `SUM(P8:P12)` };
    worksheet.getCell(`Q${totRow}`).value = { formula: `SUM(Q8:Q12)` };

    worksheet.getCell(`R${totRow}`).value = { formula: `SUM(R8:R12)` };
    worksheet.getCell(`S${totRow}`).value = { formula: `SUM(S8:S12)` };
    worksheet.getCell(`T${totRow}`).value = { formula: `SUM(T8:T12)` };
    worksheet.getCell(`U${totRow}`).value = { formula: `SUM(U8:U12)` };
    worksheet.getCell(`W${totRow}`).value = { formula: `SUM(W8:W12)` };

    worksheet.getCell(`X${totRow}`).value = { formula: `SUM(X8:X12)` };
    worksheet.getCell(`Y${totRow}`).value = { formula: `SUM(Y8:Y12)` };
    worksheet.getCell(`Z${totRow}`).value = { formula: `SUM(Z8:Z12)` };
    worksheet.getCell(`AA${totRow}`).value = { formula: `SUM(AA8:AA12)` };
    worksheet.getCell(`AC${totRow}`).value = { formula: `SUM(AC8:AC12)` };
    worksheet.getCell(`AD${totRow}`).value = { formula: `SUM(AD8:AD12)` };
  }

  // 2. Populate Sheet 32: 'STD & ADS'
  const stdSheet = workbook.getWorksheet('STD & ADS');
  if (stdSheet) {
    for (const t of SATKANIA_TERRITORIES) {
      const row = t.row;
      // 31-day summation formula for cigarette sales brands (D to I)
      const brandCols = ['D', 'E', 'F', 'G', 'H', 'I'];
      for (const col of brandCols) {
        const parts = [];
        for (let d = 1; d <= 31; d++) {
          parts.push(`'${d}'!${col}${row}`);
        }
        stdSheet.getCell(`${col}${row}`).value = { formula: parts.join('+') };
      }

      // Total STD: =SUM(D:I)
      stdSheet.getCell(`J${row}`).value = { formula: `SUM(D${row}:I${row})` };
    }
  }

  // 3. Populate Sheet 33: 'Target.'
  const targetSheet = workbook.getWorksheet('Target.');
  if (targetSheet) {
    for (const t of SATKANIA_TERRITORIES) {
      const row = t.row;
      // Total Target formula: =SUM(D:I)
      targetSheet.getCell(`J${row}`).value = { formula: `SUM(D${row}:I${row})` };
      // Target ADS formula: =J/26
      targetSheet.getCell(`K${row}`).value = { formula: `J${row}/26` };
    }
  }

  // 4. Populate Sheet 34: 'Analysis'
  const analysisSheet = workbook.getWorksheet('Analysis');
  if (analysisSheet) {
    for (const t of SATKANIA_TERRITORIES) {
      const row = t.row;
      // LM ADS: =D/26
      analysisSheet.getCell(`E${row}`).value = { formula: `D${row}/26` };
      // TARGET: =Target.!J
      analysisSheet.getCell(`F${row}`).value = { formula: `Target.!J${row}` };
      // TADS: ='STD & ADS'!Q or Target ADS
      analysisSheet.getCell(`G${row}`).value = { formula: `'STD & ADS'!Q${row}` };
      // STD: ='STD & ADS'!J
      analysisSheet.getCell(`H${row}`).value = { formula: `'STD & ADS'!J${row}` };
    }
  }

  // 5. Validate Generated Workbook
  const validation = validateExportedWorkbook(workbook);
  if (!validation.isValid) {
    throw new Error(`Workbook export validation failed: ${validation.errors.join('; ')}`);
  }

  // Write to Buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
