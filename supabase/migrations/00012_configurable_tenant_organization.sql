-- ============================================================================
-- Tobacco SaaS Platform: Configurable Multi-Tenant Organization & Hierarchy
-- Migration: 00012_configurable_tenant_organization.sql
-- ============================================================================

-- 1. Departments Table (Configurable per Tenant)
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50),
    description TEXT,
    head_user_id UUID,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_departments_company_id ON departments(company_id);

-- 2. Positions Table (Organization Designations & Reporting Hierarchy)
CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50),
    level INT DEFAULT 1, -- 1=Executive/CEO, 2=Director, 3=HOD, 4=Regional, 5=Area/ASM, 6=Territory/TSO, 7=Supervisor, 8=Field/CSR
    parent_position_id UUID REFERENCES positions(id) ON DELETE SET NULL,
    default_role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_positions_company_id ON positions(company_id);
CREATE INDEX IF NOT EXISTS idx_positions_dept_id ON positions(department_id);
CREATE INDEX IF NOT EXISTS idx_positions_parent_id ON positions(parent_position_id);

-- 3. Distributors Table (External Channel Partners per Tenant)
CREATE TABLE IF NOT EXISTS distributors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    proprietor_name VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    territory_id UUID REFERENCES territories(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_distributors_company_id ON distributors(company_id);
CREATE INDEX IF NOT EXISTS idx_distributors_territory_id ON distributors(territory_id);

-- 4. User Profiles Extensions
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES positions(id) ON DELETE SET NULL;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS distributor_id UUID REFERENCES distributors(id) ON DELETE SET NULL;

-- Backfill user_profiles.company_id from user_scopes
UPDATE user_profiles u
SET company_id = (SELECT company_id FROM user_scopes us WHERE us.user_id = u.id LIMIT 1)
WHERE u.company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_company_id ON user_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_dept_id ON user_profiles(department_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_pos_id ON user_profiles(position_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_supervisor_id ON user_profiles(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_distributor_id ON user_profiles(distributor_id);

-- 5. User Scopes Extensions
ALTER TABLE user_scopes ADD COLUMN IF NOT EXISTS scope_level VARCHAR(20) DEFAULT 'TERRITORY';
ALTER TABLE user_scopes ADD COLUMN IF NOT EXISTS route_id UUID REFERENCES routes(id) ON DELETE SET NULL;
ALTER TABLE user_scopes ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL;

-- 6. Insert Complete Suite of Standard Roles (Tenant + Functional Divisions)
INSERT INTO roles (name, description) VALUES
    ('PLATFORM_SUPPORT', 'Platform Support Engineer with cross-tenant read & diagnostics access'),
    ('TENANT_ADMIN', 'Tenant Administrator controlling company users, hierarchy, settings'),
    ('CEO', 'Chief Executive Officer with full tenant-wide executive visibility'),
    ('COMMERCIAL_DIRECTOR', 'Commercial Director overseeing sales, marketing, and distribution'),
    ('DEPARTMENT_HEAD', 'Head of a functional department (Sales, Marketing, Logistics)'),
    ('HEAD_OF_SALES', 'Head of Sales Department managing national sales strategy'),
    ('REGIONAL_MANAGER', 'Regional Sales Manager supervising multiple areas and territories'),
    ('AREA_MANAGER', 'Area Sales Manager (ASM) managing regional sales clusters'),
    ('TERRITORY_OFFICER', 'Territory Sales Officer overseeing territory distributors & CSRs'),
    ('FIELD_SUPERVISOR', 'Field Sales Supervisor guiding frontline CSR routes and outlets'),
    ('HEAD_OF_MARKETING', 'Head of Marketing overseeing brand and trade activations'),
    ('BRAND_MANAGER', 'Brand Manager responsible for brand portfolio & pricing strategy'),
    ('TRADE_MARKETING_MANAGER', 'Trade Marketing Manager directing BTL trade activations'),
    ('TRADE_MARKETING_OFFICER', 'Trade Marketing Officer managing field merchandising'),
    ('MARKETING_EXECUTIVE', 'Marketing Executive executing field brand visibility programs'),
    ('DISTRIBUTOR_ADMIN', 'Distributor Principal / Owner managing distributor operations'),
    ('DISTRIBUTOR_MANAGER', 'Distributor Manager overseeing warehouse stocks & orders'),
    ('DISTRIBUTOR_STAFF', 'Distributor Staff executing order deliveries & dispatches'),
    ('SALES_ANALYST', 'Sales Intelligence Analyst with analytical & projection access'),
    ('MARKETING_ANALYST', 'Marketing Analyst tracking consumer reach and brand pacing')
ON CONFLICT (name) DO NOTHING;

-- 7. Stored Procedure: sp_provision_tenant_template
-- Auto-provisions a comprehensive FMCG/Tobacco organization template for a tenant
CREATE OR REPLACE FUNCTION sp_provision_tenant_template(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sales_dept_id UUID;
    v_mkt_dept_id UUID;
    v_dist_dept_id UUID;
    v_fin_dept_id UUID;
    v_ops_dept_id UUID;
    
    v_pos_ceo UUID;
    v_pos_comm_dir UUID;
    v_pos_hos UUID;
    v_pos_rm UUID;
    v_pos_asm UUID;
    v_pos_tso UUID;
    v_pos_sup UUID;
    v_pos_csr UUID;
    
    v_pos_hom UUID;
    v_pos_bm UUID;
    v_pos_tmm UUID;
    v_pos_tmo UUID;
    v_pos_me UUID;
    
    v_pos_dist_mgr UUID;
    
    v_terr_id UUID;
    v_dist_id UUID;
    v_user_rec RECORD;
    v_rso_user_id UUID;
    v_tso_user_id UUID;
    v_sup_user_id UUID;
BEGIN
    IF p_company_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Company ID is required');
    END IF;

    -- A. Provision Standard Departments
    INSERT INTO departments (company_id, name, code, description)
    VALUES (p_company_id, 'Sales & Field Distribution', 'SALES', 'Primary sales force, territory coverage, and channel operations')
    ON CONFLICT (company_id, name) DO UPDATE SET is_active = TRUE
    RETURNING id INTO v_sales_dept_id;

    INSERT INTO departments (company_id, name, code, description)
    VALUES (p_company_id, 'Brand Marketing & Trade Activations', 'MKT', 'Brand portfolio strategy, trade merchandising, and retail activations')
    ON CONFLICT (company_id, name) DO UPDATE SET is_active = TRUE
    RETURNING id INTO v_mkt_dept_id;

    INSERT INTO departments (company_id, name, code, description)
    VALUES (p_company_id, 'Distribution & Logistics', 'DIST', 'Primary warehousing, channel distribution, and stock replenishment')
    ON CONFLICT (company_id, name) DO UPDATE SET is_active = TRUE
    RETURNING id INTO v_dist_dept_id;

    INSERT INTO departments (company_id, name, code, description)
    VALUES (p_company_id, 'Finance & Commercial Control', 'FIN', 'Revenue assurance, credit controls, pricing, and accounting')
    ON CONFLICT (company_id, name) DO UPDATE SET is_active = TRUE
    RETURNING id INTO v_fin_dept_id;

    INSERT INTO departments (company_id, name, code, description)
    VALUES (p_company_id, 'Operations & Supply Chain', 'OPS', 'Production scheduling, leaf procurement, and packaging dispatch')
    ON CONFLICT (company_id, name) DO UPDATE SET is_active = TRUE
    RETURNING id INTO v_ops_dept_id;

    -- B. Provision Positions with Reporting Tree
    -- Level 1: CEO / MD
    INSERT INTO positions (company_id, department_id, name, code, level, description)
    VALUES (p_company_id, v_sales_dept_id, 'Chief Executive Officer / MD', 'CEO', 1, 'Executive head of company operations')
    ON CONFLICT (company_id, name) DO UPDATE SET level = 1
    RETURNING id INTO v_pos_ceo;

    -- Level 2: Commercial Director (reports to CEO)
    INSERT INTO positions (company_id, department_id, name, code, level, parent_position_id, description)
    VALUES (p_company_id, v_sales_dept_id, 'Commercial Director', 'CD', 2, v_pos_ceo, 'Directs overall commercial operations (Sales, Marketing, Distribution)')
    ON CONFLICT (company_id, name) DO UPDATE SET parent_position_id = v_pos_ceo, level = 2
    RETURNING id INTO v_pos_comm_dir;

    -- Sales Tree (Level 3 -> 8)
    INSERT INTO positions (company_id, department_id, name, code, level, parent_position_id, description)
    VALUES (p_company_id, v_sales_dept_id, 'Head of Sales', 'HOS', 3, v_pos_comm_dir, 'Directs national sales team and territory targets')
    ON CONFLICT (company_id, name) DO UPDATE SET parent_position_id = v_pos_comm_dir, level = 3
    RETURNING id INTO v_pos_hos;

    INSERT INTO positions (company_id, department_id, name, code, level, parent_position_id, description)
    VALUES (p_company_id, v_sales_dept_id, 'Regional Sales Manager (RSO / RSM)', 'RSM', 4, v_pos_hos, 'Oversees regional performance, territory clusters, and verification')
    ON CONFLICT (company_id, name) DO UPDATE SET parent_position_id = v_pos_hos, level = 4
    RETURNING id INTO v_pos_rm;

    INSERT INTO positions (company_id, department_id, name, code, level, parent_position_id, description)
    VALUES (p_company_id, v_sales_dept_id, 'Area Sales Manager (ASM)', 'ASM', 5, v_pos_rm, 'Oversees area operational distribution and territory officers')
    ON CONFLICT (company_id, name) DO UPDATE SET parent_position_id = v_pos_rm, level = 5
    RETURNING id INTO v_pos_asm;

    INSERT INTO positions (company_id, department_id, name, code, level, parent_position_id, description)
    VALUES (p_company_id, v_sales_dept_id, 'Territory Sales Officer (TSO)', 'TSO', 6, v_pos_asm, 'Manages territory distributors, approvals, and CSR operations')
    ON CONFLICT (company_id, name) DO UPDATE SET parent_position_id = v_pos_asm, level = 6
    RETURNING id INTO v_pos_tso;

    INSERT INTO positions (company_id, department_id, name, code, level, parent_position_id, description)
    VALUES (p_company_id, v_sales_dept_id, 'Field Sales Supervisor', 'SUP', 7, v_pos_tso, 'Direct field supervisor for customer sales representatives')
    ON CONFLICT (company_id, name) DO UPDATE SET parent_position_id = v_pos_tso, level = 7
    RETURNING id INTO v_pos_sup;

    INSERT INTO positions (company_id, department_id, name, code, level, parent_position_id, description)
    VALUES (p_company_id, v_sales_dept_id, 'Customer Sales Representative (CSR)', 'CSR', 8, v_pos_sup, 'Field route execution, daily sales logging, and outlet coverage')
    ON CONFLICT (company_id, name) DO UPDATE SET parent_position_id = v_pos_sup, level = 8
    RETURNING id INTO v_pos_csr;

    -- Marketing Tree
    INSERT INTO positions (company_id, department_id, name, code, level, parent_position_id, description)
    VALUES (p_company_id, v_mkt_dept_id, 'Head of Marketing', 'HOM', 3, v_pos_comm_dir, 'Leads company brand portfolio and product positioning')
    ON CONFLICT (company_id, name) DO UPDATE SET parent_position_id = v_pos_comm_dir, level = 3
    RETURNING id INTO v_pos_hom;

    INSERT INTO positions (company_id, department_id, name, code, level, parent_position_id, description)
    VALUES (p_company_id, v_mkt_dept_id, 'Brand Manager', 'BM', 4, v_pos_hom, 'Brand portfolio manager for cigarette and zarda products')
    ON CONFLICT (company_id, name) DO UPDATE SET parent_position_id = v_pos_hom, level = 4
    RETURNING id INTO v_pos_bm;

    INSERT INTO positions (company_id, department_id, name, code, level, parent_position_id, description)
    VALUES (p_company_id, v_mkt_dept_id, 'Trade Marketing Manager', 'TMM', 4, v_pos_hom, 'Retail channel activation and trade incentive programs')
    ON CONFLICT (company_id, name) DO UPDATE SET parent_position_id = v_pos_hom, level = 4
    RETURNING id INTO v_pos_tmm;

    INSERT INTO positions (company_id, department_id, name, code, level, parent_position_id, description)
    VALUES (p_company_id, v_mkt_dept_id, 'Trade Marketing Officer', 'TMO', 5, v_pos_tmm, 'Field merchandise and POSM display execution')
    ON CONFLICT (company_id, name) DO UPDATE SET parent_position_id = v_pos_tmm, level = 5
    RETURNING id INTO v_pos_tmo;

    INSERT INTO positions (company_id, department_id, name, code, level, parent_position_id, description)
    VALUES (p_company_id, v_mkt_dept_id, 'Marketing Executive', 'ME', 6, v_pos_tmo, 'Brand promotion campaigns and field survey execution')
    ON CONFLICT (company_id, name) DO UPDATE SET parent_position_id = v_pos_tmo, level = 6
    RETURNING id INTO v_pos_me;

    -- Distribution Tree
    INSERT INTO positions (company_id, department_id, name, code, level, parent_position_id, description)
    VALUES (p_company_id, v_dist_dept_id, 'Distributor Manager', 'DM', 5, v_pos_comm_dir, 'Manages partner distributors and fulfillment warehousing')
    ON CONFLICT (company_id, name) DO UPDATE SET parent_position_id = v_pos_comm_dir, level = 5
    RETURNING id INTO v_pos_dist_mgr;

    -- C. Provision Sample Distributor for Tenant
    SELECT id INTO v_terr_id FROM territories LIMIT 1;
    INSERT INTO distributors (company_id, name, code, proprietor_name, phone, address, territory_id, status)
    VALUES (
        p_company_id,
        'Satkania Central Distribution Agency',
        'DIST-SAT-01',
        'Haji Shamsul Alam',
        '+8801819001122',
        'Main Road, Kerani Hat, Satkania, Chattogram',
        v_terr_id,
        'ACTIVE'
    )
    ON CONFLICT (company_id, code) DO NOTHING
    RETURNING id INTO v_dist_id;

    -- D. Automatically link existing users of this tenant to departments and positions
    -- 1. CSR Users
    UPDATE user_profiles
    SET department_id = v_sales_dept_id, position_id = v_pos_csr
    WHERE (company_id = p_company_id OR company_id IS NULL)
      AND role_id IN (SELECT id FROM roles WHERE name = 'CSR')
      AND position_id IS NULL;

    -- 2. TSO Users
    UPDATE user_profiles
    SET department_id = v_sales_dept_id, position_id = v_pos_tso
    WHERE (company_id = p_company_id OR company_id IS NULL)
      AND role_id IN (SELECT id FROM roles WHERE name = 'TSO')
      AND position_id IS NULL;

    -- 3. RSO Users
    UPDATE user_profiles
    SET department_id = v_sales_dept_id, position_id = v_pos_rm
    WHERE (company_id = p_company_id OR company_id IS NULL)
      AND role_id IN (SELECT id FROM roles WHERE name = 'RSO')
      AND position_id IS NULL;

    -- 4. Company Admins
    UPDATE user_profiles
    SET department_id = v_sales_dept_id, position_id = v_pos_ceo
    WHERE (company_id = p_company_id OR company_id IS NULL)
      AND role_id IN (SELECT id FROM roles WHERE name IN ('COMPANY_ADMIN', 'TENANT_ADMIN'))
      AND position_id IS NULL;

    -- E. Link Supervisor chain for demo / seed users
    SELECT id INTO v_rso_user_id FROM user_profiles WHERE email = 'rso.satkania@afaztobacco.com' LIMIT 1;
    SELECT id INTO v_tso_user_id FROM user_profiles WHERE email = 'tso.keranihat@afaztobacco.com' LIMIT 1;

    IF v_rso_user_id IS NOT NULL AND v_tso_user_id IS NOT NULL THEN
        -- TSO reports to RSO
        UPDATE user_profiles SET supervisor_id = v_rso_user_id WHERE id = v_tso_user_id;
        -- CSR reports to TSO
        UPDATE user_profiles SET supervisor_id = v_tso_user_id WHERE email = 'csr.keranihat@afaztobacco.com';
    END IF;

    -- Update scope_level on user_scopes
    UPDATE user_scopes
    SET scope_level = CASE
        WHEN territory_id IS NOT NULL THEN 'TERRITORY'
        WHEN region_id IS NOT NULL THEN 'REGION'
        WHEN company_id IS NOT NULL THEN 'TENANT'
        ELSE 'TENANT'
    END
    WHERE scope_level IS NULL OR scope_level = '';

    RETURN jsonb_build_object(
        'success', true,
        'companyId', p_company_id,
        'departmentsCreated', 5,
        'positionsCreated', 14,
        'message', 'FMCG/Tobacco organization template successfully provisioned'
    );
END;
$$;

-- 8. Run template provisioner for all existing companies
DO $$
DECLARE
    c_rec RECORD;
BEGIN
    FOR c_rec IN SELECT id FROM companies LOOP
        PERFORM sp_provision_tenant_template(c_rec.id);
    END LOOP;
END $$;

-- 9. Update sp_get_users_paginated to include Department, Position, Supervisor, and Distributor
CREATE OR REPLACE FUNCTION sp_get_users_paginated(
    p_page INT DEFAULT 1,
    p_page_size INT DEFAULT 10,
    p_search TEXT DEFAULT NULL,
    p_company_id UUID DEFAULT NULL,
    p_role_name TEXT DEFAULT NULL,
    p_sort_by TEXT DEFAULT 'created_at',
    p_sort_order TEXT DEFAULT 'DESC'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_offset INT;
    v_total_count INT;
    v_items JSONB;
    v_actual_limit INT;
    v_page INT := GREATEST(COALESCE(p_page, 1), 1);
    v_page_size INT := COALESCE(p_page_size, 10);
    v_search TEXT := NULLIF(TRIM(p_search), '');
BEGIN
    SELECT COUNT(*)
    INTO v_total_count
    FROM user_profiles u
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN user_scopes us ON u.id = us.user_id
    WHERE (v_search IS NULL OR u.full_name ILIKE '%' || v_search || '%' OR u.email ILIKE '%' || v_search || '%' OR u.phone ILIKE '%' || v_search || '%')
      AND (p_company_id IS NULL OR us.company_id = p_company_id OR u.company_id = p_company_id)
      AND (p_role_name IS NULL OR p_role_name = 'ALL' OR r.name = p_role_name);

    IF v_page_size <= 0 THEN
        v_actual_limit := GREATEST(v_total_count, 1);
        v_offset := 0;
        v_page_size := v_total_count;
    ELSE
        v_actual_limit := v_page_size;
        v_offset := (v_page - 1) * v_page_size;
    END IF;

    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
    INTO v_items
    FROM (
        SELECT 
            u.id,
            u.email,
            u.full_name,
            u.phone,
            u.role_id,
            r.name AS role_name,
            u.is_active,
            u.created_at,
            u.updated_at,
            COALESCE(u.company_id, us.company_id) AS company_id,
            c.name AS company_name,
            c.code AS company_code,
            u.department_id,
            dept.name AS department_name,
            u.position_id,
            pos.name AS position_name,
            pos.level AS position_level,
            u.supervisor_id,
            sup.full_name AS supervisor_name,
            u.distributor_id,
            dist.name AS distributor_name,
            us.scope_level,
            us.region_id,
            reg.name AS region_name,
            us.territory_id,
            t.name AS territory_name,
            us.route_id,
            rt.name AS route_name
        FROM user_profiles u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN departments dept ON u.department_id = dept.id
        LEFT JOIN positions pos ON u.position_id = pos.id
        LEFT JOIN user_profiles sup ON u.supervisor_id = sup.id
        LEFT JOIN distributors dist ON u.distributor_id = dist.id
        LEFT JOIN user_scopes us ON u.id = us.user_id
        LEFT JOIN companies c ON COALESCE(u.company_id, us.company_id) = c.id
        LEFT JOIN regions reg ON us.region_id = reg.id
        LEFT JOIN territories t ON us.territory_id = t.id
        LEFT JOIN routes rt ON us.route_id = rt.id
        WHERE (v_search IS NULL OR u.full_name ILIKE '%' || v_search || '%' OR u.email ILIKE '%' || v_search || '%' OR u.phone ILIKE '%' || v_search || '%')
          AND (p_company_id IS NULL OR us.company_id = p_company_id OR u.company_id = p_company_id)
          AND (p_role_name IS NULL OR p_role_name = 'ALL' OR r.name = p_role_name)
        ORDER BY
            CASE WHEN p_sort_by = 'full_name' AND LOWER(p_sort_order) = 'asc' THEN u.full_name END ASC,
            CASE WHEN p_sort_by = 'full_name' AND LOWER(p_sort_order) = 'desc' THEN u.full_name END DESC,
            CASE WHEN p_sort_by = 'email' AND LOWER(p_sort_order) = 'asc' THEN u.email END ASC,
            CASE WHEN p_sort_by = 'email' AND LOWER(p_sort_order) = 'desc' THEN u.email END DESC,
            CASE WHEN p_sort_by = 'role_name' AND LOWER(p_sort_order) = 'asc' THEN r.name END ASC,
            CASE WHEN p_sort_by = 'role_name' AND LOWER(p_sort_order) = 'desc' THEN r.name END DESC,
            CASE WHEN p_sort_by = 'department_name' AND LOWER(p_sort_order) = 'asc' THEN dept.name END ASC,
            CASE WHEN p_sort_by = 'department_name' AND LOWER(p_sort_order) = 'desc' THEN dept.name END DESC,
            CASE WHEN p_sort_by = 'position_name' AND LOWER(p_sort_order) = 'asc' THEN pos.name END ASC,
            CASE WHEN p_sort_by = 'position_name' AND LOWER(p_sort_order) = 'desc' THEN pos.name END DESC,
            CASE WHEN p_sort_by = 'company_name' AND LOWER(p_sort_order) = 'asc' THEN c.name END ASC,
            CASE WHEN p_sort_by = 'company_name' AND LOWER(p_sort_order) = 'desc' THEN c.name END DESC,
            CASE WHEN p_sort_by = 'created_at' AND LOWER(p_sort_order) = 'asc' THEN u.created_at END ASC,
            CASE WHEN p_sort_by = 'created_at' AND LOWER(p_sort_order) = 'desc' THEN u.created_at END DESC,
            u.created_at DESC
        LIMIT v_actual_limit OFFSET v_offset
    ) sub;

    RETURN jsonb_build_object(
        'items', v_items,
        'pagination', jsonb_build_object(
            'page', v_page,
            'pageSize', v_page_size,
            'totalItems', v_total_count,
            'totalPages', CEIL(v_total_count::NUMERIC / GREATEST(v_page_size, 1)::NUMERIC)
        )
    );
END;
$$;
