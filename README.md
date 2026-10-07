# Afaz Tobacco Sales & Stock Intelligence Platform

An enterprise-grade, secure, dynamic sales, stock, target tracking, approval, Excel import/export, and Google Drive intelligence platform built for **Afaz Tobacco Company**.

---

## 🌟 Executive Summary

The Afaz Tobacco Sales & Stock Intelligence Platform replaces error-prone, manual spreadsheet exchanges with a centralized, role-governed web application. Field representatives (CSR), territory supervisors (TSO), and regional officers (RSO) collaborate in real time while preserving the company's **authoritative 34-sheet Excel reporting workbook**.

---

## 🛠️ Technology Stack & 3-Tier Architecture

### Tier 1: Presentation Layer (Frontend)
- **Framework:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **Design System:** Custom Enterprise Dark Theme, Lucide React icons, Responsive Glassmorphism
- **Generic Components:**
  - `ServerDataTable`: Tabulator-style server-side table with pagination (10/25/50/100), multi-column search, column sorting, row selection checkboxes, select-all, and CSV export.
  - `Select2`: Searchable dropdown with async/static options, badges, sub-labels, icons, clearable trigger, and single/multi selection.
  - `DynamicCrudModal`: Unified single-page Create & Edit modal controller driven by schema and mode detection (`create` vs `edit`).
- **Data Visualization:** Recharts (Area charts, pacing curves, brand volume donuts)

### Tier 2: Application & Controller Layer (Backend)
- **API Architecture:** Next.js Route Handlers (`/api/*`), Service Layer Pattern, Selective Repositories
- **Modular Monolith & Clean Architecture:** Modules divided into Domain, Application, and Infrastructure layers under `src/modules/*`.
- **Calculations:** Centralized Calculation Engine (`src/modules/calculation`) containing 9 dedicated calculators (`SalesCalculator`, `StockCalculator`, `ZardaCalculator`, `STDCalculator`, `ADSCalculator`, `TargetCalculator`, `AchievementCalculator`, `ProjectionCalculator`, `VarianceCalculator`).
- **Excel Engine:** ExcelJS (Formula-preserving 34-sheet workbook generator strictly based on `excel/TEMPLATE.xlsx`).
- **Validation:** Zod schemas for runtime input validation and 12-step XLSX import verification.
- **Cloud Storage:** Google Drive API v3 (Super Admin controlled archiving with SHA-256 checksums).

### Tier 3: Database Layer (PostgreSQL)
- **Database:** Supabase PostgreSQL with Connection Pooling (AWS `ap-southeast-2` Pooler).
- **Security:** PostgreSQL Row Level Security (RLS) policies enforcing multi-tier data scoping.
- **Audit & Governance:** Centralized immutable `audit_logs` and version snapshots (`submission_versions`).

---

## 📂 Documentation Repository Architecture

To ensure precision and avoid architectural drift across AI agents and engineering teams, documentation is organized into modular specifications:

```text
d:/daily sales/
│
├── AGENTS.md                         # ⭐ MASTER RULES — AI reads this first
├── README.md                         # Human project overview
├── PROJECT_REQUIREMENTS.md           # Complete business requirements
│
├── docs/
│   ├── 01-PRODUCT-SPEC.md            # What the platform does & user personas
│   ├── 02-ARCHITECTURE.md            # Technical architecture & 3-tier service layers
│   ├── 03-DATABASE.md                # PostgreSQL schema, DDL & relationships
│   ├── 04-AUTH-RBAC.md               # Auth, roles, permissions, scopes & RLS
│   ├── 05-BUSINESS-RULES.md          # All enterprise business rules
│   ├── 06-DAILY-DATA-WORKFLOW.md     # CSR → TSO → RSO approval workflow
│   ├── 07-IMPORT-SPEC.md             # XLSX import pipeline & validation
│   ├── 08-EXPORT-SPEC.md             # Exact 34-sheet XLSX export specification
│   ├── 09-EXCEL-FORMULAS.md          # Formula definitions & TypeScript engine
│   ├── 10-GOOGLE-DRIVE.md            # Drive structure & Super Admin upload rules
│   ├── 11-GOOGLE-SHEETS.md           # Sheets synchronization layer
│   ├── 12-FRONTEND.md                # UI/UX design system & guidelines
│   ├── 13-BACKEND.md                 # API endpoints, services & repositories
│   ├── 14-SECURITY.md                # Data protection, RLS & secret management
│   ├── 15-AUDIT-VERSIONING.md        # Audit logging & revision history
│   ├── 16-REPORTING.md               # Analytics dashboards & performance KPIs
│   ├── 17-TESTING.md                 # Testing strategy (unit, RLS, Excel, E2E)
│   ├── 18-DEPLOYMENT.md              # Deployment configuration & environment
│   └── DECISIONS.md                  # Architecture Decision Records (ADRs)
│
├── excel/
│   ├── TEMPLATE.xlsx                 # ⭐ Authoritative 34-sheet reporting workbook
│   └── EXCEL-MAPPING.md              # Exact cell/coordinate mapping catalog
│
└── tasks/
    ├── TODO.md                       # Pending backlog & milestones (100% Completed)
    ├── IN-PROGRESS.md                # Currently active work items
    └── DONE.md                       # Completed features & validations
```

---

## 🔌 Live Backend API Endpoints (Tier 2)

| Route Handler | Methods | Description |
|---|---|---|
| `/api/companies` | `GET`, `POST`, `PUT`, `DELETE` | Full company CRUD, hierarchy stats, server-side pagination & CSV export |
| `/api/users` | `GET`, `POST`, `PUT`, `DELETE` | Company-wise user directory, role scopes (`SUPER_ADMIN`, `RSO`, `TSO`, `CSR`) & CSV export |
| `/api/hierarchy` | `GET`, `POST`, `PUT`, `DELETE` | Territory and geographical scope CRUD with parent company & region lookup |
| `/api/brands` | `GET`, `POST`, `PUT`, `DELETE` | Brand catalog & pricing CRUD with category filtering (Cigarette / Zarda) |
| `/api/targets` | `GET`, `POST`, `PUT`, `DELETE` | Monthly territory brand targets with route & outlet counts |
| `/api/menu-management` | `GET`, `POST` | Role-Wise Menu Access (RWMA) and User-Wise Menu Access (UWMA) permissions |
| `/api/daily-sales` | `GET`, `POST` | Scope-validated daily operational submissions |
| `/api/daily-submissions/workflow` | `POST` | State transitions (`DRAFT` → `SUBMITTED` → `TSO_APPROVED` → `RSO_APPROVED` → `FINALIZED` / `REJECT` / `UNLOCK`) |
| `/api/reports` | `GET` | Executive KPI summaries and territory run-rate metrics |
| `/api/reports/monthly/export` | `POST` | Streams generated 34-sheet monthly workbook |
| `/api/exports/xlsx` | `GET` | Direct download of authoritative 34-sheet Excel report |
| `/api/imports/xlsx` | `POST` | 12-step validation & preview for XLSX imports |
| `/api/imports/xlsx/commit` | `POST` | Atomic transactional database commit for staged imports |
| `/api/google-drive/upload` | `POST` | Super Admin SHA-256 cloud archive to structured Google Drive folders |
| `/api/audit-logs` | `GET` | Paginated query of immutable system audit logs |
| `/api/master-data` | `GET` | Master territories, brands, users, and targets reference |

---

## 📊 Core Data Workflow

```text
Field Entry (CSR)
   │
   ▼
Territory Verification (TSO)
   │
   ▼
Regional Verification (RSO)
   │
   ▼
Super Admin Finalization (Locked)
   │
   ├─► Centralized Calculation Engine
   ├─► Dynamic Web Analytics & Dashboard
   ├─► Authoritative 34-Sheet XLSX Export
   └─► Google Drive Enterprise Cloud Archive (Super Admin Only)
```

---

## 🔒 Security & Data Scope Principle

Authentication answers **who you are** (via Google OAuth / Supabase).  
Permissions answer **what you can do** (`sales.create`, `sales.approve`, etc.).  
Data Scope answers **which data you can touch** (`company_id`, `region_id`, `territory_id`).

Every database query and mutation is protected by **PostgreSQL Row Level Security (RLS)** ensuring field officers can never access or modify records outside their assigned operational boundary.

---

## 🚀 Getting Started

1. **Review Instructions:** AI agents must read [AGENTS.md](file:///d:/daily%20sales/AGENTS.md) and [PROJECT_REQUIREMENTS.md](file:///d:/daily%20sales/PROJECT_REQUIREMENTS.md).
2. **Inspect Template:** View [TEMPLATE.xlsx](file:///d:/daily%20sales/excel/TEMPLATE.xlsx) and review [EXCEL-MAPPING.md](file:///d:/daily%20sales/excel/EXCEL-MAPPING.md).
3. **Environment Setup:** Configure `.env.local` with Supabase credentials.
4. **Development Server:** Run `npm run dev` to launch the local development server at `http://localhost:3000`.
5. **Production Build:** Run `npm run build` to verify clean compilation across all 22 static and dynamic routes.
