# Afaz Tobacco Sales & Stock Intelligence Platform

An enterprise-grade, secure, dynamic sales, stock, target tracking, approval, Excel import/export, and Google Drive intelligence platform built for **Afaz Tobacco Company**.

---

## 🌟 Executive Summary

The Afaz Tobacco Sales & Stock Intelligence Platform replaces error-prone, manual spreadsheet exchanges with a centralized, role-governed web application. Field representatives (CSR), territory supervisors (TSO), and regional officers (RSO) collaborate in real time while preserving the company's **authoritative 34-sheet Excel reporting workbook**.

---

## 🛠️ Technology Stack

- **Frontend:** Next.js (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui
- **State & Data Management:** TanStack Query, TanStack Table, Recharts
- **Backend & API:** Next.js Server Actions & Route Handlers, Service Layer Pattern
- **Database:** Supabase PostgreSQL with Row Level Security (RLS)
- **Authentication:** Supabase Auth with Google OAuth
- **Excel Engine:** ExcelJS (Formula-preserving 34-sheet workbook generator)
- **Validation:** Zod (Runtime validation for APIs, imports, and forms)
- **Cloud Storage:** Google Drive API v3 (Super Admin controlled archiving)
- **Reporting Sync:** Google Sheets API v4

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
│   ├── 02-ARCHITECTURE.md            # Technical architecture & service layers
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
    ├── TODO.md                       # Pending backlog & milestones
    ├── IN-PROGRESS.md                # Currently active work items
    └── DONE.md                       # Completed features & validations
```

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
Data Scope answers **which data you can touch** (`territory_id`, `region_id`).

Every database query and mutation is protected by **PostgreSQL Row Level Security (RLS)** ensuring field officers can never access or modify records outside their assigned operational boundary.

---

## 🚀 Getting Started

1. **Review Instructions:** AI agents must read [AGENTS.md](file:///d:/daily%20sales/AGENTS.md) and [PROJECT_REQUIREMENTS.md](file:///d:/daily%20sales/PROJECT_REQUIREMENTS.md).
2. **Inspect Template:** View [TEMPLATE.xlsx](file:///d:/daily%20sales/excel/TEMPLATE.xlsx) and review [EXCEL-MAPPING.md](file:///d:/daily%20sales/excel/EXCEL-MAPPING.md).
3. **Environment Setup:** Configure `.env.local` with Supabase and Google OAuth credentials as specified in [18-DEPLOYMENT.md](file:///d:/daily%20sales/docs/18-DEPLOYMENT.md).
4. **Development Server:** Run `npm run dev` to launch the local development environment.
