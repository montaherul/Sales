# 02 - TECHNICAL ARCHITECTURE (3-TIER MODULAR MONOLITH)

## 1. System Architecture Overview

The Afaz Tobacco Sales & Stock Intelligence Platform is architected as a **3-Tier Modular Monolith following Clean Architecture principles**.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   TIER 1: PRESENTATION LAYER (FRONTEND)                │
│                                                                        │
│  • Generic ServerDataTable (Tabulator-style Server-side Table)         │
│    - Server-side Pagination (10, 25, 50, 100 per page)                 │
│    - Server-side Search (Debounced multi-column LIKE search)           │
│    - Server-side Sorting (ASC / DESC on headers)                       │
│    - Server-side Multi-Selection (Row checkboxes, Select All, Batch)  │
│    - Server-side Export (Streaming CSV download)                       │
│                                                                        │
│  • Generic Select2:                                                    │
│    - Searchable, clearable dropdown with badges, icons, single/multi   │
│                                                                        │
│  • Unified Single-Page DynamicCrudModal:                               │
│    - Controller-driven Create & Edit inside a single component         │
│                                                                        │
│  • Collapsible Enterprise Sidebar & Strictly Scoped Navbar             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS / REST (Clean DTOs & JSON)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             TIER 2: APPLICATION & CONTROLLER LAYER (BACKEND)           │
│                                                                        │
│  • Next.js Route Handlers (RESTful Controllers):                       │
│    - /api/companies   (Company CRUD + Stats + CSV Export)              │
│    - /api/users       (Company-Wise User CRUD + Scopes + CSV Export)   │
│    - /api/hierarchy   (Territory, Region, Division CRUD + CSV Export)  │
│    - /api/brands      (Brand Catalog & Pricing CRUD + CSV Export)      │
│    - /api/targets     (Territory Target CRUD + CSV Export)             │
│    - /api/menu-management (RWMA & UWMA Permissions Matrix)             │
│    - /api/daily-sales (Operational entries + Zod validation)           │
│    - /api/approvals   (Approval State Machine transitions)             │
│    - /api/reports     (Executive KPIs & monthly reporting)             │
│                                                                        │
│  • PaginationHelper:                                                   │
│    - Parameterized SQL generation to prevent SQL injection             │
│    - Dynamic filtering, sorting, total counts, and CSV serialization   │
│                                                                        │
│  • Centralized Calculation Engine:                                     │
│    - 9 dedicated calculators (Sales, Stock, Zarda, STD, ADS, Target,   │
│      Achievement, Projection, Variance) behind CalculationEngine facade│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Live Connection Pool (SSL / IPv4 Pooler)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   TIER 3: DATABASE LAYER (POSTGRESQL)                  │
│                                                                        │
│  • Supabase PostgreSQL (AWS ap-southeast-2 Pooler):                    │
│    - companies, divisions, wings, regions, territories                 │
│    - user_profiles, user_scopes, roles, system_menus                   │
│    - brands, prices, targets, daily_submissions, audit_logs            │
│  • PostgreSQL Row Level Security (RLS) & Cascading Foreign Keys        │
│  • Centralized Immutable Audit Trail (`audit_logs`)                    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 3-Tier Layer Specifications

### 2.1 Tier 1: Presentation Layer (Frontend)
- **Framework:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS.
- **Generic ServerDataTable (`ServerDataTable.tsx`):** Tabulator-style table with server-side pagination, search, sorting, multi-selection batch delete, and CSV export.
- **Generic Select2 (`Select2.tsx`):** Searchable dropdown with async/static options, badges, sub-labels, and single/multi selection used everywhere across the application.
- **Unified Single-Page DynamicCrudModal (`DynamicCrudModal.tsx`):** Single-page form controller that handles both Create and Edit based on `mode` detection (`mode === 'create'` vs `mode === 'edit'`).
- **Data Visualization:** Recharts for sales pacing curves, brand volume donuts, and territory leaderboards.

### 2.2 Tier 2: Application & Controller Layer (Backend)
All business operations and API routes are implemented as pure TypeScript services with clean DTOs and selective repositories:
1. **Company Controller (`/api/companies`):** Manages enterprise root companies, division counts, territory counts, and assigned user statistics.
2. **User Controller (`/api/users`):** Manages company-wise user directory and role scoping (`SUPER_ADMIN`, `RSO`, `TSO`, `CSR`).
3. **Hierarchy Controller (`/api/hierarchy`):** Manages dynamic 8-level hierarchy (Company → Division → Wing → Region → Territory → Route → Outlet).
4. **Brand Controller (`/api/brands`):** Manages brand catalog (Cigarette 6 brands, Zarda 4 brands) and unit pricing.
5. **Target Controller (`/api/targets`):** Manages monthly territory targets with route and outlet counts.
6. **Menu Access Controller (`/api/menu-management`):** Manages Role-Wise Menu Access (RWMA) and User-Wise Menu Access (UWMA).
7. **Calculation Engine Facade (`CalculationEngine.ts`):** Central source of mathematical truth unifying Dashboard, Reports, and Excel generation.
8. **Approval State Machine (`ApprovalStateMachine.ts`):** Governs submission lifecycle transitions (`DRAFT` → `SUBMITTED` → `TSO_APPROVED` → `RSO_APPROVED` → `FINALIZED`), rejections with mandatory reason, and Super Admin unlock.
9. **Export Service (`ExcelExportService.ts`):** Clones `excel/TEMPLATE.xlsx` using ExcelJS, injects dynamic formulas, styles, and builds the full 34-sheet workbook.
10. **Import Service (`ExcelImportService.ts`):** Implements 12 validation steps, date safety check, duplicate detection, and atomic transactional commit.
11. **Google Drive Adapter (`GoogleDriveAdapter.ts`):** Manages SHA-256 verified cloud archives strictly restricted to `SUPER_ADMIN`.
12. **Audit Service (`AuditService.ts`):** Writes immutable audit logs and version diffs.

### 2.3 Tier 3: Database Layer (PostgreSQL)
- Relational PostgreSQL hosted on Supabase (AWS `ap-southeast-2` Pooler).
- Every table enforces Row Level Security (RLS) policies based on `auth.uid()` and `user_scopes`.
- Critical multi-table operations run inside PostgreSQL transactions (`withTransaction(async client => ...)`).

---

## 3. Centralized Calculation Engine

A critical architectural mandate is that **no mathematical business logic may reside inside React components**.

```text
Database Raw Records (Sales, Stock, Targets)
                   │
                   ▼
     Central Calculation Engine
                   │
      ┌────────────┴────────────┐
      ▼                         ▼
Web UI & Dashboards       ExcelJS 34-Sheet Generator
(Evaluated KPIs)         (Formula Generation + References)
```

By decoupling calculations into 9 dedicated calculators:
- `SalesCalculator`: Sum of 6 cigarette brands (`=SUM(D8:I8)`)
- `StockCalculator`: Sum of 6 cigarette closing stocks (`=SUM(K8:P8)`)
- `ZardaCalculator`: Valuation in BDT for Zarda sales and stock (`=S8*15+T8*6+U8*8`)
- `STDCalculator`: Cumulative Sales-To-Date aggregation
- `ADSCalculator`: Average Daily Sales (`Volume / Working Days`)
- `TargetCalculator`: Target volume and remaining daily ADS requirements
- `AchievementCalculator`: Achievement percentage (`(STD / Target) * 100`)
- `ProjectionCalculator`: Projected month-end volume (`Period ADS * Working Days`) and growth rate
- `VarianceCalculator`: Volume and percentage variances

---

## 4. Source of Truth Hierarchy

```text
PRIMARY SOURCE OF TRUTH: Supabase PostgreSQL Database
                    │
                    ├──► Reporting Artifact: 34-Sheet XLSX Export (ExcelJS)
                    │
                    ├──► Reporting Sync Layer: Google Sheets
                    │
                    └──► Cold Storage / Cloud Archival: Google Drive (Super Admin Only)
```

- Excel files and Google Sheets are downstream read-only reporting artifacts generated from PostgreSQL.
- Excel files imported into the system are parsed, validated, and converted into raw database entities before any calculation engine recalculation is performed.
