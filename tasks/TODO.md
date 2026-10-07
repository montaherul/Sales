# TASKS BACKLOG (TODO)

## Phase 1: Core Foundation & Database
- [ ] Initialize Next.js project with TypeScript, Tailwind CSS, shadcn/ui, and Lucide React.
- [ ] Set up Supabase PostgreSQL database and run complete DDL migrations from `docs/03-DATABASE.md`.
- [ ] Implement Row Level Security (RLS) helper functions and territory/region policies (`docs/04-AUTH-RBAC.md`).
- [ ] Seed master data: Roles (`SUPER_ADMIN`, `RSO`, `TSO`, `CSR`), permissions, companies, divisions, wings, regions, territories, brands, products, and prices.

## Phase 2: Central Calculation Engine & Shared Logic
- [ ] Implement `@/lib/calculations/engine.ts` supporting Cigarette sums, Zarda valuations, STD, ADS, Achievement %, and Projections.
- [ ] Write unit test suite (`engine.test.ts`) covering all formula rules from `docs/09-EXCEL-FORMULAS.md`.
- [ ] Implement date parsing and safety validator (`date-safety.ts`) matching application date, filename date, header date, and sheet number.

## Phase 3: Authentication & Scoped Authorization
- [ ] Configure Supabase Auth with Google OAuth provider.
- [ ] Implement server-side auth middleware resolving user profiles, roles, and geographical scopes (`user_scopes`).
- [ ] Create `@/lib/auth/rbac.ts` utility for fine-grained permission and scope checks across Server Actions and Route Handlers.

## Phase 4: Daily Operational Data Entry & Workflow
- [ ] Build CSR daily data entry grid (`DailySalesGrid.tsx`) with real-time totals row calculations.
- [ ] Implement submission lifecycle state transitions: `DRAFT` → `SUBMITTED` → `TSO_APPROVED` → `RSO_APPROVED` → `FINALIZED`.
- [ ] Implement TSO territory review and approval queue (`ApprovalHub.tsx`).
- [ ] Implement RSO regional verification queue.
- [ ] Implement Super Admin locking and unlocking with mandatory reason logging.
- [ ] Build version snapshotting into `submission_versions` on every modification.

## Phase 5: Authoritative 34-Sheet Excel Generator
- [ ] Integrate ExcelJS and build template cloner based on `excel/TEMPLATE.xlsx`.
- [ ] Implement population engine generating dynamic formulas for Days 1–31, `STD & ADS`, `Target.`, and `Analysis`.
- [ ] Implement pre-export validation suite asserting 34 sheets, correct names, styles, and formula health.
- [ ] Create export API endpoint `/api/exports/xlsx` streaming the generated file.

## Phase 6: XLSX Import Engine & Date Safety
- [ ] Build upload parser reading uploaded XLSX workbooks into sanitized data structures.
- [ ] Implement strict pre-flight checks: 34 sheets, exact sheet names, date conflict detection, territory verification.
- [ ] Build interactive import preview drawer displaying errors, warnings, and record summaries.
- [ ] Implement atomic database transaction with rollback on failure.

## Phase 7: Google Drive Archival & Sheets Sync
- [ ] Set up Google Drive API v3 client with Service Account / OAuth credentials.
- [ ] Implement Super Admin exclusive archival endpoint creating structured folders (`Afaz_Tobacco_Reports/YYYY/MM_Month/YYYY-MM-DD/`).
- [ ] Add SHA-256 checksum verification and duplicate collision protection.
- [ ] Implement downstream Google Sheets synchronization engine.

## Phase 8: Analytics Dashboards & Audit Governance
- [ ] Build Executive Analytics Dashboard using Recharts (MTD sales pacing, brand volume donut, territory leaderboard).
- [ ] Build Audit Trail explorer displaying system events, filters, and JSON diffs.
- [ ] Conduct end-to-end testing across all user personas.
