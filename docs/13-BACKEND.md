# 13 - BACKEND API & SERVICE ARCHITECTURE

## 1. Backend Service Layer Pattern

The backend is structured into clean, decoupled layers using Next.js Route Handlers and Server Actions:

```text
HTTP Request
     │
     ▼
Route Handler / Controller (/api/*)
     │
     ▼
Authentication & Scoped Authorization Middleware
     │
     ▼
Zod Input Validation (Fail Fast)
     │
     ▼
Application Service Layer (Use Cases & Workflows)
     │
     ▼
Domain Rules & Centralized Calculation Engine
     │
     ▼
Repository Layer (Parameterized Queries & Transactions)
     │
     ▼
Supabase PostgreSQL Database
```

---

## 2. API Endpoints Catalog (23 Active Routes)

### 2.1 Platform Administration & Multi-Tenant Management
- `GET /api/platform/stats`: Super Admin aggregate multi-tenant platform statistics (total/active/suspended companies, total staff, territories, submissions, MTD volume).
- `GET /api/companies`: Server-side paginated list of companies with division, territory, user statistics, lifecycle status (`ACTIVE`/`TRIAL`/`SUSPENDED`/`INACTIVE`), plan (`STARTER`/`PRO`/`ENTERPRISE`), currency, timezone, and CSV export.
- `POST /api/companies`: Provision new tenant company with default settings.
- `PUT /api/companies`: Update company metadata, lifecycle status, plan, currency, and timezone.
- `DELETE /api/companies`: Decommission company by ID or batch array.
- `GET /api/users`: Server-side paginated list of users filtered by company and role with search and CSV export (`SUPER_ADMIN` sees all; `COMPANY_ADMIN` sees own company only).
- `POST /api/users`: Create user with company and territory scope (`SUPER_ADMIN`, `COMPANY_ADMIN`, `RSO`, `TSO`, `CSR`).
- `PUT /api/users`: Update user profile, role, and assigned scopes.
- `DELETE /api/users`: Delete user profile (cross-company deletion blocked for non-Super Admins).
- `GET /api/hierarchy`: Server-side paginated list of territories with parent company, region, division, and CSV export.
- `POST /api/hierarchy`: Create territory linked to region.
- `PUT /api/hierarchy`: Update territory name, region, or sort order.
- `DELETE /api/hierarchy`: Delete territory.
- `GET /api/brands`: Server-side paginated brand catalog with unit prices, category (Cigarette / Zarda), and CSV export.
- `POST /api/brands`: Create brand and effective price.
- `PUT /api/brands`: Update brand name, price, or active status.
- `DELETE /api/brands`: Delete brand.
- `GET /api/targets`: Server-side paginated monthly territory brand targets with route and outlet counts and CSV export.
- `POST /api/targets`: Upsert monthly target for a territory and brand.
- `DELETE /api/targets`: Delete target record.
- `GET /api/menu-management`: Retrieve system menus, Role-Wise Menu Access (RWMA), and User-Wise Menu Access (UWMA).
- `POST /api/menu-management`: Update RWMA or UWMA rules with persistence to PostgreSQL.

### 2.2 Daily Submissions & Operational Data
- `GET /api/daily-sales`: List daily entries filtered by date with calculation totals.
- `POST /api/daily-sales`: Save daily operational entry with Zod validation and scope check.
- `GET /api/daily-submissions`: Query submissions by date and territory.
- `POST /api/daily-submissions`: Save submission with version snapshotting.
- `POST /api/daily-submissions/workflow`: Transition submission state (`DRAFT` → `SUBMITTED` → `TSO_APPROVED` → `RSO_APPROVED` → `FINALIZED` / `REJECT` / `UNLOCK`).
- `POST /api/approvals`: Approval State Machine transition endpoint.

### 2.3 Reporting, Import & Export
- `GET /api/reports`: Executive KPI summary and territory performance metrics.
- `POST /api/reports/monthly/export`: Generate and stream the authoritative 34-sheet monthly Excel workbook.
- `GET /api/exports/xlsx`: Direct download of 34-sheet workbook matching `excel/TEMPLATE.xlsx`.
- `POST /api/imports/xlsx`: Upload workbook, perform 12-step validation, and return preview.
- `POST /api/imports/xlsx/commit`: Execute atomic transaction with rollback on failure.
- `POST /api/google-drive/upload`: Super Admin exclusive cloud upload to structured folders (`Afaz_Tobacco_Reports/YYYY/MM_Month/YYYY-MM-DD/`).
- `GET /api/audit-logs`: Query immutable audit logs with pagination and event filtering.
- `GET /api/master-data`: Retrieve static/cached master reference data.

---

## 3. Server-Side Pagination & Search Specifications

### 3. PostgreSQL Stored Procedures / Functions Architecture (Database Tier 3)

All server-side listings are executed via native PostgreSQL Stored Functions (`supabase/migrations/00006_stored_procedures.sql`), ensuring pre-compiled query plans, atomic counting, and elimination of SQL injection:

1. `sp_get_companies_paginated(p_page, p_page_size, p_search, p_sort_by, p_sort_order)`
2. `sp_get_users_paginated(p_page, p_page_size, p_search, p_company_id, p_role_name, p_sort_by, p_sort_order)`
3. `sp_get_daily_submissions_paginated(p_page, p_page_size, p_search, p_report_date, p_territory_id, p_status, p_company_id, p_sort_by, p_sort_order)`
4. `sp_get_territories_paginated(p_page, p_page_size, p_search, p_region_id, p_company_id, p_sort_by, p_sort_order)`
5. `sp_get_brands_paginated(p_page, p_page_size, p_search, p_type, p_sort_by, p_sort_order)`
6. `sp_get_targets_paginated(p_page, p_page_size, p_search, p_year, p_month, p_territory_id, p_sort_by, p_sort_order)`
7. `sp_get_audit_logs_paginated(p_page, p_page_size, p_search, p_event_type, p_user_id, p_start_date, p_end_date, p_sort_by, p_sort_order)`

Invoked in TypeScript controllers via `PaginationHelper.executeFunction()`:

```typescript
const result = await PaginationHelper.executeFunction(
  'sp_get_companies_paginated',
  [page, pageSize, search || null, sortBy, sortOrder]
);
```

- Each procedure returns a structured `JSONB` document containing `{ items: [...], totalCount, page, pageSize, totalPages }`.
- When `pageSize <= 0` (export mode), all records are streamed into RFC-compliant CSV via `PaginationHelper.toCsv()`.


---

## 4. Standardized Error Response Format

```json
{
  "success": false,
  "error": "Error message description",
  "code": "VALIDATION_ERROR"
}
```
