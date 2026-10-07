# 17 - TESTING STRATEGY & QUALITY ASSURANCE

## 1. Testing Philosophy & Definition of Done

> **A feature is NOT complete merely because the UI renders.**  
> A feature is complete only when unit tests, integration tests, RLS policy tests, and Excel fidelity tests pass without error.

---

## 2. Test Suite Categories

### 2.1 Unit Tests (Vitest / Jest)
- **Calculation Engine Tests (`calculation.test.ts`):**
  - Verify Cigarette Total Sales `=SUM(D:I)`.
  - Verify Cigarette Total Stock `=SUM(K:P)`.
  - Verify Zarda Value calculations (`22/25 * 15 + 99/14 * 6 + 33/15 * 8`).
  - Verify working day ADS calculations across varying month lengths.
  - Verify Achievement % and Projected volume calculations.
- **Date Safety Parser Tests (`date-safety.test.ts`):**
  - Verify exact match across App Date, Filename Date, Header Date, and Sheet Number.
  - Assert that any 1-day discrepancy throws `ERR_DATE_MISMATCH` and blocks execution.

### 2.2 Security & Scoped RLS Tests (`rls.test.ts`)
- **Territory Scope Isolation:**
  - Verify TSO A cannot query or mutate records belonging to Territory B.
- **Regional Scope Isolation:**
  - Verify RSO A cannot access records outside Region A.
- **CSR Immutability:**
  - Verify CSR cannot mutate a record once status is `SUBMITTED`.
  - Verify CSR cannot approve or reject any record.
- **Google Drive Access Restriction:**
  - Verify non-Super Admin calling `/api/google-drive/upload` receives `403 FORBIDDEN`.

### 2.3 Authoritative Excel Fidelity Tests (`excel.test.ts`)
- **34-Sheet Integrity:**
  - Load generated workbook using ExcelJS.
  - Assert sheet count is exactly 34.
  - Assert sheet names match `'1'`..`'31'`, `'STD & ADS'`, `'Target.'`, `'Analysis'` in order.
- **Dynamic Formula Verification:**
  - Assert cells `J8`, `Q8`, `W8`, `AC8` contain formula strings, not static values.
  - Assert no cell contains `#REF!`, `#VALUE!`, or `#N/A`.
- **Template Styling Preservation:**
  - Verify row heights, column widths, fills, and merged ranges match `excel/TEMPLATE.xlsx`.

### 2.4 Import Pipeline & Rollback Tests (`import.test.ts`)
- Test clean import of standard 34-sheet workbook.
- Test import failure on corrupted row structure.
- Assert database rollback leaves zero partial records upon validation failure.
- Test duplicate import dialog behavior.

---

## 3. Pre-Deployment Validation Checklist

Before any code is merged or deployed:
```bash
npm run lint          # 0 lint errors
npm run type-check    # 0 TypeScript type errors
npm run test          # 100% passing unit & integration tests
npm run test:excel    # 100% passing 34-sheet Excel generator tests
npm run build         # Next.js production build succeeds
```
