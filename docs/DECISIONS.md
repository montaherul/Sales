# ARCHITECTURE DECISION RECORDS (ADR)

This file documents the foundational architectural and technical decisions for the Afaz Tobacco Sales & Stock Intelligence Platform. All future software engineering agents and developers must respect these decisions.

---

## ADR-001: Supabase PostgreSQL as Primary Database
- **Date:** 2026-10-07
- **Status:** Accepted
- **Decision:** Use Supabase PostgreSQL as the primary and authoritative transactional database.
- **Context:** The system requires relational joins across complex hierarchies (Company → Division → Wing → Region → Territory → Route → Outlet), atomic multi-table transactions for sales and inventory reconciliation, strict unique constraints, and Row Level Security.
- **Consequence:** Excel and Google Sheets must NEVER be treated as primary databases. No NoSQL/document database may replace PostgreSQL.

---

## ADR-002: Preservation of Authoritative 34-Sheet Excel Template
- **Date:** 2026-10-07
- **Status:** Accepted
- **Decision:** The uploaded workbook `excel/TEMPLATE.xlsx` is declared the immutable, authoritative reporting template. The application must generate all 34 worksheets matching its exact structure, names, styling, merged cells, and formula architecture.
- **Context:** The enterprise's field and executive reporting relies on the exact layout of Sheets `1`–`31`, `STD & ADS`, `Target.`, and `Analysis`.
- **Consequence:** Developers and AI agents are strictly forbidden from "improving", redesigning, or simplifying this workbook format.

---

## ADR-003: PostgreSQL Row Level Security (RLS) with Scoped RBAC
- **Date:** 2026-10-07
- **Status:** Accepted
- **Decision:** Enforce data access authorization using a combination of Roles, Permissions, and Data Scopes enforced at the database level via PostgreSQL RLS.
- **Context:** Field officers (CSR, TSO, RSO) must never view or edit records outside their assigned operational territory or region. Client-side button hiding or simple API checks alone are insufficient for enterprise security.
- **Consequence:** Every database query executes within the security context of the user's geographical scopes.

---

## ADR-004: Native Dynamic Excel Formulas in ExcelJS Exports
- **Date:** 2026-10-07
- **Status:** Accepted
- **Decision:** Exported Excel workbooks must contain native spreadsheet formulas (e.g., `=SUM(D8:I8)`, `=S8*15+T8*6+U8*8`, `=SUM(D8:D12)`) in calculated cells rather than pre-evaluated static numeric strings.
- **Context:** Users who open the exported monthly workbook in Microsoft Excel or Google Sheets expect dynamic recalculation when reviewing numbers offline.
- **Consequence:** The Excel generation pipeline must generate valid Excel formula syntax alongside raw input values.

---

## ADR-005: Super Admin Exclusivity for Google Drive Cloud Archival
- **Date:** 2026-10-07
- **Status:** Accepted
- **Decision:** Google Drive upload and cloud folder management is strictly restricted to users holding the `SUPER_ADMIN` role.
- **Context:** Cloud archival represents official corporate monthly sign-off and permanent record storage. Field reps or regional officers must not overwrite official cloud archives.
- **Consequence:** Google Drive API routes reject non-Super Admin calls with HTTP 403 Forbidden.

---

## ADR-006: Decoupled Central Calculation Engine
- **Date:** 2026-10-07
- **Status:** Accepted
- **Decision:** Centralize all mathematical business logic (totals, stock balances, valuations, STD, ADS, achievement %, projections) into a standalone TypeScript calculation engine (`calculation.service.ts`).
- **Context:** Prevents calculation discrepancies between the web dashboard, API responses, and exported spreadsheets.
- **Consequence:** React components may never compute sales totals or valuations internally; they must consume output from the shared calculation engine.

---

## ADR-007: Zero-Tolerance Date Safety in XLSX Import
- **Date:** 2026-10-07
- **Status:** Accepted
- **Decision:** Any conflict between the selected application date, filename date, sheet header date, and daily sheet number immediately blocks import.
- **Context:** Date confusion is the leading cause of historical record corruption in field distribution spreadsheets.
- **Consequence:** The system will never guess which date is correct; the import operation is aborted immediately until resolved by the user.

---

## ADR-008: Google Sheets as Synchronized Downstream Layer Only
- **Date:** 2026-10-07
- **Status:** Accepted
- **Decision:** Google Sheets integration is strictly one-way (PostgreSQL → Google Sheets) as an executive reporting view.
- **Context:** Direct two-way synchronization creates split-brain scenarios and bypasses validation and approval rules.
- **Consequence:** All operational entry must occur through the web application or the validated XLSX import pipeline.
