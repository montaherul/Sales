// System-wide Constants
// Afaz Tobacco Sales & Stock Intelligence Platform

export const ROLES = {
  // Platform Level
  SUPER_ADMIN: 'SUPER_ADMIN',
  PLATFORM_SUPPORT: 'PLATFORM_SUPPORT',

  // Tenant Level
  COMPANY_ADMIN: 'COMPANY_ADMIN',
  TENANT_ADMIN: 'TENANT_ADMIN',
  CEO: 'CEO',
  COMMERCIAL_DIRECTOR: 'COMMERCIAL_DIRECTOR',
  DEPARTMENT_HEAD: 'DEPARTMENT_HEAD',

  // Sales
  HEAD_OF_SALES: 'HEAD_OF_SALES',
  REGIONAL_MANAGER: 'REGIONAL_MANAGER',
  RSO: 'RSO',
  AREA_MANAGER: 'AREA_MANAGER',
  TERRITORY_OFFICER: 'TERRITORY_OFFICER',
  TSO: 'TSO',
  FIELD_SUPERVISOR: 'FIELD_SUPERVISOR',
  CSR: 'CSR',

  // Marketing
  HEAD_OF_MARKETING: 'HEAD_OF_MARKETING',
  BRAND_MANAGER: 'BRAND_MANAGER',
  TRADE_MARKETING_MANAGER: 'TRADE_MARKETING_MANAGER',
  TRADE_MARKETING_OFFICER: 'TRADE_MARKETING_OFFICER',
  MARKETING_EXECUTIVE: 'MARKETING_EXECUTIVE',

  // Distribution
  DISTRIBUTOR_ADMIN: 'DISTRIBUTOR_ADMIN',
  DISTRIBUTOR_MANAGER: 'DISTRIBUTOR_MANAGER',
  DISTRIBUTOR_STAFF: 'DISTRIBUTOR_STAFF',

  // Analytics
  SALES_ANALYST: 'SALES_ANALYST',
  MARKETING_ANALYST: 'MARKETING_ANALYST',
} as const;

export type RoleType = (typeof ROLES)[keyof typeof ROLES] | (string & {});

export const SUBMISSION_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  TSO_APPROVED: 'TSO_APPROVED',
  RSO_APPROVED: 'RSO_APPROVED',
  FINALIZED: 'FINALIZED',
  REJECTED: 'REJECTED',
} as const;

export type SubmissionStatus = typeof SUBMISSION_STATUS[keyof typeof SUBMISSION_STATUS];

export const AUDIT_ACTIONS = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  SUBMIT: 'SUBMIT',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  FINALIZE: 'FINALIZE',
  UNLOCK: 'UNLOCK',
  IMPORT: 'IMPORT',
  EXPORT: 'EXPORT',
  GOOGLE_UPLOAD: 'GOOGLE_UPLOAD',
  TARGET_UPDATE: 'TARGET_UPDATE',
  PRICE_UPDATE: 'PRICE_UPDATE',
  ROLE_CHANGE: 'ROLE_CHANGE',
  MENU_ACCESS_UPDATE: 'MENU_ACCESS_UPDATE',
} as const;

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];

export const ZARDA_UNIT_PRICES = {
  price_22_25: 15, // 22/25 (BDT 15)
  price_99_14: 6,  // 99/14 (BDT 6)
  price_33_15: 8,  // 33/15 (BDT 8)
} as const;

export const DEFAULT_WORKING_DAYS = 26;

// Exact 34 sheets required for authoritative monthly workbook
export const WORKBOOK_SHEETS: readonly string[] = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
  '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31',
  'STD & ADS',
  'Target.',
  'Analysis'
] as const;

export const EXPECTED_SHEET_COUNT = 34;

export const SATKANIA_TERRITORIES = [
  { id: 'satkania-keranihat', name: 'Kerani Hat', code: 'KH', rowOffset: 8 },
  { id: 'satkania-satkania', name: 'Satkania', code: 'SAT', rowOffset: 9 },
  { id: 'satkania-gunagori', name: 'Gunagori', code: 'GN', rowOffset: 10 },
  { id: 'satkania-lohagora', name: 'Lohagora', code: 'LH', rowOffset: 11 },
  { id: 'satkania-chakaria', name: 'Chakaria', code: 'CH', rowOffset: 12 },
] as const;

export const CIGARETTE_BRANDS = [
  { code: 'wilson', name: 'Wilson', colLetterSales: 'D', colLetterStock: 'K' },
  { code: 'shahara', name: 'Shahara', colLetterSales: 'E', colLetterStock: 'L' },
  { code: 'express', name: 'Express', colLetterSales: 'F', colLetterStock: 'M' },
  { code: 'nexus', name: 'Nexus', colLetterSales: 'G', colLetterStock: 'N' },
  { code: 'sb', name: 'SB', colLetterSales: 'H', colLetterStock: 'O' },
  { code: 'sm', name: 'SM', colLetterSales: 'I', colLetterStock: 'P' },
] as const;

export const ZARDA_BRANDS = [
  { code: 'slb', name: 'SLB', unitPrice: 0 },
  { code: 'qty_22_25', name: '22/25', unitPrice: 15 },
  { code: 'qty_99_14', name: '99/14', unitPrice: 6 },
  { code: 'qty_33_15', name: '33/15', unitPrice: 8 },
] as const;

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

