# Database Schema & Data Models

## 1. Primary Source of Truth
PostgreSQL (hosted on Supabase) is the single authoritative source of truth for all business data. Excel workbooks and Google Sheets are analytical/reporting artifacts synchronized from the database.

---

## 2. Relational Entity Overview

```
                      +-------------------+
                      |     companies     |
                      +-------------------+
                                | 1:N
             +------------------+------------------+
             |                                     |
             v                                     v
      +--------------+                      +---------------+
      |  divisions   |                      | user_profiles |
      +--------------+                      +---------------+
             | 1:N                                 | 1:1
             v                                     v
      +--------------+                      +---------------+
      |    wings     |                      |  user_scopes  |
      +--------------+                      +---------------+
             | 1:N                                 |
             v                                     | (Links to company,
      +--------------+                             |  region, territory)
      |   regions    | <---------------------------+
      +--------------+                             |
             | 1:N                                 |
             v                                     |
      +--------------+ <---------------------------+
      | territories  |
      +--------------+
             | 1:N
             +-----------------------------+
             |                             |
             v                             v
      +--------------+              +--------------+
      | daily_sales  |              |   targets    |
      +--------------+              +--------------+
             |                             |
             v                             v
      +--------------+              +--------------+
      | daily_stock  |              |    brands    |
      +--------------+              +--------------+
```

---

## 3. Core Tables

### 3.1 Multi-Tenant Organization
- **`companies`**: Tenant accounts (`id`, `name`, `code`, `status`, `plan`, `created_at`, `updated_at`).
- **`divisions`**: Top-level regional division (`id`, `company_id`, `name`).
- **`wings`**: Regional wing grouping (`id`, `division_id`, `name`).
- **`regions`**: Geographic region (`id`, `wing_id`, `name`).
- **`territories`**: Operational territory (`id`, `region_id`, `name`, `sort_order`).

### 3.2 Identity & Role-Based Access Control
- **`roles`**: System roles (`SUPER_ADMIN`, `COMPANY_ADMIN`, `RSO`, `TSO`, `CSR`) and custom company roles (`id`, `name`, `company_id`, `description`).
- **`permissions`**: Fine-grained permissions (`code`, `description`).
- **`role_permissions`**: Mapping between roles and permissions (`role_id`, `permission_id`).
- **`user_profiles`**: User accounts (`id`, `email`, `full_name`, `phone`, `role_id`, `is_active`, `password_hash`, `must_change_password`, `is_onboarded`).
- **`user_scopes`**: Scoping bounds (`user_id`, `company_id`, `region_id`, `territory_id`).

### 3.3 Master Data & Operational Records
- **`brands`**: Product brands (`id`, `name`, `company_id`, `type`, `unit_price`, `sort_order`).
- **`targets`**: Monthly targets (`id`, `company_id`, `territory_id`, `brand_id`, `month`, `year`, `target_quantity`, `target_value`).
- **`daily_submissions`**: Operational status tracking (`id`, `territory_id`, `submission_date`, `status`, `submitted_by`, `tso_approved_by`, `rso_approved_by`, `remarks`).
- **`daily_sales`**: Brand-level sales entries (`id`, `submission_id`, `territory_id`, `brand_id`, `sale_date`, `quantity`, `value`).
- **`daily_stock`**: Closing stock quantities (`id`, `submission_id`, `territory_id`, `brand_id`, `stock_date`, `quantity`).
- **`empty_packets`**: Returned packet tracking (`id`, `submission_id`, `brand_id`, `quantity`).
- **`zarda_sales`**: Zarda product sales (`id`, `submission_id`, `brand_id`, `quantity`).
- **`audit_logs`**: Immutable audit events (`id`, `company_id`, `user_id`, `event_type`, `entity_name`, `entity_id`, `old_values`, `new_values`, `ip_address`, `created_at`).

---

## 4. Stored Procedures
- `sp_get_users_paginated`: Paginated user list with role and geographical scopes.
- `sp_get_roles_paginated`: Paginated roles with permission count and company filtering.
- `sp_get_territories_paginated`: Paginated territories with route and outlet counts.
- `sp_get_companies_paginated`: Enterprise company list with summary counts.
- `sp_get_user_for_auth`: High-performance lookup of user auth context, scopes, and company info.
- `sp_sync_google_sheets_row`: Upserting territory sales row to Google Sheets tracking table.

Refer to [03-DATABASE.md](file:///d:/daily%20sales/docs/03-DATABASE.md) for full SQL schemas and foreign key relationship diagrams.
