# AGENTS.md

# Afaz Tobacco Sales & Stock Intelligence Platform

You are the primary AI software engineering agent for this project.

You are responsible for implementing, reviewing, debugging, testing, and maintaining a production-grade enterprise sales, stock, target, analysis, approval, Excel import/export, Google Sheets, and Google Drive platform.

---

# 1. NON-NEGOTIABLE RULES

## 1.1 Read Documentation First

Before modifying code:

1. Read `AGENTS.md`.
2. Read the relevant documentation in `/docs`.
3. Inspect the existing codebase.
4. Inspect existing database/schema.
5. Inspect the authoritative Excel template (`excel/TEMPLATE.xlsx`).
6. Understand existing functionality before replacing anything.

Never blindly rewrite working functionality.

---

# 2. AUTHORITATIVE EXCEL TEMPLATE

The uploaded workbook:

`excel/TEMPLATE.xlsx`

is the authoritative Excel reporting template.

The application MUST preserve its:

- Sheet structure
- Sheet names
- Sheet order
- Formulas
- Formula relationships
- Merged cells
- Borders
- Fonts
- Colors
- Number formats
- Alignment
- Column widths
- Row heights
- Header structure
- Data hierarchy
- Calculations
- Reporting logic

Do NOT redesign the workbook.

Do NOT simplify the workbook.

Do NOT rename sheets without explicit approval.

---

# 3. REQUIRED WORKBOOK STRUCTURE

A full monthly workbook must contain exactly 34 sheets:

1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
STD & ADS
Target.
Analysis

The application must generate all 34 sheets.

---

# 4. SOURCE OF TRUTH

The PostgreSQL database is the primary source of truth.

Excel is a reporting artifact.

Google Sheets is a synchronization/reporting layer.

Google Drive is controlled file storage.

Never use Excel or Google Sheets as the primary transactional database.

Architecture:

Database
→ Calculation Engine
→ Web Application
→ XLSX Export
→ Google Sheets
→ Google Drive

---

# 5. TECHNOLOGY PRINCIPLES

Preferred stack:

Frontend:
- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query
- TanStack Table

Backend:
- Next.js server/API architecture & Server Actions
- Server-side authorization
- Service layer
- Repository/data-access layer

Database:
- Supabase PostgreSQL

Authentication:
- Supabase Auth
- Google OAuth

Authorization:
- RBAC
- Permissions
- Data scopes
- PostgreSQL Row Level Security (RLS)

Excel:
- ExcelJS

Validation:
- Zod

Charts:
- Recharts

Google:
- Google Drive API v3
- Google Sheets API v4

---

# 6. ROLE SYSTEM

The initial roles are:

SUPER_ADMIN
RSO
TSO
CSR

The architecture must support future roles.

Never hard-code authorization throughout the frontend.

Use:

Permission
+
Role
+
Data Scope

---

# 7. ROLE RESPONSIBILITIES

## SUPER_ADMIN

Full system access.

Can:

- Manage users
- Manage roles
- Manage permissions
- Manage regions
- Manage territories
- Manage routes
- Manage outlets
- Manage products
- Manage brands
- Manage prices
- Manage targets
- Manage working days
- View all sales
- Edit authorized data
- Approve/reject
- Import
- Export
- Download
- Upload to Google Drive
- Manage Google Drive
- Manage Google Sheets
- View audit logs
- Manage system settings

Only SUPER_ADMIN may perform final Google Drive uploads.

---

## RSO (Regional Sales Officer)

Regional scope.

Can:

- View assigned region
- View assigned territories
- View TSO performance
- View CSR performance
- Review daily data
- Edit permitted data
- Approve
- Reject
- Export
- Download

Cannot access unrelated regions.

Cannot manage global system configuration.

Cannot upload final reports to Google Drive.

---

## TSO (Territory Sales Officer)

Territory scope.

Can:

- View assigned territory
- View all assigned CSR data
- Enter permitted operational data
- Edit permitted data
- Verify
- Approve
- Reject
- View sales
- View stock
- View target
- View STD
- View ADS
- View analysis
- Export
- Download

Cannot access unrelated territories.

---

## CSR (Customer/Customer Sales Representative)

Operational entry scope.

Can:

- Create daily sales
- Create closing stock
- Create zarda data
- Create empty packet data
- Add remarks
- Save draft
- Edit draft
- Submit
- View own submission history
- View own status

Cannot:

- Approve
- Reject
- Modify targets
- Modify formulas
- Manage users
- Upload to Drive
- Modify other CSR data

---

# 8. DATA SCOPE

RBAC alone is insufficient.

Every user must have a scope.

Example:

TSO A:
role = TSO
territory = Kerani Hat

TSO A must not be able to access Bandarban even if:
sales.view = true

The authorization model is:

User
→ Role
→ Permissions
→ Scope
→ Database RLS
→ API authorization

---

# 9. ORGANIZATIONAL HIERARCHY

The hierarchy must be dynamic:

Company
→ Division
→ Wing
→ Region
→ Territory
→ Route
→ Outlet
→ CSR

Never hard-code organizational names in business logic.

---

# 10. DAILY DATA WORKFLOW

The standard workflow is:

CSR
→ Draft
→ Submit
→ TSO Review
→ TSO Approved
→ RSO Review
→ RSO Approved
→ Finalized

Rejection:

Submitted
→ Rejected
→ Edit
→ Resubmit

Once finalized, normal users cannot modify the data.

SUPER_ADMIN may unlock finalized records with a mandatory reason.

---

# 11. VERSIONING

Never silently overwrite historical data.

Every important modification must preserve history.

Track:

- Version
- User
- Timestamp
- Old value
- New value
- Reason
- Status

---

# 12. AUDIT LOGGING

Audit important operations:

- Login
- Logout
- User creation
- User update
- Role changes
- Permission changes
- Sales creation
- Sales update
- Stock update
- Import
- Export
- Approval
- Rejection
- Finalization
- Unlock
- Target changes
- Master data changes
- Drive upload
- Drive replacement

---

# 13. IMPORT RULE

Never blindly import XLSX.

The import process must be:

Upload
→ Parse
→ Validate workbook
→ Validate sheet structure
→ Validate month
→ Validate year
→ Validate date
→ Validate region
→ Validate territory
→ Validate user scope
→ Validate duplicate
→ Validate values
→ Validate required fields
→ Preview
→ Explicit confirmation
→ Import

---

# 14. DATE SAFETY

Date validation is mandatory.

Compare:

- Selected application date
- Filename date
- Workbook reporting date
- Daily sheet number
- Month
- Year

If these conflict, block import.

Example:

Filename: October 6 2026
Workbook: October 7 2026

Result:
IMPORT BLOCKED

Do not attempt to guess which date is correct.

---

# 15. IMPORT FORMULA RULE

Do not trust calculated Excel values as the source of truth.

Prefer importing raw input fields.

Regenerate:

- Total Sales
- Total Stock
- STD
- ADS
- Target
- Analysis
- Projection
- Achievement

from the application's calculation engine.

---

# 16. DUPLICATE IMPORT

If data already exists:

Do not overwrite automatically.

Display:
Existing record found.

Options:
- Cancel
- Create Revision
- Request Replacement

SUPER_ADMIN may override where appropriate.

---

# 17. XLSX EXPORT

Full export must produce exactly 34 sheets.

The workbook must preserve the authoritative template.

The export filename:

`Daily sales and Closing Stock Information {Month} {Date} {Year}.xlsx`

Example:

`Daily sales and Closing Stock Information October 6 2026.xlsx`

---

# 18. EXCEL FORMULAS

Preserve the workbook's formula architecture.

Daily Total Sales:
`=SUM(D8:I8)`

Regional totals:
`=SUM(D8:D12)`

STD and ADS must dynamically aggregate daily sheets.

Target must reference configured target data.

Analysis must reference the appropriate Target and STD & ADS values.

Do not replace formulas with static values unless explicitly required.

---

# 19. FORMULA SAFETY

Input cells and formula cells must be distinguished.

Users must never accidentally overwrite calculated cells through normal data entry.

---

# 20. EXPORT VALIDATION

Before allowing download:

Validate:

- 34 sheets
- Correct sheet names
- Correct sheet order
- Required formulas
- Required formatting
- Correct dates
- Correct month/year
- Correct organization
- Correct data
- No broken references
- No missing formulas

If validation fails, export must fail safely.

---

# 21. GOOGLE DRIVE

Google Drive access is restricted to SUPER_ADMIN.

SUPER_ADMIN can:

- Connect Drive
- Create folders
- Upload reports
- Replace reports
- View upload status
- Retry failed uploads
- View Drive file IDs

RSO, TSO and CSR cannot upload final reports to Drive.

---

# 22. DRIVE STRUCTURE

Use:

Afaz_Tobacco_Reports/
  YYYY/
    MM_Month/
      YYYY-MM-DD/

Example:

Afaz_Tobacco_Reports/
  2026/
    10_October/
      2026-10-06/

File:
`Daily sales and Closing Stock Information October 6 2026.xlsx`

---

# 23. GOOGLE DRIVE SAFETY

Before upload:

Generate workbook
→ Validate
→ Calculate checksum
→ Check existing Drive file
→ Confirm
→ Upload
→ Verify upload
→ Store Drive File ID

Never silently replace an existing report.

---

# 24. FRONTEND RULES

The frontend must be:

- Responsive
- Professional
- Enterprise-grade
- Accessible
- Fast
- Consistent

Use reusable components.

Do not duplicate UI logic.

Menus must be permission-driven.

Never rely on hidden buttons for security.

Security must exist on the server/database.

---

# 25. BACKEND RULES

Backend must:

- Validate all input
- Validate permissions
- Validate scope
- Validate business rules
- Use transactions for critical operations
- Prevent unauthorized data access
- Log important changes
- Return structured errors

Never trust client-provided:

- user ID
- role
- region ID
- territory ID
- approval status
- permission
- ownership

Derive authorization from authenticated server-side identity.

---

# 26. DATABASE RULES

Use normalized relational design.

Core entities include:

users
roles
permissions
role_permissions
user_scopes

companies
divisions
wings
regions
territories
routes
outlets

brands
products
prices

targets
working_days

daily_sales
daily_stock
zarda_sales
zarda_stock
empty_packets

daily_submissions
submission_versions
approval_history

imports
import_errors

exports
export_versions

google_drive_files
google_sheet_syncs

audit_logs
system_settings

---

# 27. SECURITY

Implement:

- Secure authentication
- Google OAuth
- Server-side authorization
- PostgreSQL RLS
- Input validation
- Rate limiting
- Secure cookies/session handling
- File type validation
- XLSX validation
- Audit logging
- Environment variable protection
- No secrets in frontend
- No service-role keys in browser

Never expose:

- Google client secrets
- Supabase service role key
- OAuth refresh tokens
- Database credentials

---

# 28. ERROR HANDLING

Never silently fail.

Every important operation must produce:

- User-friendly error
- Developer log
- Operation ID where appropriate

Import errors must identify:

- Sheet
- Row
- Column
- Field
- Value
- Expected value
- Reason

---

# 29. DEVELOPMENT RULE

Before implementing a feature:

1. Understand requirements.
2. Inspect existing implementation.
3. Identify affected modules.
4. Implement minimally.
5. Preserve working features.
6. Run type checking.
7. Run linting.
8. Run tests.
9. Build application.
10. Verify affected workflows.

Never rewrite the entire project to solve a local problem.

---

# 30. CHANGE MANAGEMENT

For every substantial change:

Document:

- What changed
- Why
- Files changed
- Database changes
- API changes
- UI changes
- Testing performed
- Known limitations

---

# 31. DEFINITION OF DONE

A feature is NOT complete merely because the UI exists.

It is complete only when:

Frontend
+
Backend
+
Database
+
Authorization
+
Validation
+
Error Handling
+
Testing
+
Audit
+
Documentation

are complete.

---

# 32. FINAL PRINCIPLE

The system must be:

Dynamic
Secure
Role-aware
Scope-aware
Database-driven
Formula-driven
Auditable
Versioned
Excel-compatible
Google Drive controlled
Production-ready

Never sacrifice data integrity for convenience.
Never silently change business logic.
Never overwrite historical data without traceability.
Never bypass authorization.
Never modify the authoritative Excel format without explicit approval.
