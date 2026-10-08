# REST API Reference & Specification

All API endpoints follow standard REST conventions, require JSON payloads where applicable, and return uniform JSON responses.

```json
{
  "success": true,
  "data": { ... },
  "error": "Error message when success is false"
}
```

---

## 1. Authentication & Identity (`/api/auth`)

| Endpoint | Method | Role | Description |
| :--- | :---: | :---: | :--- |
| `/api/auth/login` | `POST` | Public | Authenticates credentials and sets secure HTTP-only session cookie. |
| `/api/auth/logout` | `POST` | Authenticated | Clears session cookie and records audit log. |
| `/api/auth/me` | `GET` | Authenticated | Retrieves current authenticated session user profile and permissions. |
| `/api/auth/google` | `POST` | Pre-registered | Supabase / Google OAuth bridge. Rejects un-provisioned emails. |
| `/api/auth/onboarding` | `POST` | Onboarding | Mandatory initial password update and profile completion. |

---

## 2. Organization & Tenants (`/api/companies`, `/api/hierarchy`)

| Endpoint | Method | Role | Description |
| :--- | :---: | :---: | :--- |
| `/api/companies` | `GET` | All Admins | Paginated list of enterprise companies (scoped to tenant for Company Admin). |
| `/api/companies` | `POST` | SUPER_ADMIN | Creates new enterprise tenant company. |
| `/api/companies` | `PUT` | SUPER_ADMIN | Updates tenant company profile, plan, and status. |
| `/api/companies/switch` | `POST` | SUPER_ADMIN | Switches active tenant context for Super Administrator. |
| `/api/hierarchy` | `GET` | Authenticated | Paginated territory list with route and outlet counts. |
| `/api/hierarchy` | `POST` | Admins | Creates new territory within assigned region/company. |
| `/api/hierarchy` | `PUT` | Admins | Updates existing territory details. |
| `/api/hierarchy` | `DELETE` | Admins | Deletes territory by ID. |
| `/api/master-data` | `GET` | Authenticated | Retrieves dropdown options for regions, territories, and brands. |

---

## 3. Users & Access Control (`/api/users`, `/api/roles`, `/api/menu-management`)

| Endpoint | Method | Role | Description |
| :--- | :---: | :---: | :--- |
| `/api/users` | `GET` | Admins | Paginated user listing filtered by company, role, or search keyword. |
| `/api/users` | `POST` | Admins | Provisions new user with role and scope bounding. |
| `/api/users` | `PUT` | Admins | Updates user details, status, or password. |
| `/api/users` | `DELETE` | Admins | Deletes user accounts with cross-tenant and Super Admin protection. |
| `/api/roles` | `GET` | Admins | Paginated list of system and custom company roles. |
| `/api/roles` | `POST` | Admins | Creates new company-specific role. |
| `/api/roles` | `PUT` | Admins | Updates role permissions. |
| `/api/roles` | `DELETE` | Admins | Deletes custom role (system roles protected). |
| `/api/menu-management` | `GET` | SUPER_ADMIN | Fetches role-to-menu permission access matrix. |
| `/api/menu-management` | `PUT` | SUPER_ADMIN | Updates menu accessibility for specific roles. |

---

## 4. Products & Targets (`/api/products`, `/api/targets`)

| Endpoint | Method | Role | Description |
| :--- | :---: | :---: | :--- |
| `/api/products` | `GET` | Authenticated | Paginated brand catalog with unit prices. |
| `/api/products` | `POST` | Admins | Creates brand with unit prices. |
| `/api/products` | `PUT` | Admins | Updates brand details and prices. |
| `/api/products` | `DELETE` | Admins | Deletes brand by ID. |
| `/api/targets` | `GET` | Authenticated | Paginated monthly target values by territory and brand. |
| `/api/targets` | `POST` | Admins | Sets or updates territory targets for month/year. |
| `/api/targets` | `PUT` | Admins | Updates monthly target records. |
| `/api/targets` | `DELETE` | Admins | Deletes monthly target records. |

---

## 5. Daily Sales & Approvals (`/api/sales/daily`, `/api/approvals`)

| Endpoint | Method | Role | Description |
| :--- | :---: | :---: | :--- |
| `/api/sales/daily` | `GET` | Authenticated | Fetches daily sales matrix for territory and date. |
| `/api/sales/daily` | `POST` | CSR, TSO | Saves draft daily sales and closing stock values. |
| `/api/sales/daily` | `PUT` | CSR, TSO | Submits daily record for verification workflow. |
| `/api/approvals` | `GET` | TSO, RSO, Admins | Lists submissions requiring verification or approval. |
| `/api/approvals` | `POST` | TSO, RSO, Admins | Performs state transition (Approve, Reject, Resubmit). |

---

## 6. Reporting, Excel & Integrations (`/api/exports`, `/api/imports`, `/api/google-*`)

| Endpoint | Method | Role | Description |
| :--- | :---: | :---: | :--- |
| `/api/exports/xlsx` | `GET` | Authenticated | Streams authoritative 34-sheet Excel workbook. |
| `/api/imports/xlsx/preview` | `POST` | Admins | Validates and parses 34-sheet Excel workbook without persisting. |
| `/api/imports/xlsx/commit` | `POST` | Admins | Commits verified import into PostgreSQL with audit trail. |
| `/api/google-sheets/sync` | `POST` | SUPER_ADMIN | Syncs territory data to Google Sheets spreadsheet. |
| `/api/google-sheets/history` | `GET` | SUPER_ADMIN | Returns history of Google Sheets synchronizations. |
| `/api/google-drive/upload` | `POST` | SUPER_ADMIN | Generates 34-sheet workbook and uploads to Google Drive with checksum. |
| `/api/audit-logs` | `GET` | Admins | Paginated audit trail events with diff metadata. |
