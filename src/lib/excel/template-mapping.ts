// Exact Coordinate and Structure Mapping for Authoritative 34-Sheet Workbook
// Based on excel/TEMPLATE.xlsx

export const WORKBOOK_SHEETS = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
  '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31',
  'STD & ADS',
  'Target.',
  'Analysis'
] as const;

export const EXPECTED_SHEET_COUNT = 34;

export const DAILY_COLUMNS = {
  SL_NO: 'A',
  REGION_NAME: 'B',
  TERRITORY_NAME: 'C',
  
  // Cigarette Sales (BITCL)
  SALES_WILSON: 'D',
  SALES_SHAHARA: 'E',
  SALES_EXPRESS: 'F',
  SALES_NEXUS: 'G',
  SALES_SB: 'H',
  SALES_SM: 'I',
  SALES_TOTAL: 'J', // Formula =SUM(D:I)
  
  // Cigarette Closing Stock (BITCL)
  STOCK_WILSON: 'K',
  STOCK_SHAHARA: 'L',
  STOCK_EXPRESS: 'M',
  STOCK_NEXUS: 'N',
  STOCK_SB: 'O',
  STOCK_SM: 'P',
  STOCK_TOTAL: 'Q', // Formula =SUM(K:P)
  
  // Zarda Sales (BITCL)
  ZARDA_SALES_SLB: 'R',
  ZARDA_SALES_22_25: 'S',
  ZARDA_SALES_99_14: 'T',
  ZARDA_SALES_33_15: 'U',
  ZARDA_SALES_TOTAL_VALUE: 'W', // Formula =S*15+T*6+U*8
  
  // Zarda Closing Stock (BITCL)
  ZARDA_STOCK_SLB: 'X',
  ZARDA_STOCK_22_25: 'Y',
  ZARDA_STOCK_99_14: 'Z',
  ZARDA_STOCK_33_15: 'AA',
  ZARDA_STOCK_TOTAL_VALUE: 'AC', // Formula =Y*15+Z*6+AA*8
  
  // Operational Metrics
  EMPTY_PACKET: 'AD',
  REMARK: 'AE',
} as const;

export const SATKANIA_TERRITORIES = [
  { row: 8, sl: 1, name: 'Kerani hat' },
  { row: 9, sl: 2, name: 'Satkania' },
  { row: 10, sl: 3, name: 'Bandarban' },
  { row: 11, sl: 4, name: 'Rajasthali' },
  { row: 12, sl: 5, name: 'Dohazari' },
] as const;

export const SATKANIA_TOTAL_ROW = 13;
export const DATA_START_ROW = 8;
