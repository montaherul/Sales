-- ============================================================================
-- Afaz Tobacco Platform: Initial Relational Database Schema
-- Migration: 00001_initial_schema.sql
-- ============================================================================

-- Roles
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL, -- 'SUPER_ADMIN', 'RSO', 'TSO', 'CSR'
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permissions
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Role Permissions
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- User Profiles
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role_id UUID REFERENCES roles(id) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Scopes
CREATE TABLE IF NOT EXISTS user_scopes (
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

-- Organizational Hierarchy
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS divisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    division_id UUID REFERENCES divisions(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wing_id UUID REFERENCES wings(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS territories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id UUID REFERENCES regions(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(region_id, name)
);

CREATE TABLE IF NOT EXISTS routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    territory_id UUID REFERENCES territories(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outlets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    owner_name VARCHAR(255),
    phone VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Catalogs & Pricing
DO $$ BEGIN
    CREATE TYPE product_type AS ENUM ('CIGARETTE', 'ZARDA', 'EMPTY_PACKET');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type product_type NOT NULL,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID REFERENCES brands(id) ON DELETE RESTRICT NOT NULL,
    unit_price NUMERIC(12, 4) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Working Days & Targets
CREATE TABLE IF NOT EXISTS working_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year INT NOT NULL,
    month INT NOT NULL,
    working_days INT NOT NULL DEFAULT 26,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (year, month)
);

CREATE TABLE IF NOT EXISTS targets (
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

-- Operational Submissions
DO $$ BEGIN
    CREATE TYPE submission_status AS ENUM ('DRAFT', 'SUBMITTED', 'TSO_APPROVED', 'RSO_APPROVED', 'FINALIZED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS daily_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    territory_id UUID REFERENCES territories(id) ON DELETE CASCADE NOT NULL,
    report_date DATE NOT NULL,
    status submission_status NOT NULL DEFAULT 'DRAFT',
    created_by UUID REFERENCES user_profiles(id),
    submitted_at TIMESTAMPTZ,
    finalized_at TIMESTAMPTZ,
    is_locked BOOLEAN DEFAULT FALSE,
    unlock_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(territory_id, report_date)
);

CREATE TABLE IF NOT EXISTS daily_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES daily_submissions(id) ON DELETE CASCADE NOT NULL,
    brand_id UUID REFERENCES brands(id) ON DELETE RESTRICT NOT NULL,
    quantity NUMERIC(14, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(submission_id, brand_id)
);

CREATE TABLE IF NOT EXISTS daily_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES daily_submissions(id) ON DELETE CASCADE NOT NULL,
    brand_id UUID REFERENCES brands(id) ON DELETE RESTRICT NOT NULL,
    closing_stock NUMERIC(14, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(submission_id, brand_id)
);

CREATE TABLE IF NOT EXISTS zarda_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES daily_submissions(id) ON DELETE CASCADE NOT NULL,
    brand_id UUID REFERENCES brands(id) ON DELETE RESTRICT NOT NULL,
    quantity NUMERIC(14, 4) NOT NULL DEFAULT 0,
    unit_price NUMERIC(12, 4) NOT NULL DEFAULT 0,
    total_value NUMERIC(14, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(submission_id, brand_id)
);

CREATE TABLE IF NOT EXISTS zarda_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES daily_submissions(id) ON DELETE CASCADE NOT NULL,
    brand_id UUID REFERENCES brands(id) ON DELETE RESTRICT NOT NULL,
    closing_stock NUMERIC(14, 4) NOT NULL DEFAULT 0,
    unit_price NUMERIC(12, 4) NOT NULL DEFAULT 0,
    total_value NUMERIC(14, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(submission_id, brand_id)
);

CREATE TABLE IF NOT EXISTS empty_packets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES daily_submissions(id) ON DELETE CASCADE NOT NULL,
    brand_id UUID REFERENCES brands(id) ON DELETE RESTRICT NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(submission_id, brand_id)
);

-- Versioning & Auditing
CREATE TABLE IF NOT EXISTS submission_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES daily_submissions(id) ON DELETE CASCADE NOT NULL,
    version_number INT NOT NULL,
    snapshot_data JSONB NOT NULL,
    modified_by UUID REFERENCES user_profiles(id),
    change_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(submission_id, version_number)
);

CREATE TABLE IF NOT EXISTS approval_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES daily_submissions(id) ON DELETE CASCADE NOT NULL,
    from_status submission_status NOT NULL,
    to_status submission_status NOT NULL,
    action_by UUID REFERENCES user_profiles(id),
    comments TEXT,
    action_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    entity_name VARCHAR(100),
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cloud Integrations
CREATE TABLE IF NOT EXISTS google_drive_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name VARCHAR(255) NOT NULL,
    drive_file_id VARCHAR(255) NOT NULL,
    drive_folder_path TEXT NOT NULL,
    sha256_checksum VARCHAR(64) NOT NULL,
    file_size INT NOT NULL,
    uploaded_by UUID REFERENCES user_profiles(id),
    report_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS google_sheet_syncs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spreadsheet_id VARCHAR(255) NOT NULL,
    spreadsheet_url TEXT NOT NULL,
    year INT NOT NULL,
    month INT NOT NULL,
    report_date DATE,
    sync_status VARCHAR(50) NOT NULL,
    synced_by UUID REFERENCES user_profiles(id),
    records_synced INT DEFAULT 0,
    error_message TEXT,
    last_synced_at TIMESTAMPTZ DEFAULT NOW()
);
