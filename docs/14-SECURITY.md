# 14 - SECURITY & DATA PROTECTION SPECIFICATION

## 1. Security Architecture Principles

The Afaz Tobacco Sales & Stock Intelligence Platform adopts a **Zero-Trust & Defense-in-Depth** model:
1. Every layer validates identity and permissions independently.
2. The browser is treated as an untrusted client environment.
3. PostgreSQL Row Level Security (RLS) provides the final mathematical guarantee of multi-territory data isolation.

---

## 2. Secrets & Environment Variable Protection

- **Forbidden in Browser:**
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
  - Database connection strings (`DATABASE_URL`)
- **Allowed in Browser:**
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Audit Verification:** All builds and automated lint rules must scan for inadvertent leaks of private keys in client bundles.

---

## 3. Session & Authentication Security

- **Provider:** Google OAuth integrated with Supabase Auth.
- **Cookies:** Stored with `HttpOnly`, `Secure` (in production), and `SameSite=Lax` flags.
- **CSRF Protection:** Next.js Server Actions automatically protect against Cross-Site Request Forgery via origin checking.
- **Session Revocation:** Disabling a user in `user_profiles.is_active = FALSE` immediately invalidates subsequent API requests via middleware verification.

---

## 4. File Upload & Spreadsheet Security

Spreadsheet uploads pose unique security risks (e.g., XML External Entity attacks, Zip bombs, formula injection):
1. **File Type & MIME Validation:** Enforce `.xlsx` extension and `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
2. **File Size Cap:** Enforce a hard maximum upload size of **25 MB**.
3. **Zip Bomb Mitigation:** Validate decompression ratios when extracting OpenXML archives.
4. **Formula Sanitization:** Values extracted from Excel are converted to sanitized numeric primitives. Formula text from imported sheets is never directly executed by the server.

---

## 5. Rate Limiting & Abuse Prevention

- **API Rate Limiting:** Enforce per-IP and per-User rate limits on authentication, import, and export endpoints.
- **Sensitive Operations:** Limit Super Admin Google Drive upload triggers to 10 requests per minute to prevent accidental Google Cloud quota exhaustion.

---

## 6. Multi-Tenant Isolation & Cross-Tenant Attack Mitigation

Tenant isolation is the primary security boundary of the SaaS architecture:

1. **Database-Level Isolation (PostgreSQL RLS):**
   - Tables containing business records (`brands`, `working_days`, `targets`, `daily_submissions`, `audit_logs`, `google_drive_files`, `google_sheet_syncs`) enforce `company_id NOT NULL`.
   - Queries are evaluated against `public.can_access_company(company_id)` and `public.can_access_territory(territory_id)`.
   - Non-Super Admins cannot view or mutate any records belonging to a different tenant, even in the event of an application-layer logic flaw.

2. **Server-Side Tenant Context Derivation:**
   - Handlers never trust `company_id` supplied via query string or body from client requests.
   - For all non-Super Admin roles (`COMPANY_ADMIN`, `RSO`, `TSO`, `CSR`), `company_id` is derived strictly from the authenticated user's verified server session and `user_scopes` database relation.

3. **Cross-Tenant Attack Prevention:**
   - Any attempt by a Company Admin or field user to access, mutate, or delete records belonging to another company results in HTTP `403 Forbidden`.
   - Super Admin cross-tenant analytics are isolated to read-only aggregate views (`/api/platform/stats`).

4. **Automated Security Verification:**
   - Continuous verification via `scripts/test_tenant_isolation.js` asserting that Company Admins and field officers cannot see foreign tenant records or execute cross-tenant deletion attacks.
