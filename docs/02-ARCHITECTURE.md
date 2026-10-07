# 02 - TECHNICAL ARCHITECTURE

## 1. System Architecture Overview

The Afaz Tobacco Sales & Stock Intelligence Platform is architected as a modern, decoupled full-stack application utilizing Next.js (App Router), Supabase PostgreSQL, and cloud service integrations.

```
┌────────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                             │
│      Next.js App Router • React 19 • Tailwind CSS • shadcn/ui          │
│          TanStack Table • TanStack Query • Recharts • Lucide           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   SERVER-SIDE AUTHORIZATION & MIDDLEWARE                │
│    Next.js Middleware • Supabase Auth Session • Scoped RBAC Check      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                             SERVICE LAYER                              │
│  ┌──────────────────────┐ ┌──────────────────────┐ ┌────────────────┐  │
│  │  Calculation Engine  │ │   Workflow Service   │ │ Import Service │  │
│  └──────────────────────┘ └──────────────────────┘ └────────────────┘  │
│  ┌──────────────────────┐ ┌──────────────────────┐ ┌────────────────┐  │
│  │ 34-Sheet Export Svc  │ │ Google Drive Service │ │ Audit Service  │  │
│  └──────────────────────┘ └──────────────────────┘ └────────────────┘  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      DATA ACCESS & REPOSITORY LAYER                    │
│      Parameterized Queries • Database Transactions • Zod Schemas       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       SUPABASE POSTGRESQL DATABASE                     │
│    PostgreSQL 16 • Row Level Security (RLS) • Normalized Schema        │
│       Foreign Keys • Unique Constraints • Audit Triggers & History     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
         ┌──────────────────────────┴──────────────────────────┐
         ▼                                                     ▼
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│     GOOGLE DRIVE API (v3)       │           │     GOOGLE SHEETS API (v4)      │
│  Super Admin Archival Storage   │           │    Reporting & Sync Artifacts   │
└─────────────────────────────────┘           └─────────────────────────────────┘
```

---

## 2. Layered Architecture Details

### 2.1 Presentation Layer (Frontend)
- **Framework:** Next.js with React Server Components (RSC) and Client Components where interactivity is required.
- **Component System:** shadcn/ui built on Radix UI primitives.
- **Data Grids:** TanStack Table for high-performance rendering of multi-brand sales entry grids.
- **Data Fetching & Caching:** TanStack Query for optimistic updates, cache invalidation, and background synchronization.
- **Visualization:** Recharts for sales pacing, territory comparison, and target achievement graphs.

### 2.2 Security & Authorization Middleware
- Extracts JWT from HTTP-only cookies verified by Supabase Auth.
- Validates user identity and resolves the user's role and assigned geographical scopes (`company_id`, `region_id`, `territory_id`).
- Rejects unauthorized requests at the server edge before reaching business services.

### 2.3 Service Layer
All business rules and operations are centralized in pure TypeScript services:
1. **Calculation Engine (`calculation.service.ts`):** Central source of mathematical truth for both the UI and Excel generation (sums, STD, ADS, valuations, target achievement).
2. **Daily Workflow Service (`workflow.service.ts`):** Governs submission lifecycle transitions (`DRAFT` → `SUBMITTED` → `TSO_APPROVED` → `RSO_APPROVED` → `FINALIZED`).
3. **Import Service (`import.service.ts`):** Validates uploaded workbooks, compares dates across filename/sheet/user inputs, and manages atomic imports.
4. **Export Service (`export.service.ts`):** Clones `excel/TEMPLATE.xlsx` using ExcelJS, injects dynamic formulas, styles, and builds the full 34-sheet workbook.
5. **Google Drive Service (`drive.service.ts`):** Manages OAuth2 / Service Account uploads strictly restricted to `SUPER_ADMIN`.
6. **Audit Service (`audit.service.ts`):** Writes immutable audit logs and version diffs for compliance.

### 2.4 Data Access & Database Layer
- Relational PostgreSQL hosted on Supabase.
- Every table enforces Row Level Security (RLS) policies based on `auth.uid()` and `user_scopes`.
- Critical multi-table operations (e.g., daily submission approval, bulk Excel import) run inside PostgreSQL transactions (`BEGIN...COMMIT / ROLLBACK`).

---

## 3. Calculation Engine Decoupling

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

By decoupling calculations into a shared engine:
- The web dashboard and the exported Excel workbook always produce identical results.
- Changes to formulas (e.g., working day defaults or price revisions) are updated in one place.
- Regression testing is straightforward with pure unit tests.

---

## 4. Source of Truth Hierarchy

```text
PRIMARY SOURCE OF TRUTH: Supabase PostgreSQL Database
                    │
                    ├──► Reporting Artifact: 34-Sheet XLSX Export (ExcelJS)
                    │
                    ├──► Reporting Sync Layer: Google Sheets
                    │
                    └──► Cold Storage / Cloud Archival: Google Drive
```

- Excel files and Google Sheets are downstream read-only reporting artifacts generated from PostgreSQL.
- Excel files may be imported into PostgreSQL, but they are parsed, validated, and converted into raw database entities before any business calculation is performed.
