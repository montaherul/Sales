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

## 2. API Endpoints Catalog (22 Active Routes)

### 2.1 Administration & Organization (Super Admin)
- `GET /api/companies`: Server-side paginated list of companies with division, territory, and user statistics, search, and CSV export.
- `POST /api/companies`: Create new company entity.
- `PUT /api/companies`: Update company name and code.
- `DELETE /api/companies`: Delete company by ID or batch array.
- `GET /api/users`: Server-side paginated list of users filtered by company and role with search and CSV export.
- `POST /api/users`: Create user with company and territory scope (`SUPER_ADMIN`, `RSO`, `TSO`, `CSR`).
- `PUT /api/users`: Update user profile, role, and assigned scopes.
- `DELETE /api/users`: Delete user profile.
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

All administrative endpoints utilize `PaginationHelper` (`src/shared/database/pagination.ts`):

```typescript
const result = await PaginationHelper.paginate(
  baseSelect,
  fromClause,
  {
    page: 1,
    pageSize: 10,
    search: 'query',
    searchFields: ['name', 'code'],
    sortBy: 'created_at',
    sortOrder: 'desc',
    filters: { company_id: '...' }
  }
);
```

- Safe from SQL injection via indexed parameters (`$1, $2, ...`).
- When `?export=csv` is supplied, streaming CSV format is returned immediately with appropriate headers:
  `Content-Type: text/csv; charset=utf-8`
  `Content-Disposition: attachment; filename="Export.csv"`

---

## 4. Standardized Error Response Format

```json
{
  "success": false,
  "error": "Error message description",
  "code": "VALIDATION_ERROR"
}
```
