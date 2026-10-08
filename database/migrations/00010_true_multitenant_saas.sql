-- ============================================================================
-- Afaz Tobacco Platform: True Multi-Tenant SaaS Architecture
-- Migration: 00010_true_multitenant_saas.sql
-- ============================================================================

-- 1. Enhance Companies Table for Tenant Management
ALTER TABLE companies ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'PRO';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'BDT';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Asia/Dhaka';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Update existing companies with default metadata if missing
UPDATE companies 
SET status = 'ACTIVE', plan = 'ENTERPRISE', currency = 'BDT', timezone = 'Asia/Dhaka' 
WHERE code = 'ATC' AND (status IS NULL OR plan IS NULL);

UPDATE companies 
SET status = 'ACTIVE', plan = 'PRO', currency = 'BDT', timezone = 'Asia/Dhaka' 
WHERE code = 'ATI' AND (status IS NULL OR plan IS NULL);


-- 2. Add company_id Tenant Ownership to Business Tables
ALTER TABLE brands ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE working_days ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE targets ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE daily_submissions ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE google_drive_files ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE google_sheet_syncs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;


-- 3. Populate existing rows with default company (ATC) if NULL
DO $$
DECLARE
    v_atc_id UUID;
BEGIN
    SELECT id INTO v_atc_id FROM companies WHERE code = 'ATC' LIMIT 1;

    IF v_atc_id IS NOT NULL THEN
        -- Brands
        UPDATE brands SET company_id = v_atc_id WHERE company_id IS NULL;

        -- Working days
        UPDATE working_days SET company_id = v_atc_id WHERE company_id IS NULL;

        -- Targets (derive from territory's company if possible, else ATC)
        UPDATE targets tg
        SET company_id = COALESCE(
            (SELECT d.company_id 
             FROM territories t 
             JOIN regions r ON t.region_id = r.id 
             JOIN wings w ON r.wing_id = w.id 
             JOIN divisions d ON w.division_id = d.id 
             WHERE t.id = tg.territory_id LIMIT 1),
            v_atc_id
        )
        WHERE tg.company_id IS NULL;

        -- Daily Submissions (derive from territory's company)
        UPDATE daily_submissions s
        SET company_id = COALESCE(
            (SELECT d.company_id 
             FROM territories t 
             JOIN regions r ON t.region_id = r.id 
             JOIN wings w ON r.wing_id = w.id 
             JOIN divisions d ON w.division_id = d.id 
             WHERE t.id = s.territory_id LIMIT 1),
            v_atc_id
        )
        WHERE s.company_id IS NULL;

        -- Audit Logs
        UPDATE audit_logs SET company_id = v_atc_id WHERE company_id IS NULL;
    END IF;
END $$;


-- 4. Update constraints for Tenant-Scoped Uniqueness
ALTER TABLE working_days DROP CONSTRAINT IF EXISTS working_days_year_month_key;
DO $$ BEGIN
    ALTER TABLE working_days ADD CONSTRAINT working_days_company_year_month_key UNIQUE (company_id, year, month);
EXCEPTION
    WHEN duplicate_table THEN NULL;
    WHEN duplicate_object THEN NULL;
END $$;


-- 5. Insert COMPANY_ADMIN Role
INSERT INTO roles (name, description)
VALUES ('COMPANY_ADMIN', 'Company Tenant Administrator with full company-level control')
ON CONFLICT (name) DO NOTHING;


-- 6. Subscription Plans Table
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    max_users INT DEFAULT 50,
    max_territories INT DEFAULT 20,
    max_storage_mb INT DEFAULT 5000,
    features JSONB DEFAULT '{"excel_export": true, "excel_import": true, "google_drive": true, "google_sheets": false, "advanced_analytics": true}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO subscription_plans (name, code, max_users, max_territories, max_storage_mb, features)
VALUES 
    ('Starter Tenant', 'STARTER', 10, 5, 1000, '{"excel_export": true, "excel_import": true, "google_drive": false, "google_sheets": false, "advanced_analytics": false}'::jsonb),
    ('Professional Tenant', 'PRO', 50, 25, 10000, '{"excel_export": true, "excel_import": true, "google_drive": true, "google_sheets": true, "advanced_analytics": true}'::jsonb),
    ('Enterprise SaaS', 'ENTERPRISE', 500, 200, 100000, '{"excel_export": true, "excel_import": true, "google_drive": true, "google_sheets": true, "advanced_analytics": true, "custom_template": true}'::jsonb)
ON CONFLICT (code) DO NOTHING;


-- 7. Company Settings Table
CREATE TABLE IF NOT EXISTS company_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE UNIQUE NOT NULL,
    currency VARCHAR(10) DEFAULT 'BDT',
    timezone VARCHAR(50) DEFAULT 'Asia/Dhaka',
    working_days INT DEFAULT 26,
    auto_lock_days INT DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed company_settings for existing companies
INSERT INTO company_settings (company_id, currency, timezone, working_days)
SELECT c.id, c.currency, c.timezone, 26
FROM companies c
ON CONFLICT (company_id) DO NOTHING;


-- 8. Enhanced RLS Helper Functions for Tenant Boundary
CREATE OR REPLACE FUNCTION public.current_user_company_id()
RETURNS UUID AS $$
    SELECT us.company_id
    FROM user_scopes us
    WHERE us.user_id = auth.uid()
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.can_access_company(target_company_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    u_role VARCHAR;
    u_comp UUID;
BEGIN
    SELECT public.current_user_role() INTO u_role;
    
    -- SUPER_ADMIN has global platform access to all companies
    IF u_role = 'SUPER_ADMIN' THEN
        RETURN TRUE;
    END IF;

    -- All other roles can ONLY access their own assigned company
    SELECT public.current_user_company_id() INTO u_comp;
    RETURN (u_comp IS NOT NULL AND u_comp = target_company_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- Update can_access_territory to support COMPANY_ADMIN
CREATE OR REPLACE FUNCTION public.can_access_territory(target_territory_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_role VARCHAR;
    user_comp UUID;
    target_comp UUID;
BEGIN
    SELECT public.current_user_role() INTO user_role;
    
    -- SUPER_ADMIN has global enterprise scope
    IF user_role = 'SUPER_ADMIN' THEN
        RETURN TRUE;
    END IF;

    SELECT public.current_user_company_id() INTO user_comp;

    -- Resolve target territory's company
    SELECT d.company_id INTO target_comp
    FROM territories t
    JOIN regions r ON t.region_id = r.id
    JOIN wings w ON r.wing_id = w.id
    JOIN divisions d ON w.division_id = d.id
    WHERE t.id = target_territory_id;

    -- Hard tenant isolation: Must match company
    IF user_comp IS NULL OR target_comp IS NULL OR user_comp != target_comp THEN
        RETURN FALSE;
    END IF;

    -- COMPANY_ADMIN has full access to all territories inside their own company
    IF user_role = 'COMPANY_ADMIN' THEN
        RETURN TRUE;
    END IF;
    
    -- TSO and CSR check direct territory assignment
    IF user_role IN ('TSO', 'CSR') THEN
        RETURN EXISTS (
            SELECT 1 FROM user_scopes s
            WHERE s.user_id = auth.uid()
              AND s.territory_id = target_territory_id
        );
    END IF;
    
    -- RSO checks regional scope containing the territory
    IF user_role = 'RSO' THEN
        RETURN EXISTS (
            SELECT 1 FROM user_scopes s
            WHERE s.user_id = auth.uid()
              AND s.region_id = (SELECT region_id FROM territories WHERE id = target_territory_id)
        );
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- 9. Update RLS Policies on Operational & Master Tables

-- Daily Submissions Policies
DROP POLICY IF EXISTS "Users can view submissions within their scope" ON daily_submissions;
CREATE POLICY "Users can view submissions within their scope"
ON daily_submissions FOR SELECT
USING (
    public.can_access_company(company_id) 
    AND public.can_access_territory(territory_id)
);

DROP POLICY IF EXISTS "Authorized users can insert submissions" ON daily_submissions;
CREATE POLICY "Authorized users can insert submissions"
ON daily_submissions FOR INSERT
WITH CHECK (
    public.can_access_company(company_id)
    AND public.can_access_territory(territory_id)
    AND (public.current_user_role() IN ('CSR', 'TSO', 'COMPANY_ADMIN', 'SUPER_ADMIN'))
);

DROP POLICY IF EXISTS "Authorized users can update submissions" ON daily_submissions;
CREATE POLICY "Authorized users can update submissions"
ON daily_submissions FOR UPDATE
USING (
    public.can_access_company(company_id)
    AND public.can_access_territory(territory_id)
    AND (
        (public.current_user_role() IN ('SUPER_ADMIN', 'COMPANY_ADMIN'))
        OR (is_locked = FALSE AND (
            (public.current_user_role() = 'CSR' AND status = 'DRAFT')
            OR (public.current_user_role() = 'TSO' AND status IN ('SUBMITTED', 'DRAFT'))
            OR (public.current_user_role() = 'RSO' AND status = 'TSO_APPROVED')
        ))
    )
);

-- Enable RLS on Brands & Targets
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view brands within their company" ON brands;
CREATE POLICY "Users can view brands within their company"
ON brands FOR SELECT
USING (public.can_access_company(company_id));

DROP POLICY IF EXISTS "Super and Company Admin can manage brands" ON brands;
CREATE POLICY "Super and Company Admin can manage brands"
ON brands FOR ALL
USING (
    public.can_access_company(company_id)
    AND (public.current_user_role() IN ('SUPER_ADMIN', 'COMPANY_ADMIN'))
);

ALTER TABLE targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view targets within their company" ON targets;
CREATE POLICY "Users can view targets within their company"
ON targets FOR SELECT
USING (
    public.can_access_company(company_id)
    AND public.can_access_territory(territory_id)
);

DROP POLICY IF EXISTS "Super and Company Admin can manage targets" ON targets;
CREATE POLICY "Super and Company Admin can manage targets"
ON targets FOR ALL
USING (
    public.can_access_company(company_id)
    AND (public.current_user_role() IN ('SUPER_ADMIN', 'COMPANY_ADMIN'))
);


-- 10. Updated Stored Procedures for Multi-Tenant Listing

-- sp_get_companies_paginated (with Tenant SaaS info)
CREATE OR REPLACE FUNCTION sp_get_companies_paginated(
    p_page INT DEFAULT 1,
    p_page_size INT DEFAULT 10,
    p_search TEXT DEFAULT NULL,
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
    FROM companies c
    WHERE (v_search IS NULL OR c.name ILIKE '%' || v_search || '%' OR c.code ILIKE '%' || v_search || '%');

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
            c.id,
            c.name,
            c.code,
            COALESCE(c.status, 'ACTIVE') AS status,
            COALESCE(c.plan, 'PRO') AS plan,
            c.contact_email,
            c.contact_phone,
            c.currency,
            c.timezone,
            c.created_at,
            (SELECT COUNT(*) FROM divisions d WHERE d.company_id = c.id) AS division_count,
            (SELECT COUNT(*) 
             FROM territories t 
             JOIN regions r ON t.region_id = r.id 
             JOIN wings w ON r.wing_id = w.id 
             JOIN divisions d ON w.division_id = d.id 
             WHERE d.company_id = c.id) AS territory_count,
            (SELECT COUNT(*) 
             FROM user_scopes us 
             WHERE us.company_id = c.id) AS user_count,
            (SELECT COUNT(*)
             FROM daily_submissions s
             WHERE s.company_id = c.id) AS submission_count
        FROM companies c
        WHERE (v_search IS NULL OR c.name ILIKE '%' || v_search || '%' OR c.code ILIKE '%' || v_search || '%')
        ORDER BY
            CASE WHEN p_sort_by = 'name' AND LOWER(p_sort_order) = 'asc' THEN c.name END ASC,
            CASE WHEN p_sort_by = 'name' AND LOWER(p_sort_order) = 'desc' THEN c.name END DESC,
            CASE WHEN p_sort_by = 'code' AND LOWER(p_sort_order) = 'asc' THEN c.code END ASC,
            CASE WHEN p_sort_by = 'code' AND LOWER(p_sort_order) = 'desc' THEN c.code END DESC,
            CASE WHEN p_sort_by = 'status' AND LOWER(p_sort_order) = 'asc' THEN c.status END ASC,
            CASE WHEN p_sort_by = 'status' AND LOWER(p_sort_order) = 'desc' THEN c.status END DESC,
            CASE WHEN p_sort_by = 'created_at' AND LOWER(p_sort_order) = 'asc' THEN c.created_at END ASC,
            CASE WHEN p_sort_by = 'created_at' AND LOWER(p_sort_order) = 'desc' THEN c.created_at END DESC,
            c.created_at DESC
        LIMIT v_actual_limit OFFSET v_offset
    ) sub;

    RETURN jsonb_build_object(
        'items', v_items,
        'totalCount', v_total_count,
        'page', v_page,
        'pageSize', v_page_size,
        'totalPages', CEIL(v_total_count::numeric / GREATEST(v_page_size, 1))
    );
END;
$$;


-- sp_get_brands_paginated (Company-Aware)
CREATE OR REPLACE FUNCTION sp_get_brands_paginated(
    p_page INT DEFAULT 1,
    p_page_size INT DEFAULT 10,
    p_search TEXT DEFAULT NULL,
    p_type TEXT DEFAULT NULL,
    p_company_id UUID DEFAULT NULL,
    p_sort_by TEXT DEFAULT 'sort_order',
    p_sort_order TEXT DEFAULT 'ASC'
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
    FROM brands b
    WHERE (v_search IS NULL OR b.name ILIKE '%' || v_search || '%')
      AND (p_type IS NULL OR p_type = 'ALL' OR b.type::text = p_type)
      AND (p_company_id IS NULL OR b.company_id IS NULL OR b.company_id = p_company_id);

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
            b.id,
            b.name,
            b.type::text AS type,
            b.sort_order,
            b.is_active,
            b.company_id,
            c.name AS company_name,
            b.created_at,
            COALESCE(p.unit_price, 0)::numeric(12, 4) AS unit_price,
            p.effective_from::text AS effective_from
        FROM brands b
        LEFT JOIN companies c ON b.company_id = c.id
        LEFT JOIN LATERAL (
            SELECT unit_price, effective_from
            FROM prices pr
            WHERE pr.brand_id = b.id
            ORDER BY effective_from DESC
            LIMIT 1
        ) p ON TRUE
        WHERE (v_search IS NULL OR b.name ILIKE '%' || v_search || '%')
          AND (p_type IS NULL OR p_type = 'ALL' OR b.type::text = p_type)
          AND (p_company_id IS NULL OR b.company_id IS NULL OR b.company_id = p_company_id)
        ORDER BY
            CASE WHEN p_sort_by = 'name' AND LOWER(p_sort_order) = 'asc' THEN b.name END ASC,
            CASE WHEN p_sort_by = 'name' AND LOWER(p_sort_order) = 'desc' THEN b.name END DESC,
            CASE WHEN p_sort_by = 'type' AND LOWER(p_sort_order) = 'asc' THEN b.type::text END ASC,
            CASE WHEN p_sort_by = 'type' AND LOWER(p_sort_order) = 'desc' THEN b.type::text END DESC,
            CASE WHEN p_sort_by = 'sort_order' AND LOWER(p_sort_order) = 'asc' THEN b.sort_order END ASC,
            CASE WHEN p_sort_by = 'sort_order' AND LOWER(p_sort_order) = 'desc' THEN b.sort_order END DESC,
            b.sort_order ASC
        LIMIT v_actual_limit OFFSET v_offset
    ) sub;

    RETURN jsonb_build_object(
        'items', v_items,
        'totalCount', v_total_count,
        'page', v_page,
        'pageSize', v_page_size,
        'totalPages', CEIL(v_total_count::numeric / GREATEST(v_page_size, 1))
    );
END;
$$;


-- sp_get_targets_paginated (Company-Aware)
CREATE OR REPLACE FUNCTION sp_get_targets_paginated(
    p_page INT DEFAULT 1,
    p_page_size INT DEFAULT 10,
    p_search TEXT DEFAULT NULL,
    p_year INT DEFAULT NULL,
    p_month INT DEFAULT NULL,
    p_territory_id UUID DEFAULT NULL,
    p_company_id UUID DEFAULT NULL,
    p_sort_by TEXT DEFAULT 'territory_name',
    p_sort_order TEXT DEFAULT 'ASC'
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
    FROM targets tg
    JOIN territories t ON tg.territory_id = t.id
    JOIN brands b ON tg.brand_id = b.id
    JOIN regions r ON t.region_id = r.id
    JOIN wings w ON r.wing_id = w.id
    JOIN divisions d ON w.division_id = d.id
    JOIN companies c ON d.company_id = c.id
    WHERE (v_search IS NULL OR t.name ILIKE '%' || v_search || '%' OR b.name ILIKE '%' || v_search || '%')
      AND (p_year IS NULL OR tg.year = p_year)
      AND (p_month IS NULL OR tg.month = p_month)
      AND (p_territory_id IS NULL OR tg.territory_id = p_territory_id)
      AND (p_company_id IS NULL OR c.id = p_company_id OR tg.company_id = p_company_id);

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
            tg.id,
            tg.territory_id,
            t.name AS territory_name,
            r.name AS region_name,
            c.name AS company_name,
            tg.brand_id,
            b.name AS brand_name,
            b.type::text AS brand_type,
            tg.year,
            tg.month,
            tg.target_quantity::numeric(14, 4) AS target_quantity,
            tg.route_count,
            tg.outlet_count,
            tg.created_at
        FROM targets tg
        JOIN territories t ON tg.territory_id = t.id
        JOIN regions r ON t.region_id = r.id
        JOIN wings w ON r.wing_id = w.id
        JOIN divisions d ON w.division_id = d.id
        JOIN companies c ON d.company_id = c.id
        JOIN brands b ON tg.brand_id = b.id
        WHERE (v_search IS NULL OR t.name ILIKE '%' || v_search || '%' OR b.name ILIKE '%' || v_search || '%')
          AND (p_year IS NULL OR tg.year = p_year)
          AND (p_month IS NULL OR tg.month = p_month)
          AND (p_territory_id IS NULL OR tg.territory_id = p_territory_id)
          AND (p_company_id IS NULL OR c.id = p_company_id OR tg.company_id = p_company_id)
        ORDER BY
            CASE WHEN p_sort_by = 'territory_name' AND LOWER(p_sort_order) = 'asc' THEN t.name END ASC,
            CASE WHEN p_sort_by = 'territory_name' AND LOWER(p_sort_order) = 'desc' THEN t.name END DESC,
            CASE WHEN p_sort_by = 'brand_name' AND LOWER(p_sort_order) = 'asc' THEN b.name END ASC,
            CASE WHEN p_sort_by = 'brand_name' AND LOWER(p_sort_order) = 'desc' THEN b.name END DESC,
            CASE WHEN p_sort_by = 'target_quantity' AND LOWER(p_sort_order) = 'asc' THEN tg.target_quantity END ASC,
            CASE WHEN p_sort_by = 'target_quantity' AND LOWER(p_sort_order) = 'desc' THEN tg.target_quantity END DESC,
            t.sort_order ASC, b.sort_order ASC
        LIMIT v_actual_limit OFFSET v_offset
    ) sub;

    RETURN jsonb_build_object(
        'items', v_items,
        'totalCount', v_total_count,
        'page', v_page,
        'pageSize', v_page_size,
        'totalPages', CEIL(v_total_count::numeric / GREATEST(v_page_size, 1))
    );
END;
$$;


-- sp_get_audit_logs_paginated (Company-Aware)
CREATE OR REPLACE FUNCTION sp_get_audit_logs_paginated(
    p_page INT DEFAULT 1,
    p_page_size INT DEFAULT 10,
    p_search TEXT DEFAULT NULL,
    p_event_type TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_company_id UUID DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL,
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
    FROM audit_logs a
    LEFT JOIN user_profiles u ON a.user_id = u.id
    LEFT JOIN user_scopes us ON u.id = us.user_id
    WHERE (v_search IS NULL OR a.event_type ILIKE '%' || v_search || '%' OR COALESCE(a.entity_name, '') ILIKE '%' || v_search || '%' OR COALESCE(u.email, '') ILIKE '%' || v_search || '%')
      AND (p_event_type IS NULL OR p_event_type = 'ALL' OR a.event_type = p_event_type)
      AND (p_user_id IS NULL OR a.user_id = p_user_id)
      AND (p_company_id IS NULL OR a.company_id = p_company_id OR us.company_id = p_company_id)
      AND (p_start_date IS NULL OR a.created_at >= p_start_date)
      AND (p_end_date IS NULL OR a.created_at <= p_end_date);

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
            a.id,
            a.event_type,
            a.entity_name,
            a.entity_id,
            a.user_id,
            u.email AS user_email,
            a.company_id,
            c.name AS company_name,
            a.ip_address,
            a.old_values,
            a.new_values,
            a.created_at
        FROM audit_logs a
        LEFT JOIN user_profiles u ON a.user_id = u.id
        LEFT JOIN user_scopes us ON u.id = us.user_id
        LEFT JOIN companies c ON COALESCE(a.company_id, us.company_id) = c.id
        WHERE (v_search IS NULL OR a.event_type ILIKE '%' || v_search || '%' OR COALESCE(a.entity_name, '') ILIKE '%' || v_search || '%' OR COALESCE(u.email, '') ILIKE '%' || v_search || '%')
          AND (p_event_type IS NULL OR p_event_type = 'ALL' OR a.event_type = p_event_type)
          AND (p_user_id IS NULL OR a.user_id = p_user_id)
          AND (p_company_id IS NULL OR a.company_id = p_company_id OR us.company_id = p_company_id)
          AND (p_start_date IS NULL OR a.created_at >= p_start_date)
          AND (p_end_date IS NULL OR a.created_at <= p_end_date)
        ORDER BY
            CASE WHEN p_sort_by = 'event_type' AND LOWER(p_sort_order) = 'asc' THEN a.event_type END ASC,
            CASE WHEN p_sort_by = 'event_type' AND LOWER(p_sort_order) = 'desc' THEN a.event_type END DESC,
            CASE WHEN p_sort_by = 'created_at' AND LOWER(p_sort_order) = 'asc' THEN a.created_at END ASC,
            CASE WHEN p_sort_by = 'created_at' AND LOWER(p_sort_order) = 'desc' THEN a.created_at END DESC,
            a.created_at DESC
        LIMIT v_actual_limit OFFSET v_offset
    ) sub;

    RETURN jsonb_build_object(
        'items', v_items,
        'totalCount', v_total_count,
        'page', v_page,
        'pageSize', v_page_size,
        'totalPages', CEIL(v_total_count::numeric / GREATEST(v_page_size, 1))
    );
END;
$$;


-- 11. Stored Procedure: sp_get_platform_stats (Super Admin Multi-Tenant SaaS Overview)
CREATE OR REPLACE FUNCTION sp_get_platform_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_companies INT;
    v_active_companies INT;
    v_suspended_companies INT;
    v_total_users INT;
    v_total_territories INT;
    v_total_submissions INT;
    v_today_sales NUMERIC(14, 4);
    v_mtd_sales NUMERIC(14, 4);
BEGIN
    SELECT COUNT(*) INTO v_total_companies FROM companies;
    SELECT COUNT(*) INTO v_active_companies FROM companies WHERE COALESCE(status, 'ACTIVE') = 'ACTIVE';
    SELECT COUNT(*) INTO v_suspended_companies FROM companies WHERE status = 'SUSPENDED';
    SELECT COUNT(*) INTO v_total_users FROM user_profiles;
    SELECT COUNT(*) INTO v_total_territories FROM territories;
    SELECT COUNT(*) INTO v_total_submissions FROM daily_submissions;

    -- Today's sales across all tenants
    SELECT COALESCE(SUM(ds.quantity), 0)
    INTO v_today_sales
    FROM daily_sales ds
    JOIN daily_submissions s ON ds.submission_id = s.id
    WHERE s.report_date = CURRENT_DATE;

    -- MTD sales across all tenants
    SELECT COALESCE(SUM(ds.quantity), 0)
    INTO v_mtd_sales
    FROM daily_sales ds
    JOIN daily_submissions s ON ds.submission_id = s.id
    WHERE DATE_TRUNC('month', s.report_date) = DATE_TRUNC('month', CURRENT_DATE);

    RETURN jsonb_build_object(
        'totalCompanies', v_total_companies,
        'activeCompanies', v_active_companies,
        'suspendedCompanies', v_suspended_companies,
        'totalUsers', v_total_users,
        'totalTerritories', v_total_territories,
        'totalSubmissions', v_total_submissions,
        'todaySales', v_today_sales,
        'mtdSales', v_mtd_sales
    );
END;
$$;
