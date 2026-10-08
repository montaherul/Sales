# 03 - DATABASE SCHEMA & RELATIONSHIPS

## 1. Relational Entity Overview

The database uses PostgreSQL (hosted on Supabase) with normalized tables, foreign key constraints, indexes, and Row Level Security (RLS).

---

## 2. Table Definitions (DDL)

### 2.1 Identity & Access Control

```sql
-- Roles
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL, -- 'SUPER_ADMIN', 'RSO', 'TSO', 'CSR'
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permissions
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) UNIQUE NOT NULL, -- e.g. 'sales.create', 'sales.approve', 'drive.upload'
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Role Permissions
CREATE TABLE role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Users (Profiles linked to auth.users)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role_id UUID REFERENCES roles(id) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Scopes (Geographical bounding)
CREATE TABLE user_scopes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
    company_id UUID,
    division_id UUID,
    wing_id UUID,
    region_id UUID,
    territory_id UUID,
    route_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 2.2 Organizational Hierarchy & Multi-Tenant SaaS Tables

```sql
-- Enterprise Tenant Companies
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL, -- e.g., 'Afaz Tobacco Company Ltd.'
    code VARCHAR(50) UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'TRIAL', 'SUSPENDED', 'INACTIVE'
    plan VARCHAR(50) NOT NULL DEFAULT 'PRO', -- 'STARTER', 'PRO', 'ENTERPRISE'
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    currency VARCHAR(10) NOT NULL DEFAULT 'BDT',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Dhaka',
    address TEXT,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SaaS Subscription Plans
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL, -- 'STARTER', 'PRO', 'ENTERPRISE'
    name VARCHAR(100) NOT NULL,
    max_users INT NOT NULL DEFAULT 50,
    max_territories INT NOT NULL DEFAULT 25,
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Company Configuration Settings
CREATE TABLE company_settings (
    company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
    working_days_per_month INT NOT NULL DEFAULT 26,
    default_currency VARCHAR(10) NOT NULL DEFAULT 'BDT',
    default_timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Dhaka',
    enable_google_drive BOOLEAN NOT NULL DEFAULT FALSE,
    enable_google_sheets BOOLEAN NOT NULL DEFAULT FALSE,
    custom_template_path TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE divisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL, -- e.g., 'Ctg South'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE wings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    division_id UUID REFERENCES divisions(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL, -- e.g., 'Chittagong'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wing_id UUID REFERENCES wings(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL, -- e.g., 'Satkania'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE territories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id UUID REFERENCES regions(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL, -- e.g., 'Kerani hat', 'Satkania', 'Bandarban', 'Rajasthali', 'Dohazari'
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(region_id, name)
);

CREATE TABLE routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    territory_id REFERENCES territories(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE outlets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    owner_name VARCHAR(255),
    phone VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 2.3 Master Catalogs & Pricing

```sql
CREATE TYPE product_type AS ENUM ('CIGARETTE', 'ZARDA', 'EMPTY_PACKET');

CREATE TABLE brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL, -- 'Wilson', 'Shahara', 'Express', 'Nexus', 'SB', 'SM', 'SLB', '22/25', '99/14', '33/15'
    type product_type NOT NULL,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID REFERENCES brands(id) ON DELETE RESTRICT NOT NULL,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) UNIQUE,
    unit VARCHAR(50) DEFAULT 'Mio', -- Million sticks or Packets
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID REFERENCES brands(id) ON DELETE RESTRICT NOT NULL,
    unit_price NUMERIC(12, 4) NOT NULL, -- 15 for 22/25, 6 for 99/14, 8 for 33/15
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 2.4 Targets & Working Days

```sql
CREATE TABLE working_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    year INT NOT NULL,
    month INT NOT NULL, -- 1 to 12
    working_days INT NOT NULL DEFAULT 26,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (company_id, year, month)
);

CREATE TABLE targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    territory_id UUID REFERENCES territories(id) ON DELETE CASCADE NOT NULL,
    brand_id UUID REFERENCES brands(id) ON DELETE RESTRICT NOT NULL,
    year INT NOT NULL,
    month INT NOT NULL,
    target_quantity NUMERIC(14, 4) NOT NULL DEFAULT 0,
    route_count INT DEFAULT 0,
    outlet_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(territory_id, brand_id, year, month)
);
```

---

### 2.5 Submissions & Daily Operational Records

```sql
CREATE TYPE submission_status AS ENUM ('DRAFT', 'SUBMITTED', 'TSO_APPROVED', 'RSO_APPROVED', 'FINALIZED', 'REJECTED');

CREATE TABLE daily_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    territory_id UUID REFERENCES territories(id) ON DELETE CASCADE NOT NULL,
    report_date DATE NOT NULL,
    status submission_status NOT NULL DEFAULT 'DRAFT',
    created_by UUID REFERENCES user_profiles(id) NOT NULL,
    submitted_at TIMESTAMPTZ,
    finalized_at TIMESTAMPTZ,
    is_locked BOOLEAN DEFAULT FALSE,
    unlock_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(territory_id, report_date)
);

CREATE TABLE daily_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES daily_submissions(id) ON DELETE CASCADE NOT NULL,
    brand_id UUID REFERENCES brands(id) ON DELETE RESTRICT NOT NULL,
    quantity NUMERIC(14, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(submission_id, brand_id)
);

CREATE TABLE daily_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES daily_submissions(id) ON DELETE CASCADE NOT NULL,
    brand_id UUID REFERENCES brands(id) ON DELETE RESTRICT NOT NULL,
    closing_stock NUMERIC(14, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(submission_id, brand_id)
);

CREATE TABLE zarda_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES daily_submissions(id) ON DELETE CASCADE NOT NULL,
    brand_id UUID REFERENCES brands(id) ON DELETE RESTRICT NOT NULL,
    quantity NUMERIC(14, 4) NOT NULL DEFAULT 0,
    unit_price NUMERIC(12, 4) NOT NULL DEFAULT 0,
    total_value NUMERIC(14, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(submission_id, brand_id)
);

CREATE TABLE zarda_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES daily_submissions(id) ON DELETE CASCADE NOT NULL,
    brand_id UUID REFERENCES brands(id) ON DELETE RESTRICT NOT NULL,
    closing_stock NUMERIC(14, 4) NOT NULL DEFAULT 0,
    unit_price NUMERIC(12, 4) NOT NULL DEFAULT 0,
    total_value NUMERIC(14, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(submission_id, brand_id)
);

CREATE TABLE empty_packets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES daily_submissions(id) ON DELETE CASCADE NOT NULL,
    brand_id UUID REFERENCES brands(id) ON DELETE RESTRICT NOT NULL, -- e.g. Express
    quantity INT NOT NULL DEFAULT 0,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(submission_id, brand_id)
);
```

---

### 2.6 Workflow History, Versions & Audits

```sql
CREATE TABLE approval_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES daily_submissions(id) ON DELETE CASCADE NOT NULL,
    from_status submission_status NOT NULL,
    to_status submission_status NOT NULL,
    action_by UUID REFERENCES user_profiles(id) NOT NULL,
    comments TEXT,
    action_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE submission_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES daily_submissions(id) ON DELETE CASCADE NOT NULL,
    version_number INT NOT NULL,
    snapshot_data JSONB NOT NULL,
    modified_by UUID REFERENCES user_profiles(id) NOT NULL,
    change_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(submission_id, version_number)
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL, -- 'LOGIN', 'SALES_UPDATE', 'SUBMISSION_APPROVE', 'DRIVE_UPLOAD', etc.
    entity_name VARCHAR(100),
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 2.7 Import, Export & Cloud Storage Integrations

```sql
CREATE TABLE imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INT NOT NULL,
    month INT NOT NULL,
    year INT NOT NULL,
    report_date DATE,
    imported_by UUID REFERENCES user_profiles(id) NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'SUCCESS', 'FAILED', 'PARTIAL'
    total_records INT DEFAULT 0,
    error_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE import_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_id UUID REFERENCES imports(id) ON DELETE CASCADE NOT NULL,
    sheet_name VARCHAR(100),
    row_number INT,
    column_name VARCHAR(50),
    field_name VARCHAR(100),
    invalid_value TEXT,
    expected_value TEXT,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE google_drive_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    drive_file_id VARCHAR(255) NOT NULL,
    drive_folder_path TEXT NOT NULL, -- e.g., 'Afaz_Tobacco_Reports/Company-A/2026/10_October/2026-10-06/'
    sha256_checksum VARCHAR(64) NOT NULL,
    file_size INT NOT NULL,
    uploaded_by UUID REFERENCES user_profiles(id) NOT NULL,
    report_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE google_sheet_syncs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    spreadsheet_id VARCHAR(255) NOT NULL,
    sheet_name VARCHAR(100) NOT NULL,
    sync_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    last_synced_at TIMESTAMPTZ,
    synced_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 2.8 PostgreSQL Tenant Isolation & RLS Functions

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

    -- Verify target territory belongs to user's assigned company
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

---

## 3. Database Indexes

```sql
CREATE INDEX idx_companies_status ON companies(status);
CREATE INDEX idx_daily_submissions_company ON daily_submissions(company_id);
CREATE INDEX idx_daily_submissions_date ON daily_submissions(report_date);
CREATE INDEX idx_daily_submissions_territory ON daily_submissions(territory_id);
CREATE INDEX idx_daily_submissions_status ON daily_submissions(status);
CREATE INDEX idx_user_scopes_user ON user_scopes(user_id);
CREATE INDEX idx_user_scopes_company ON user_scopes(company_id);
CREATE INDEX idx_audit_logs_company ON audit_logs(company_id, created_at);
CREATE INDEX idx_audit_logs_event ON audit_logs(event_type, created_at);
CREATE INDEX idx_targets_month_year ON targets(year, month);
CREATE INDEX idx_brands_company ON brands(company_id);
```
