# 07 - XLSX IMPORT SPECIFICATION

## 1. Primary Principle

> **Never blindly import an XLSX file.**  
> Excel must always be treated as an untrusted, unverified input source.

Every imported workbook must pass rigorous schema, structure, date, scope, and integrity validations before any database transaction is initiated.

---

## 2. Comprehensive Import Pipeline

```text
1. File Upload (.xlsx format check, mime type, size < 25MB)
   ↓
2. Binary & OpenXML Structure Validation
   ↓
3. Sheet Count & Sheet Name Validation (34 sheets in exact order: 1..31, STD & ADS, Target., Analysis)
   ↓
4. Metadata & Date Safety Verification (App date vs. Filename vs. Cell date vs. Sheet number)
   ↓
5. Organization & Territory Validation (Verify Region and Territory exist in database)
   ↓
6. User Scope Authorization Check (Current user has permission to import for this scope)
   ↓
7. Duplicate Record Detection (Check if (territory_id, date) already exists)
   ↓
8. Cell-by-Cell Data Validation (Numbers, non-negative, required cells)
   ↓
9. Raw Input Extraction & Value Recalculation (Extract raw cells; do not trust Excel formula cache)
   ↓
10. Interactive Preview Screen (Display valid rows, warnings, detected anomalies)
   ↓
11. Explicit User Confirmation
   ↓
12. Atomic PostgreSQL Database Transaction (COMMIT on success, ROLLBACK on any failure)
   ↓
13. Audit Logging (Record import metadata, record counts, file checksum)
```

---

## 3. Structural & Sheet Validation

A valid monthly reporting workbook must contain **exactly 34 sheets** matching these exact case-sensitive names in this precise order:

```text
Index 01–31:  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
              '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
              '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31'
Index 32:     'STD & ADS'
Index 33:     'Target.'
Index 34:     'Analysis'
```

If any sheet is missing, renamed, or out of order, the import is immediately rejected with code `ERR_WORKBOOK_STRUCTURE_INVALID`.

---

## 4. Date Safety Validation (Zero Tolerance)

Date mismatch is one of the most common vectors for historical data corruption. The import engine strictly compares four distinct date indicators:

1. **Application-Selected Date:** The date picked by the user in the import modal (e.g., `2026-10-06`).
2. **Filename Date String:** Parsed from the uploaded file name (e.g., `Daily sales and Closing Stock Information October 6 2026.xlsx` → `2026-10-06`).
3. **Workbook Cell Header:** The reporting date text in row 5 (e.g., `Date:06.10.2026` or `Date: Target of October 2026`).
4. **Daily Sheet Number:** The specific worksheet being parsed (Sheet `6` corresponds to Day `06`).

### Blocking Rule:
If **ANY** of these four dates disagree:
```text
┌────────────────────────────────────────────────────────┐
│               IMPORT BLOCKED: DATE CONFLICT            │
│                                                        │
│ Application Date: 2026-10-06                           │
│ Filename Date:    2026-10-05                           │
│ Header Cell Date: 2026-10-06                           │
│ Sheet Number:     6                                    │
│                                                        │
│ Conflict: Filename date does not match Application date│
│ Operation aborted. System will not guess the date.     │
└────────────────────────────────────────────────────────┘
```
The system will **NEVER guess** which date is correct. The import is aborted immediately.

---

## 5. Organizational & Scope Verification

For every row in the daily sheets:
1. **Region Verification:** Ensure the value in Column B (`Name of Region`) exists in the `regions` table.
2. **Territory Verification:** Ensure the value in Column C (`Name of Territory`) exists in `territories` and belongs to that region.
3. **User Scope Check:** Verify that the uploading user has administrative authority over that territory.

---

## 6. Duplicate Conflict Resolution

If a submission record already exists for the given territory and date:
- Direct overwrite is prohibited.
- The UI halts and prompts the user with explicit actions:
  - **Cancel:** Abort the entire import.
  - **Create Revision:** Save the incoming data as a new version in `submission_versions`, requiring re-approval.
  - **Request Replacement:** (Restricted to `SUPER_ADMIN`) Overwrite the current record, requiring an explicit reason logged in `audit_logs`.

---

## 7. Raw Input Extraction & Recalculation

Do **NOT** trust pre-calculated values stored in the Excel file cache. The import engine extracts:
- Raw Cigarette Sales per Brand (Wilson, Shahara, Express, Nexus, SB, SM)
- Raw Cigarette Closing Stock per Brand
- Raw Zarda Sales Quantities (SLB, 22/25, 99/14, 33/15)
- Raw Zarda Closing Stock Quantities
- Raw Express Empty Packet count
- Raw Remarks

The central **Calculation Engine** then recalculates:
- Total Sales
- Total Stock
- Total Zarda Sales Value
- Total Zarda Closing Stock Value
- STD & ADS
- Targets & Analysis

This ensures corrupt Excel formulas cannot contaminate the database.

---

## 8. Interactive Preview & Validation Summary

Before touching the database, the import pipeline generates a preview payload:
- **File Name & Size**
- **Detected Reporting Period:** Month, Year, Date
- **Region & Territory Counts**
- **Total Valid Records**
- **Warnings & Non-Blocking Notes**
- **Errors Table:**
  - Sheet Name
  - Row Number
  - Column Name
  - Field Name
  - Value Detected
  - Expected Format
  - Error Reason

No database mutation occurs until the user reviews the preview and clicks **"Confirm & Execute Import"**.

---

## 9. Atomic Transaction & Error Rollback

All database writes for an import run inside a single PostgreSQL transaction:
```sql
BEGIN;
  -- Insert import header record
  -- Insert/update daily submissions
  -- Insert brand sales & stock items
  -- Record audit logs
COMMIT; -- Only if all rows succeed without error
```
If any unhandled exception or data integrity violation occurs:
```sql
ROLLBACK;
```
A partial import is never permitted.
