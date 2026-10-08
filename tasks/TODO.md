# TASKS BACKLOG (TODO)

## Phase 1: Core Foundation & Database
- [x] Initialize Next.js project with TypeScript, Tailwind CSS, shadcn/ui, and Lucide React.
- [x] Set up Supabase PostgreSQL database and run complete DDL migrations (`00001_initial_schema.sql` through `00005_menu_management.sql`).
- [x] Implement Row Level Security (RLS) helper functions and territory/region policies.
- [x] Seed master data: Roles (`SUPER_ADMIN`, `RSO`, `TSO`, `CSR`), permissions, companies, divisions, wings, regions, territories, brands, products, and prices.

## Phase 2: Central Calculation Engine & Shared Logic
- [x] Implement `@/modules/calculation/` with 9 standalone calculators (`SalesCalculator`, `StockCalculator`, `ZardaCalculator`, `STDCalculator`, `ADSCalculator`, `TargetCalculator`, `AchievementCalculator`, `ProjectionCalculator`, `VarianceCalculator`).
- [x] Unify all calculators behind `CalculationEngine` facade used across Dashboard, Reports, and Excel.
- [x] Implement date parsing and safety validator (`ImportValidationPipeline`) matching application date, filename date, header date, and sheet number.

## Phase 3: Authentication & Scoped Authorization
- [x] Configure Supabase Auth and role simulator context in `@/shared/auth`.
- [x] Implement fine-grained authorization policies and organizational scope validators (`@/shared/authorization`).
- [x] Enforce 4-tier user scoping (`GLOBAL`, `REGION`, `TERRITORY`, `OPERATIONAL`).

## Phase 4: Daily Operational Data Entry & Workflow
- [x] Build CSR daily data entry grid (`DailySalesGrid.tsx`) with generic Select2 territory picker and real-time totals row calculations.
- [x] Implement submission lifecycle state machine: `DRAFT` → `SUBMITTED` → `TSO_APPROVED` → `RSO_APPROVED` → `FINALIZED`.
- [x] Implement TSO territory review and approval queue (`ApprovalHub.tsx`).
- [x] Implement RSO regional verification queue.
- [x] Implement Super Admin locking and unlocking with mandatory reason logging.
- [x] Build version snapshotting into `submission_versions` and centralized `audit_logs` on every modification.

## Phase 5: Authoritative 34-Sheet Excel Generator
- [x] Integrate ExcelJS and build template cloner based on `excel/TEMPLATE.xlsx`.
- [x] Implement formula writer generating native Excel formulas for Days 1–31, `STD & ADS`, `Target.`, and `Analysis`.
- [x] Implement pre-export validation suite asserting 34 sheets, correct names, styles, and formula health.
- [x] Create export API endpoints `/api/exports/xlsx` and `/api/reports/monthly/export`.

## Phase 6: XLSX Import Engine & Date Safety
- [x] Build upload parser reading uploaded XLSX workbooks into sanitized data structures.
- [x] Implement strict pre-flight checks: 34 sheets, exact sheet names, date conflict detection, territory verification.
- [x] Build interactive import preview drawer displaying errors, warnings, duplicates, and record summaries.
- [x] Implement atomic database transaction with rollback on failure (`withTransaction`).

## Phase 7: Google Drive Archival & Sheets Sync
- [x] Implement Super Admin exclusive archival endpoint creating structured folders (`Afaz_Tobacco_Reports/YYYY/MM_Month/YYYY-MM-DD/`).
- [x] Add SHA-256 checksum verification and duplicate collision protection (`google_drive_files`).
- [x] Implement downstream Google Sheets synchronization endpoints.

## Phase 8: Analytics Dashboards & Audit Governance
- [x] Build Executive Analytics Dashboard using Recharts (MTD sales pacing, brand volume donut, territory leaderboard).
- [x] Build Audit Trail explorer displaying system events, filters, and JSON diffs (`AuditLogViewer.tsx`).

## Phase 9: 3-Tier Dynamic Architecture & Enterprise CRUD Suite
- [x] Build generic `ServerDataTable.tsx` with server-side pagination, search, sorting, multi-selection batch actions, and CSV export.
- [x] Build generic `Select2.tsx` with searchable dropdown, badges, icons, and single/multi selection.
- [x] Build unified single-page `DynamicCrudModal.tsx` for controller-driven create & edit operations.
- [x] Build Super Admin Company Management (`CompanyManagement.tsx`, `/api/companies`) with company-wise role scoping.
- [x] Build Company-Wise User Directory (`UserRoleManagement.tsx`, `/api/users`) with Select2 company filter and role assignment (`SUPER_ADMIN`, `RSO`, `TSO`, `CSR`).
- [x] Build Dynamic Hierarchy, Pricing & Targets CRUD Suite (`MasterHierarchyManagement.tsx`, `/api/hierarchy`, `/api/brands`, `/api/targets`).
- [x] Enhance Menu Management (`MenuManagement.tsx`, `/api/menu-management`) with Select2 user selection and persistent RWMA/UWMA rules.

## Phase 10: Company-Wise Scoping, Roles & Backend Isolation
- [x] Implement database migration `00009_company_wise_roles_and_scopes.sql` adding `roles.company_id`, consolidating `user_scopes`, and deploying `sp_get_roles_paginated` & `sp_get_users_paginated`.
- [x] Implement company-wise role management with company filter, company scoping for custom roles, and CSV export (`/api/roles`).
- [x] Implement hierarchical auto-resolution of company, region, and territory during user creation and updates (`/api/users`).
- [x] Enhance `DynamicCrudModal.tsx` with `onFieldChange` and non-destructive state merging for dynamic cascading dropdowns.
- [x] Upgrade `UserRoleManagement.tsx` with company filtering, role filtering, dynamic cascading Region (RSO) and Territory (TSO/CSR) selection, and company-wise role catalog.
- [x] Implement server-side company & territory boundary isolation for non-Super Admins in `/api/daily-submissions` and `validateOrganizationalScope`.
- [x] Enforce immutability and delete guards for `FINALIZED` records across UI and backend APIs per Rules 10 & 26.

## Phase 11: Multi-Tenant Enterprise SaaS & Full Tenant Isolation
- [x] Live PostgreSQL migration `00010_true_multitenant_saas.sql`: Added `company_id` to brands, working_days, targets, daily_submissions, audit_logs, google_drive_files, google_sheet_syncs.
- [x] PostgreSQL RLS functions & policies: `current_user_company_id()`, `can_access_company(company_id)`, `can_access_territory(territory_id)`.
- [x] Stored procedures updated: `sp_get_platform_stats()`, `sp_get_companies_paginated`, `sp_get_roles_paginated`, `sp_get_brands_paginated`, `sp_get_targets_paginated`, `sp_get_audit_logs_paginated`.
- [x] Tenant Administrator role (`COMPANY_ADMIN`) with full company-wide operational approval, finalization, unlock, user management, and pricing management.
- [x] Company Management UI with direct Company Admin creation modal, stats cards, and tenant lifecycle statuses.
- [x] Dynamic brand share and catalog aggregation across all tenants in `ExecutiveDashboard.tsx` and `MasterHierarchyManagement.tsx`.
- [x] Multi-tenant scoping in `DailySalesGrid.tsx`, `ApprovalHub.tsx`, `ImportModal.tsx`, `DriveUploadWidget.tsx`, `ExcelExportService.ts`, and `ReportingService.ts`.
- [x] Automated tenant isolation security test suite (`scripts/test_tenant_isolation.js`) passing 11/11 tests.
- [x] Resilient database connection pool with 30s timeout and keepAlive across international Supabase endpoints.
- [x] Next.js 15 production build passing with 0 errors across 31/31 routes.

## Phase 12: Comprehensive Dynamic Handling & Elimination of Static Fallbacks
- [x] Executive Dashboard (`ExecutiveDashboard.tsx`): Dynamically queries live targets and working days from PostgreSQL; eliminates hardcoded target estimates, hardcoded 26 working days, and static brand fallbacks.
- [x] Menu Management (`MenuManagement.tsx`): Dynamically incorporates `COMPANY_ADMIN` and merges any custom company roles fetched from `/api/roles?all=true`.
- [x] Master Data & Dynamic Working Days (`/api/master-data`): Dynamically queries `year` and `month` parameters and retrieves active working days per company.
- [x] Authoritative Excel Export (`/api/exports/xlsx` & `ExcelExportService.ts`): Replaces static mock data with live database queries for sales, closing stock, zarda sales/stock, and empty packets.
- [x] Google Drive Cloud Sync (`/api/google-drive/upload`): Uses `ExcelExportService` for dynamic 34-sheet report generation and dynamic month/year calculations.
- [x] Calculation Engine (`ZardaCalculator.ts` & `engine.ts`): Added dynamic unit price overrides for tenant brand catalogs.
- [x] Reporting Service & Repository (`ReportingService.ts` & `ReportingRepository.ts`): Dynamically calculates active elapsed days, targets, and working days without hardcoded constants.
- [x] Daily Sales Grid (`DailySalesGrid.tsx`): Dynamic territory lookup without hardcoded territory fallbacks.
- [x] Master Hierarchy (`MasterHierarchyManagement.tsx`): Purely dynamic region and brand dropdowns without hardcoded UUID fallbacks.
- [x] Automated Verification: Zero TypeScript errors (`npx tsc --noEmit`), 11/11 tenant isolation tests passing (`node scripts/test_tenant_isolation.js`), and clean Next.js 15.5 production build (`npm run build`).

## Phase 13: Strict Compliance with Generic Software Development Rules (`AGENTS1.md`)
- [x] Rule 15 (Validation): Updated `UserCreateInputSchema` in `src/shared/validation/index.ts` to include `COMPANY_ADMIN`, `companyId`, and `regionId`.
- [x] Rule 19 & Rule 41 (Error Handling & Reliability): Eliminated all silently swallowed exceptions across all API route handlers, services, and repositories; all unexpected errors are now logged through `logger.warn` or `logger.error`.
- [x] Rule 9 & 16 & 17 (SQL & Multi-Tenant Security): Verified 100% parameterized SQL query construction across `dbQuery` and server-side tenant boundary enforcement.
- [x] Rule 30 (Build and Verification): Verified zero TypeScript errors (`npx tsc --noEmit`), 11/11 tenant isolation tests passing (`test_tenant_isolation.js`), and Next.js 15 dev server running healthy on `http://localhost:3000`.

## Phase 14: Google Sheets API v4 Integration, Architecture Pipeline Completion & Scope Hardening
- [x] Implemented Google Sheets API v4 infrastructure adapter (`src/infrastructure/google/GoogleSheetsAdapter.ts`) with live PostgreSQL tracking to `google_sheet_syncs` table per `docs/11-GOOGLE-SHEETS.md` and `AGENTS.md` Rule 4 & 5.
- [x] Implemented Google Sheets application use cases (`src/modules/google-sheets/application/GoogleSheetsUseCases.ts`) with strict `SUPER_ADMIN` RBAC enforcement, company-scoped history retrieval, and audit logging.
- [x] Implemented thin Next.js route handler (`src/app/api/google-sheets/sync/route.ts`) for POST sync execution and GET sync history.
- [x] Enhanced Approval State Machine & Service (`ApprovalStateMachine.ts`, `ApprovalUseCases.ts`): Added `COMPANY_ADMIN` support for approval, rejection, and finalization within tenant; added `validateOrganizationalScope` enforcement; aligned `approval_history` schema columns and recorded `company_id` in audit logs.
- [x] Hardened Google Drive cloud sync (`GoogleDriveAdapter.ts`, `GoogleDriveUseCases.ts`, `/api/google-drive/upload`): Aligned schema columns (`drive_file_id`, `sha256_checksum`, `file_size`, `uploaded_by`, `report_date`, `company_id`), enforced server-side authentication, and eliminated client-trusted role flags.
- [x] Consolidated Daily Sales Repository (`DailySalesRepository.ts`): Unified with authoritative `SubmissionRepository` per `AGENTS1.md` Rule 11 (No Duplicate Abstractions).
- [x] Enforced server-side actor identity and structured logging (`logger.error`, `logger.warn`) across `/api/daily-submissions`, `/api/daily-submissions/workflow`, `/api/imports/xlsx/commit`, `/api/exports/xlsx`, and `/api/menu-management`.
- [x] Built and ran automated Google Sheets sync test suite (`scripts/test_google_sheets_sync.js`) passing 100% (Super Admin execution, sync history tracking, Company Admin HTTP 403 Forbidden).
- [x] Validated zero TypeScript compilation errors (`npx tsc --noEmit`) and 11/11 tenant isolation tests passing (`node scripts/test_tenant_isolation.js`).

