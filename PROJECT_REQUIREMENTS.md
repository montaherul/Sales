# PROJECT REQUIREMENTS

## 1. Product Overview

**Product Name:** Afaz Tobacco Sales & Stock Intelligence Platform  
**Target Enterprise:** Afaz Tobacco Company Marketing & Field Distribution Operations  
**Core Mission:** A secure, centralized web platform replacing scattered spreadsheet handoffs with a role-governed, auditable workflow for daily cigarette and zarda sales, closing stock, target tracking, analysis, and exact Excel / Google Drive reporting.

---

## 2. Business Objectives

1. **Daily Operational Entry:** Enable field Customer Sales Representatives (CSR) to enter daily sales, closing stock, zarda sales/stock, and empty packet counts with built-in validation.
2. **Hierarchical Verification & Approval:** Implement a strict review and approval pipeline:
   - CSR creates and submits daily logs.
   - Territory Sales Officer (TSO) reviews, verifies, edits if permitted, and approves territory records.
   - Regional Sales Officer (RSO) reviews and verifies all territories in their assigned region.
   - Super Admin finalizes and locks the reporting period.
3. **Dynamic Organizational Structure:** Support Company → Division → Wing → Region → Territory → Route → Outlet → CSR without hardcoded structural logic.
4. **Authoritative 34-Sheet Excel Reporting:** Export exact monthly workbooks matching the company's established reporting template (`excel/TEMPLATE.xlsx`):
   - Daily sheets `1` through `31`
   - `STD & ADS` (Sales To Date & Average Daily Sales)
   - `Target.` (Territory targets, routes, outlets)
   - `Analysis` (Last month comparisons, variance, achievement, projections)
5. **Lossless Import Pipeline:** Allow importing legacy or monthly XLSX files with multi-layer validation (sheet structure, date comparison, regional scope, formula validation, and duplicate conflict resolution).
6. **Centralized Calculation Engine:** Compute totals, stock reconciliations, STD, ADS, target achievements, and projections consistently across web dashboards, reports, and exported spreadsheets.
7. **Controlled Google Drive Integration:** Strictly restrict Google Drive automated uploads to the Super Admin role, archiving monthly files into structured cloud directories (`Afaz_Tobacco_Reports/YYYY/MM_Month/YYYY-MM-DD/`).
8. **Enterprise Traceability:** Full audit trail and versioning of every modification, approval status change, unlock override, and import event.

---

## 3. User Roles & Permission Model

| Role | Operational Scope | Key Capabilities | Key Restrictions |
| :--- | :--- | :--- | :--- |
| **SUPER_ADMIN** | Global (Entire Enterprise) | Full system administration; manage organizations, products, prices, targets, users, roles, and scopes; unlock finalized submissions; import/export; perform Google Drive synchronization. | None. Must supply mandatory audit reasons when unlocking finalized data. |
| **RSO** | Regional Scope | Review assigned regional data across all child territories; verify TSO and CSR submissions; approve or reject regional data; export reports. | Cannot access unrelated regions; cannot modify master catalogs; cannot upload directly to Google Drive. |
| **TSO** | Territory Scope | Supervise assigned territory; review and verify CSR entries; approve or reject territory submissions; view territory targets, stock, STD, and ADS. | Cannot access other territories or regional administrative functions; cannot upload to Google Drive. |
| **CSR** | Operational Data Scope | Create daily drafts for sales, closing stock, zarda, empty packets, and remarks; edit drafts; submit for TSO review; view submission status. | Cannot approve or reject; cannot modify targets, formulas, or prices; cannot see unassigned territories. |

---

## 4. Organizational Hierarchy

The system operates across a dynamic organizational model:
```text
Company (e.g., Afaz Tobacco Company)
  └── Division (e.g., Ctg South)
        └── Wing (e.g., Chittagong)
              └── Region (e.g., Satkania, Cox's Bazar, etc.)
                    └── Territory (e.g., Kerani hat, Satkania, Bandarban, Rajasthali, Dohazari)
                          └── Route (e.g., Market Route 01, Town Route)
                                └── Outlet (Retail Accounts)
                                      └── CSR (Field Rep Assigned)
```

- Organizations and their relations are stored in normalized PostgreSQL tables.
- No business logic or queries may hardcode region or territory strings.

---

## 5. Daily Data Model & Tracking Scope

Each daily entry captures data across four core product categories:

### 5.1 Cigarette Sales & Closing Stock
Tracked brand-wise across standard product lines:
- **Brands:** Wilson, Shahara, Express, Nexus, SB, SM, etc.
- **Metrics Tracked per Brand:**
  - Daily Sales Quantity
  - Daily Closing Stock Quantity
- **Calculated Rollups:**
  - `TOTAL SALES` = Sum of all brand sales
  - `TOTAL Stock` = Sum of all brand closing stock

### 5.2 Zarda Sales & Closing Stock
Tracked brand-wise with unit price valuation:
- **Brands:** SLB, 22/25, 99/14, 33/15, etc.
- **Configured Unit Prices:**
  - 22/25 = 15 BDT / unit
  - 99/14 = 6 BDT / unit
  - 33/15 = 8 BDT / unit
  - (Configurable in database master price tables)
- **Calculated Valuations:**
  - `Total Zarda Sales Value` = `(Qty * Unit Price)` across all brands
  - `Total Zarda C.Stock Value` = `(Closing Stock Qty * Unit Price)` across all brands

### 5.3 Empty Packet Recovery
- **Metric:** Express Empty Packet count returned / recovered from retail outlets.

### 5.4 Operational Notes
- **Metric:** Remarks / observations per territory and route.

---

## 6. Daily Data Workflow & Approval Lifecycle

```text
[CSR Entry: DRAFT]
        │
        ▼ (CSR clicks Submit)
[SUBMITTED]
        │
        ├──► (TSO Rejects) ──► [REJECTED] ──► (CSR revises) ──► [SUBMITTED]
        │
        ▼ (TSO Reviews & Approves)
[TSO_APPROVED]
        │
        ├──► (RSO Rejects) ──► [REJECTED] ──► (TSO / CSR revises)
        │
        ▼ (RSO Verifies & Approves)
[RSO_APPROVED]
        │
        ▼ (Super Admin / Automated Batch)
[FINALIZED] (Locked & Immutable)
```

### Locking & Unlocking Policy
- **Immutable State:** Once set to `FINALIZED`, no field user (CSR, TSO, RSO) can alter the data.
- **Super Admin Override:** Only a user with `SUPER_ADMIN` role can unlock a finalized record. An unlock request requires a mandatory textual reason that is permanently recorded in the audit trail.

---

## 7. Authoritative 34-Sheet Excel Reporting

### 7.1 Workbook Structure
Every monthly export must generate exactly 34 worksheets in this exact order:
1. Days `1` to `31` (Individual sheets for each calendar day)
2. `STD & ADS` (Cumulative sales to date and average daily sales across days 1–31)
3. `Target.` (Configured monthly sales targets, route count, outlet count)
4. `Analysis` (Last month sales, last month ADS, target, target ADS, STD, period ADS, remaining ADS, projections, achievement percentage, and growth variance)

### 7.2 Formula Preservation
Calculated cells must contain native Excel formulas, NOT hardcoded evaluated numbers:
- Sheet Daily Sales: `=SUM(D8:I8)`
- Sheet Daily Stock: `=SUM(K8:P8)`
- Sheet Zarda Sales Value: `=S8*15+T8*6+U8*8`
- Sheet Zarda Stock Value: `=Y8*15+Z8*6+AA8*8`
- Regional Total: `=SUM(D8:D12)`
- STD Sheet: Cumulative reference `='1'!D8+'2'!D8+...+'31'!D8`
- Analysis Sheet: Linked to `STD & ADS` and `Target.`

### 7.3 Styling & Layout Fidelity
The generator must preserve fonts, borders, column widths, row heights, merged headers (`Marketing Department`, `Month:October-2026`, etc.), and conditional formatting.

---

## 8. XLSX Import Requirements

- **File Integrity:** Must be a valid `.xlsx` file containing the expected 34-sheet structure or valid single-day sheets.
- **Date Matching Safety:** Strictly match the application-selected reporting date against:
  1. Selected date in UI
  2. Filename date string
  3. Internal cell dates (e.g., `Date:01.10.2026`)
  4. Active sheet name
- **Conflict Handling:** Any discrepancy between dates immediately BLOCKS import.
- **Duplicate Protection:** If data already exists for a territory on the imported date, import is paused. The user is prompted with options (Cancel, Create Revision, or Request Replacement).
- **Atomic Transactions:** All database writes occur within a single database transaction. If any row fails validation, the entire import is rolled back.

---

## 9. Google Drive & Google Sheets Integration

- **Restricted Access:** Only `SUPER_ADMIN` can upload final monthly reports to Google Drive.
- **Directory Hierarchy:**
  ```text
  Afaz_Tobacco_Reports/
    └── YYYY/
          └── MM_Month/
                └── YYYY-MM-DD/
                      └── Daily sales and Closing Stock Information {Month} {Date} {Year}.xlsx
  ```
- **Checksum Verification:** Compute SHA-256 checksum of generated workbook before upload. Check for existing file versions in Google Drive to prevent unintended file overwrites.
- **Google Sheets:** Used as a synchronized reporting/viewing layer, updated from PostgreSQL. PostgreSQL remains the single source of truth.

---

## 10. Audit Logging & Version Control

The system must log every meaningful business event:
- User authentication (login, logout, failed attempt)
- Role and permission assignments
- Record creation, updates, and status changes
- Record approval and rejection with reviewer notes
- Super Admin unlock events with mandatory reasons
- File imports and error reports
- Excel export generations and downloads
- Google Drive upload operations and file IDs
- Master data modifications (prices, products, targets, working days)
