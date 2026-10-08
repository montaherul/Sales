# Platform Architecture Overview

## 1. System Architecture

The Afaz Tobacco Sales & Stock Intelligence Platform is architected following strict Domain-Driven Design (DDD) and Clean Architecture principles, ensuring clear separation of responsibilities, testability, tenant isolation, and auditable data operations.

```
+-------------------------------------------------------------+
|                     Presentation Layer                      |
|  - Next.js 15 App Router (Thin Controllers / Server Routes) |
|  - React 19 Frontend Components & Server-Driven Tables      |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                     Application Layer                       |
|  - Use Cases & Application Services                         |
|  - Business Rule Orchestration                              |
|  - Role-Based & Tenant-Scoped Authorization                |
|  - Centralized Audit Trail Logging                          |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                       Domain Layer                          |
|  - Domain Entities, Value Objects & Aggregates              |
|  - Approval Workflow State Machine                          |
|  - Calculation Engine (STD, ADS, Achievement %, Growth %)   |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                    Infrastructure Layer                     |
|  - Relational Repositories (PostgreSQL via Pool / RLS)      |
|  - External Adapters (Google Sheets API, Google Drive v3)   |
|  - Authoritative 34-Sheet Excel Engine (ExcelJS)            |
+-------------------------------------------------------------+
```

## 2. Directory Hierarchy

Following the authoritative enterprise project structure:

```text
src/
├── app/                  # Application entry, API routes, and presentation UI
├── domain/               # Domain models, business entities, and calculation engine
├── application/          # Use cases, application services, and business workflows
├── infrastructure/       # Database repositories, stored procedures, and external integrations
├── contracts/            # Data Transfer Objects (DTOs), API contracts, and Zod schemas
└── shared/               # Database pool, structured logger, error hierarchy, and session auth
```

## 3. Layer Responsibilities

### 3.1 Presentation Layer (`src/app/`)
- Pure thin controllers: receives HTTP requests, parses/validates DTOs, extracts authenticated session context, delegates to application services, and returns standardized JSON responses.
- Never directly executes raw SQL queries or manages database connections.

### 3.2 Application Layer (`src/application/`)
- Contains application services (`IdentityService`, `CompanyService`, `HierarchyService`, `ProductService`, `TargetService`, `DailySalesService`, `ApprovalService`, etc.).
- Orchestrates multi-step workflows, enforces server-side role and tenant boundaries, manages transactions (`withTransaction`), and logs audit events (`AuditService.logEvent`).

### 3.3 Domain Layer (`src/domain/`)
- Houses core business rules, entity models, and calculation algorithms.
- Completely decoupled from HTTP frameworks, database queries, and external APIs.

### 3.4 Infrastructure Layer (`src/infrastructure/`)
- Manages PostgreSQL queries, parameterized SQL, stored procedure invocations, and external Google API integrations.
- Houses all persistence repositories (`UserRepository`, `ProductRepository`, `DailySalesRepository`, etc.).

### 3.5 Contracts Layer (`src/contracts/`)
- Standardized request/response interfaces, DTO definitions, and validation schemas.

### 3.6 Shared Layer (`src/shared/`)
- Cross-cutting infrastructural concerns: database pooling (`dbQuery`, `withTransaction`), structured logging (`logger`), custom error classes (`ValidationError`, `ForbiddenError`, `NotFoundError`), and session token decoding.

## 4. Multi-Tenant SaaS Isolation
The platform implements strict tenant isolation:
- Multi-tenancy is enforced on the server-side via authenticated session context.
- `SUPER_ADMIN` holds platform-level visibility across all tenants.
- `COMPANY_ADMIN` and below are strictly scoped to their assigned company ID. Cross-tenant reads and mutations are blocked with HTTP 403 Forbidden.

Refer to [02-ARCHITECTURE.md](file:///d:/daily%20sales/docs/02-ARCHITECTURE.md) for detailed architectural blueprints.
