# 04 - AUTHENTICATION, RBAC & DATA SCOPE

## 1. Core Security Principle

The security model of the platform rests upon a clear distinction:

> **A permission answers "WHAT can you do?"**  
> **A data scope answers "WHICH DATA can you do it to?"**

A user might have `sales.view = true` or `sales.approve = true`, but they can only apply that permission within the geographical boundaries defined by their `user_scopes`.

```text
Authentication (Google OAuth / Supabase Auth)
      ↓
User Identity (user_profiles)
      ↓
Role (SUPER_ADMIN, RSO, TSO, CSR)
      ↓
Permissions (sales.create, sales.approve, drive.upload, etc.)
      ↓
Data Scope (company_id, region_id, territory_id)
      ↓
PostgreSQL Row Level Security (RLS)
      ↓
Server-Side API Authorization
```

---

## 2. Authentication Architecture

- **Provider:** Supabase Auth with Google OAuth (restricted to corporate domain or approved enterprise accounts).
- **Session Tokens:** Secure HTTP-only cookies containing signed JWTs.
- **Client Guarantees:** The client never receives service-role keys or database credentials.
- **Server Identity:** The backend derives user identity strictly from `auth.uid()` in the authenticated server context. Never trust client-supplied `user_id` or `role`.

---

## 3. Initial Roles & Responsibilities

| Role | Scope Level | Description |
| :--- | :--- | :--- |
| `SUPER_ADMIN` | Global (All Organizations) | Enterprise executive with unrestricted access to configuration, users, all regional data, approval overrides, and Google Drive upload. |
| `COMPANY_ADMIN` | Tenant (`company_id`) | Tenant administrator managing users, organizational hierarchy, brands, prices, targets, submissions, approvals, and reports strictly within their assigned company. |
| `RSO` | Regional (`region_id`) | Regional Sales Officer supervising all territories within their designated region. Performs secondary verification and regional approvals. |
| `TSO` | Territory (`territory_id`) | Territory Sales Officer managing market routes and CSR entries within their assigned territory. Performs first-line verification and approvals. |
| `CSR` | Route / Territory (`territory_id`) | Field representative entering daily operational metrics (sales, closing stock, zarda, empty packets). Can only edit drafts. |

---

## 4. Atomic Permission Matrix

| Permission Code | Description | CSR | TSO | RSO | COMPANY_ADMIN | SUPER_ADMIN |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| `sales.create` | Create daily draft records | ✅ | ✅ | ❌ | ✅ | ✅ |
| `sales.read` | View daily records within scope | ✅ (own) | ✅ (territory) | ✅ (region) | ✅ (company) | ✅ (all) |
| `sales.update.draft` | Update draft submissions | ✅ | ✅ | ❌ | ✅ | ✅ |
| `sales.submit` | Submit draft to TSO review | ✅ | ✅ | ❌ | ✅ | ✅ |
| `sales.approve.tso` | Approve territory records | ❌ | ✅ | ❌ | ✅ | ✅ |
| `sales.reject.tso` | Reject territory records | ❌ | ✅ | ❌ | ✅ | ✅ |
| `sales.approve.rso` | Approve regional records | ❌ | ❌ | ✅ | ✅ | ✅ |
| `sales.reject.rso` | Reject regional records | ❌ | ❌ | ✅ | ✅ | ✅ |
| `sales.finalize` | Finalize & lock monthly logs | ❌ | ❌ | ❌ | ✅ (company) | ✅ (global) |
| `sales.unlock` | Unlock finalized records (reason req.)| ❌ | ❌ | ❌ | ❌ | ✅ |
| `master.org.manage` | Manage company, regions, territories | ❌ | ❌ | ❌ | ✅ (company) | ✅ (global) |
| `master.targets.manage` | Manage monthly quota targets | ❌ | ❌ | ❌ | ✅ (company) | ✅ (global) |
| `master.prices.manage` | Manage brand prices & working days | ❌ | ❌ | ❌ | ✅ (company) | ✅ (global) |
| `users.manage` | Manage users, roles & scopes | ❌ | ❌ | ❌ | ✅ (company) | ✅ (global) |
| `reports.export` | Download 34-sheet XLSX export | ❌ | ✅ | ✅ | ✅ (company) | ✅ (all) |
| `reports.import` | Upload & import XLSX workbooks | ❌ | ❌ | ❌ | ✅ (company) | ✅ (all) |
| `drive.upload` | Upload reports to Google Drive | ❌ | ❌ | ❌ | ❌ | ✅ |
| `audit.view` | Inspect system audit logs | ❌ | ❌ | ❌ | ✅ (company) | ✅ (all) |

---

## 5. PostgreSQL Row Level Security (RLS) Implementation

To ensure data isolation even against buggy UI queries or direct database requests, Row Level Security is enabled on all sensitive tables with tenant and territorial boundaries.

### 5.1 Helper Functions

```sql
-- Derives the authenticated user's assigned company ID
CREATE OR REPLACE FUNCTION public.current_user_company_id()
RETURNS UUID AS $$
    SELECT s.company_id
    FROM public.user_scopes s
    WHERE s.user_id = auth.uid()
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Enforces whether the caller can access target company data
CREATE OR REPLACE FUNCTION public.can_access_company(target_company_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    u_role VARCHAR;
    u_comp UUID;
BEGIN
    SELECT r.name INTO u_role
    FROM public.user_profiles u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = auth.uid();

    -- SUPER_ADMIN has global cross-tenant visibility
    IF u_role = 'SUPER_ADMIN' THEN
        RETURN TRUE;
    END IF;

    -- All other users must belong strictly to the target company
    u_comp := public.current_user_company_id();
    RETURN (u_comp IS NOT NULL AND u_comp = target_company_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Enforces geographical territory access with company scoping
CREATE OR REPLACE FUNCTION public.can_access_territory(target_territory_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    u_role VARCHAR;
    u_comp UUID;
    t_comp UUID;
BEGIN
    SELECT r.name INTO u_role
    FROM public.user_profiles u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = auth.uid();

    IF u_role = 'SUPER_ADMIN' THEN
        RETURN TRUE;
    END IF;

    -- Target territory must belong to user's assigned company
    SELECT c.id INTO t_comp
    FROM public.territories t
    JOIN public.regions rg ON t.region_id = rg.id
    JOIN public.wings w ON rg.wing_id = w.id
    JOIN public.divisions d ON w.division_id = d.id
    JOIN public.companies c ON d.company_id = c.id
    WHERE t.id = target_territory_id;

    u_comp := public.current_user_company_id();
    IF u_comp IS NULL OR t_comp IS NULL OR u_comp <> t_comp THEN
        RETURN FALSE;
    END IF;

    -- COMPANY_ADMIN has full access to all territories within their company
    IF u_role = 'COMPANY_ADMIN' THEN
        RETURN TRUE;
    END IF;

    -- RSO scope check
    IF u_role = 'RSO' THEN
        RETURN EXISTS (
            SELECT 1 FROM public.user_scopes s
            JOIN public.territories t ON t.region_id = s.region_id
            WHERE s.user_id = auth.uid() AND t.id = target_territory_id
        );
    END IF;

    -- TSO / CSR scope check
    RETURN EXISTS (
        SELECT 1 FROM public.user_scopes s
        WHERE s.user_id = auth.uid() AND s.territory_id = target_territory_id
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

### 5.2 RLS Policies on `daily_submissions`

```sql
ALTER TABLE daily_submissions ENABLE ROW LEVEL SECURITY;

-- Select Policy: Users can view records only in their scope
CREATE POLICY "Users can view submissions within their scope"
ON daily_submissions FOR SELECT
USING (auth.can_access_territory(territory_id));

-- Insert Policy: CSR and TSO can insert drafts for assigned territory
CREATE POLICY "Users can insert submissions within their territory"
ON daily_submissions FOR INSERT
WITH CHECK (
    auth.can_access_territory(territory_id)
    AND (auth.current_user_role() IN ('CSR', 'TSO', 'SUPER_ADMIN'))
);

-- Update Policy: Locked records cannot be updated unless SUPER_ADMIN unlocks
CREATE POLICY "Users can update submissions based on role and status"
ON daily_submissions FOR UPDATE
USING (
    auth.can_access_territory(territory_id)
    AND (
        (auth.current_user_role() = 'SUPER_ADMIN')
        OR (is_locked = FALSE AND (
            (auth.current_user_role() = 'CSR' AND status = 'DRAFT')
            OR (auth.current_user_role() = 'TSO' AND status IN ('SUBMITTED', 'DRAFT'))
            OR (auth.current_user_role() = 'RSO' AND status = 'TSO_APPROVED')
        ))
    )
);
```

---

## 7. User Provisioning, Initial Seed Accounts & Onboarding Flow

### 7.1 No Public Registration Policy
Public self-registration is strictly **disabled**. There is no registration page. All users, roles, and geographical scopes (Division, Region, Territory) are provisioned exclusively by the `SUPER_ADMIN` in the **User & Role Directory** (`/api/users`).

### 7.2 Initial Seed Accounts (Password: `123`)
Every role has an initial seeded user in PostgreSQL with bcrypt password hashing (cost factor: 10):

| Role | Seed Email | Initial Password | Assigned Scope |
| :--- | :--- | :--- | :--- |
| `SUPER_ADMIN` | `admin@afaztobacco.com` | `123` | Afaz Tobacco Company (All) |
| `RSO` | `rso.satkania@afaztobacco.com` | `123` | Satkania Region |
| `TSO` | `tso.keranihat@afaztobacco.com` | `123` | Kerani Hat Territory |
| `CSR` | `csr.keranihat@afaztobacco.com` | `123` | Kerani Hat Territory |

### 7.3 Google OAuth Restriction
Users may sign in using **Sign in with Google**. However, the Google account's email address must already be provisioned by the `SUPER_ADMIN`. Any attempt to sign in with an unprovisioned Google email is blocked with HTTP `403 Forbidden` (`AUTH_RESTRICTED`).

### 7.4 Onboarding Protocol
When a newly provisioned user logs in for the first time (where `must_change_password = true` or `is_onboarded = false`), the application enforces an **Account Activation Modal**:
1. Displays the user's provisioned company, region, and territory scope.
2. Requires setting a personal secure password (replacing temporary `123`).
3. Prompts confirmation of phone number and full name.
4. Transitions smoothly into the user's role-scoped dashboard.

