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
