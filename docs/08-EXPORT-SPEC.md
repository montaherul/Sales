# 08 - XLSX EXPORT SPECIFICATION

## 1. Authoritative Template Compliance

> **`excel/TEMPLATE.xlsx` is the AUTHORITATIVE reporting template.**  
> The application must preserve its exact visual hierarchy, fonts, borders, fills, merged cells, formulas, sheet names, and sheet order.

Developers and AI coding agents must **NEVER redesign, reformat, or "simplify"** this workbook.

---

## 2. Workbook Specification

Every full monthly export contains **exactly 34 worksheets**:

### 2.1 Daily Worksheets (Sheets 1 through 31)
- **Names:** `'1'`, `'2'`, `'3'`, ..., `'31'`
- **Role:** Individual daily operational records for each day of the month.
- **Header Hierarchy:**
  - Row 1: `Afaz Tobacco  Company .`
  - Row 2: `Marketing Department`
  - Row 3: `Month:{Month}-{Year}` (e.g., `Month:October-2026`)
  - Row 4: `Daily Sales & Closing Stock Information.`
  - Row 5: `Date:{DD.MM.YYYY}` | `Division: Ctg South` | `Wing: Chittagong`
  - Row 6: Primary Section Headers (`SL. NO`, `Name of Region`, `Name of Territory`, `Brand wise Sales (BITCL)`, `TOTAL SALES`, `Brand Wise Closing Stock (BITCL)`, `TOTAL Stock`, etc.)
  - Row 7: Brand Sub-headers (`Wilson`, `Shahara`, `Express`, `Nexus`, `SB`, `SM`, `SLB`, `22/25`, `99/14`, `33/15`, `Total Zarda Sales Value`, `Total Zarda C.Stock Value`, `Express Empty Packet`, `Remark`)

### 2.2 Calculation & Aggregation Sheets (Sheets 32, 33, 34)
- **Sheet 32:** `'STD & ADS'` (Sales-To-Date and Average Daily Sales)
- **Sheet 33:** `'Target.'` (Monthly territory targets, routes, and outlets)
- **Sheet 34:** `'Analysis'` (Performance analysis, pacing, achievement, and variance)

---

## 3. Export Generation Pipeline

```text
1. Load Reporting Period & Active Scope from Database
   ↓
2. Load Master Organizations (Division, Wing, Regions, Territories)
   ↓
3. Load Daily Records (Sales, Stock, Zarda, Empty Packets for Days 1–31)
   ↓
4. Load Territory Targets & Configured Working Days
   ↓
5. Initialize ExcelJS Workbook by cloning `excel/TEMPLATE.xlsx`
   ↓
6. Populate Metadata Headers (Month, Year, Date, Division, Wing)
   ↓
7. Populate Daily Sheets (Days 1–31):
   - Inject raw numeric inputs for Sales, Stock, Zarda Qty, and Empty Packets
   - Inject native Excel formulas for Totals, Valuations, and Regional Sums
   ↓
8. Populate Aggregation Sheets:
   - Sheet 'STD & ADS': 31-day summation formulas (e.g., ='1'!D8+'2'!D8+...+'31'!D8)
   - Sheet 'Target.': Target quantities, route count, outlet count
   - Sheet 'Analysis': Comparative formulas referencing Target. and STD & ADS
   ↓
9. Execute Pre-Export Validation Suite
   ↓
10. Stream Generated Binary to Client / Google Drive
```

---

## 4. Standard Filename Convention

The exported file name must strictly match the corporate pattern:

$$\text{Daily sales and Closing Stock Information } \{Month\} \ \{Date\} \ \{Year\}\text{.xlsx}$$

**Examples:**
- `Daily sales and Closing Stock Information October 6 2026.xlsx`
- `Daily sales and Closing Stock Information August 26 2026.xlsx`

---

## 5. Exact Formula Requirements

Calculated cells must be populated with **dynamic native Excel formulas**, not static evaluated strings:

### 5.1 Daily Sheet Formulas (e.g., Row 8 - Kerani Hat)
- **Total Cigarette Sales (Col J):**
  `=SUM(D8:I8)`
- **Total Cigarette Closing Stock (Col Q):**
  `=SUM(K8:P8)`
- **Total Zarda Sales Value (Col W):**
  `=S8*15+T8*6+U8*8`
- **Total Zarda Closing Stock Value (Col AC):**
  `=Y8*15+Z8*6+AA8*8`

### 5.2 Regional Total Formulas (e.g., Row 13 - Satkania Region Total)
- **Regional Sales Wilson (Col D):**
  `=SUM(D8:D12)`
- **Regional Sales Total (Col J):**
  `=SUM(J8:J12)`
- **Regional Stock Total (Col Q):**
  `=SUM(Q8:Q12)`
- **Regional Zarda Sales Value (Col W):**
  `=SUM(W8:W12)`
- **Regional Zarda Stock Value (Col AC):**
  `=SUM(AC8:AC12)`
- **Regional Empty Packets (Col AD):**
  `=SUM(AD8:AD12)`

### 5.3 STD & ADS Sheet Formulas (Sheet 32)
- **Sales-to-Date (Col D, Kerani Hat):**
  `='1'!D8+'2'!D8+'3'!D8+'4'!D8+'5'!D8+'6'!D8+'7'!D8+'8'!D8+'9'!D8+'10'!D8+'11'!D8+'12'!D8+'13'!D8+'14'!D8+'15'!D8+'16'!D8+'17'!D8+'18'!D8+'19'!D8+'20'!D8+'21'!D8+'22'!D8+'23'!D8+'24'!D8+'25'!D8+'26'!D8+'27'!D8+'28'!D8+'29'!D8+'30'!D8+'31'!D8`
- **Average Daily Sales (ADS):**
  `=D8/26` *(or referencing configured working days)*

### 5.4 Analysis Sheet Formulas (Sheet 34)
- **Target Reference (Col F):**
  `=Target.!J8`
- **Target ADS (Col G):**
  `=F8/26`
- **STD Reference (Col H):**
  `='STD & ADS'!J8`
- **Period ADS (Col I):**
  `=H8/Days_Elapsed`
- **Achievement % (Col K):**
  `=(H8/F8)*100`

---

## 6. Pre-Export Validation Suite

Before any file is delivered for download or uploaded to Google Drive, the export validator checks:
1. **Sheet Count:** Exactly 34 sheets.
2. **Sheet Names:** Verifies all 34 names match `'1'` to `'31'`, `'STD & ADS'`, `'Target.'`, `'Analysis'`.
3. **Formula Integrity:** Asserts no formula contains `#REF!`, `#VALUE!`, or `#N/A`.
4. **Header Consistency:** Checks date and month match requested reporting period.
5. **Format & Styles:** Verifies borders, fills, and column widths are intact.

If any check fails, the export is aborted, and a structured developer log is created.
