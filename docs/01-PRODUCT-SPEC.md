# 01 - PRODUCT SPECIFICATION

## 1. Problem Statement

Historically, field sales tracking in tobacco distribution relies on offline spreadsheets circulated via chat apps and email. This leads to:
- **Version Skew:** Officers entering data in superseded copies of the monthly workbook.
- **Accidental Overwrites:** Formula cells (e.g., sums, STD aggregations) accidentally typed over by field reps.
- **Data Tampering:** Lack of audit trails or immutable submission states once records are reviewed.
- **Slow Consolidation:** Manual copy-pasting of daily territory logs into master regional sheets.
- **Zero Scope Security:** Any recipient can view company-wide data without territory or regional restrictions.

The **Afaz Tobacco Sales & Stock Intelligence Platform** solves these challenges by providing a unified web interface backed by a relational PostgreSQL database while keeping the exact 34-sheet monthly Excel workbook format as the authoritative reporting output.

---

## 2. Target User Personas & Workflows

### 2.1 Customer Sales Representative (CSR)
- **Role:** Field operative assigned to specific market routes and retail accounts.
- **Pain Points:** Needs a clean mobile-friendly interface to quickly log end-of-day sales, unsold inventory, and empty packet collections without needing a laptop or Excel expertise.
- **Primary Actions:**
  - Open daily entry form for current date.
  - Enter cigarette sales and closing stock per brand (Wilson, Shahara, Express, Nexus, SB, SM).
  - Enter zarda sales and closing stock quantities (SLB, 22/25, 99/14, 33/15).
  - Enter collected empty packet count and operational remarks.
  - Save as Draft or Submit to TSO.
  - View submission status (Draft, Submitted, Approved, or Rejected with feedback).

### 2.2 Territory Sales Officer (TSO)
- **Role:** Field supervisor managing multiple routes and CSRs within an assigned territory (e.g., Kerani Hat, Bandarban).
- **Pain Points:** Needs to review and verify entries for all routes in their territory, catch anomalies before regional consolidation, and monitor territory targets.
- **Primary Actions:**
  - View territory dashboard with daily aggregated sales, closing stock, and target pacing.
  - Review pending CSR submissions.
  - Approve verified submissions or Reject with specific correction comments.
  - Export territory daily status for local reporting.

### 2.3 Regional Sales Officer (RSO)
- **Role:** Regional executive responsible for a geographical region (e.g., Satkania Region) encompassing multiple territories.
- **Pain Points:** Needs regional visibility without getting bogged down in individual route micro-entries; needs to verify TSO approvals before monthly sign-off.
- **Primary Actions:**
  - View regional overview aggregating all child territories.
  - Monitor Territory Average Daily Sales (ADS), Sales-to-Date (STD), and target achievement percentages.
  - Perform second-level regional verification and approval.
  - Export regional spreadsheets and dashboards.

### 2.4 Super Admin (Enterprise Executive / Ops Director)
- **Role:** Head of marketing, finance, or operations with system-wide oversight.
- **Pain Points:** Requires absolute data integrity, centralized master configuration (prices, targets, working days), audit logs, and authorized Google Drive archival.
- **Primary Actions:**
  - Manage user accounts, role assignments, and geographical data scopes.
  - Configure brands, products, prices, target quotas, and calendar working days (default 26 days).
  - Import legacy or monthly XLSX files with strict schema and date validations.
  - Generate and download the authoritative 34-sheet monthly reporting workbook.
  - Perform authorized cloud upload to Google Drive (`Afaz_Tobacco_Reports/YYYY/MM_Month/YYYY-MM-DD/`).
  - Unlock finalized records when justified by documented audit requests.

---

## 3. High-Level Feature Modules

1. **Daily Operational Entry Module:** Fast, responsive tabular grid with automatic calculation of total sales, total stock, and zarda values.
2. **Review & Approval Hub:** Multi-level approval queue with state machine progression and audit logging.
3. **Calculation Engine:** Standardized formulas for Total Sales, Total Stock, Zarda Valuation, STD, ADS, Achievement %, and Projections.
4. **Authoritative 34-Sheet Excel Generator:** High-fidelity ExcelJS engine maintaining every formula, merged cell, border, and style of `TEMPLATE.xlsx`.
5. **Secure XLSX Import Engine:** Pre-flight validation verifying file integrity, dates, territory scopes, and duplicates before transactional database import.
6. **Google Drive Cloud Archival:** Super Admin-only cloud upload to structured enterprise folders with checksum verification.
7. **Analytics & Performance Dashboard:** Interactive visual KPIs (sales trends, brand volume distribution, territory ranking, target variance) built with Recharts.
8. **Comprehensive Audit & Governance:** Immutable event log tracking every login, edit, approval, unlock, import, and export.
