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

### 2.2 Organizational Hierarchy

```sql
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL, -- e.g., 'Afaz Tobacco Company'
    code VARCHAR(50) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
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
    territory_id UUID REFERENCES territories(id) ON DELETE CASCADE NOT NULL,
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
    year INT NOT NULL,
    month INT NOT NULL, -- 1 to 12
    working_days INT NOT NULL DEFAULT 26,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (year, month)
);

CREATE TABLE targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

### 2.7 Import, Export & Google Drive Integrations

```sql
CREATE TABLE imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    file_name VARCHAR(255) NOT NULL,
    drive_file_id VARCHAR(255) NOT NULL,
    drive_folder_path TEXT NOT NULL, -- e.g., 'Afaz_Tobacco_Reports/2026/10_October/2026-10-06/'
    sha256_checksum VARCHAR(64) NOT NULL,
    file_size INT NOT NULL,
    uploaded_by UUID REFERENCES user_profiles(id) NOT NULL,
    report_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. Database Indexes

```sql
CREATE INDEX idx_daily_submissions_date ON daily_submissions(report_date);
CREATE INDEX idx_daily_submissions_territory ON daily_submissions(territory_id);
CREATE INDEX idx_daily_submissions_status ON daily_submissions(status);
CREATE INDEX idx_user_scopes_user ON user_scopes(user_id);
CREATE INDEX idx_audit_logs_event ON audit_logs(event_type, created_at);
CREATE INDEX idx_targets_month_year ON targets(year, month);
```
