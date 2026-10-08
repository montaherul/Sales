-- ============================================================================
-- Afaz Tobacco Platform: Stored Procedures / Functions for Server-Side Listing
-- Migration: 00006_stored_procedures.sql
-- ============================================================================

-- Ensure daily_submissions has remarks column for flexible operational notes
ALTER TABLE daily_submissions ADD COLUMN IF NOT EXISTS remarks TEXT;

-- ----------------------------------------------------------------------------
-- 1. sp_get_companies_paginated
-- ----------------------------------------------------------------------------
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
    -- 1. Calculate matching records count
    SELECT COUNT(*)
    INTO v_total_count
    FROM companies c
    WHERE (v_search IS NULL OR c.name ILIKE '%' || v_search || '%' OR c.code ILIKE '%' || v_search || '%');

    -- If page_size <= 0, export mode (return all records)
    IF v_page_size <= 0 THEN
        v_actual_limit := GREATEST(v_total_count, 1);
        v_offset := 0;
        v_page_size := v_total_count;
    ELSE
        v_actual_limit := v_page_size;
        v_offset := (v_page - 1) * v_page_size;
    END IF;

    -- 2. Fetch rows with aggregated division, territory, and user statistics
    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
    INTO v_items
    FROM (
        SELECT 
            c.id,
            c.name,
            c.code,
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
             WHERE us.company_id = c.id) AS user_count
        FROM companies c
        WHERE (v_search IS NULL OR c.name ILIKE '%' || v_search || '%' OR c.code ILIKE '%' || v_search || '%')
        ORDER BY
            CASE WHEN p_sort_by = 'name' AND LOWER(p_sort_order) = 'asc' THEN c.name END ASC,
            CASE WHEN p_sort_by = 'name' AND LOWER(p_sort_order) = 'desc' THEN c.name END DESC,
            CASE WHEN p_sort_by = 'code' AND LOWER(p_sort_order) = 'asc' THEN c.code END ASC,
            CASE WHEN p_sort_by = 'code' AND LOWER(p_sort_order) = 'desc' THEN c.code END DESC,
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


-- ----------------------------------------------------------------------------
-- 2. sp_get_users_paginated
-- ----------------------------------------------------------------------------
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
      AND (p_company_id IS NULL OR us.company_id = p_company_id)
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
            us.company_id,
            c.name AS company_name,
            us.region_id,
            reg.name AS region_name,
            us.territory_id,
            t.name AS territory_name
        FROM user_profiles u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN user_scopes us ON u.id = us.user_id
        LEFT JOIN companies c ON us.company_id = c.id
        LEFT JOIN regions reg ON us.region_id = reg.id
        LEFT JOIN territories t ON us.territory_id = t.id
        WHERE (v_search IS NULL OR u.full_name ILIKE '%' || v_search || '%' OR u.email ILIKE '%' || v_search || '%' OR u.phone ILIKE '%' || v_search || '%')
          AND (p_company_id IS NULL OR us.company_id = p_company_id)
          AND (p_role_name IS NULL OR p_role_name = 'ALL' OR r.name = p_role_name)
        ORDER BY
            CASE WHEN p_sort_by = 'full_name' AND LOWER(p_sort_order) = 'asc' THEN u.full_name END ASC,
            CASE WHEN p_sort_by = 'full_name' AND LOWER(p_sort_order) = 'desc' THEN u.full_name END DESC,
            CASE WHEN p_sort_by = 'email' AND LOWER(p_sort_order) = 'asc' THEN u.email END ASC,
            CASE WHEN p_sort_by = 'email' AND LOWER(p_sort_order) = 'desc' THEN u.email END DESC,
            CASE WHEN p_sort_by = 'role_name' AND LOWER(p_sort_order) = 'asc' THEN r.name END ASC,
            CASE WHEN p_sort_by = 'role_name' AND LOWER(p_sort_order) = 'desc' THEN r.name END DESC,
            CASE WHEN p_sort_by = 'created_at' AND LOWER(p_sort_order) = 'asc' THEN u.created_at END ASC,
            CASE WHEN p_sort_by = 'created_at' AND LOWER(p_sort_order) = 'desc' THEN u.created_at END DESC,
            u.created_at DESC
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


-- ----------------------------------------------------------------------------
-- 3. sp_get_daily_submissions_paginated
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_get_daily_submissions_paginated(
    p_page INT DEFAULT 1,
    p_page_size INT DEFAULT 10,
    p_search TEXT DEFAULT NULL,
    p_report_date DATE DEFAULT NULL,
    p_territory_id UUID DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_company_id UUID DEFAULT NULL,
    p_sort_by TEXT DEFAULT 'reporting_date',
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
    FROM daily_submissions s
    JOIN territories t ON s.territory_id = t.id
    JOIN regions r ON t.region_id = r.id
    JOIN wings w ON r.wing_id = w.id
    JOIN divisions d ON w.division_id = d.id
    JOIN companies c ON d.company_id = c.id
    WHERE (v_search IS NULL OR t.name ILIKE '%' || v_search || '%' OR r.name ILIKE '%' || v_search || '%' OR COALESCE(s.remarks, '') ILIKE '%' || v_search || '%')
      AND (p_report_date IS NULL OR s.report_date = p_report_date)
      AND (p_territory_id IS NULL OR s.territory_id = p_territory_id)
      AND (p_status IS NULL OR p_status = 'ALL' OR s.status::text = p_status)
      AND (p_company_id IS NULL OR c.id = p_company_id);

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
            s.id,
            s.territory_id,
            s.report_date::text AS reporting_date,
            EXTRACT(DAY FROM s.report_date)::int AS day_number,
            s.status::text AS status,
            s.is_locked,
            s.unlock_reason,
            COALESCE(s.remarks, '') AS remarks,
            s.created_at,
            s.updated_at,
            t.name AS territory_name,
            r.name AS region_name,
            c.name AS company_name,
            -- Cigarette Brand Sales
            COALESCE((SELECT quantity FROM daily_sales ds JOIN brands b ON ds.brand_id = b.id WHERE ds.submission_id = s.id AND b.name = 'Wilson'), 0)::numeric(12, 4) AS c_wilson_sales,
            COALESCE((SELECT quantity FROM daily_sales ds JOIN brands b ON ds.brand_id = b.id WHERE ds.submission_id = s.id AND b.name = 'Shahara'), 0)::numeric(12, 4) AS c_shahara_sales,
            COALESCE((SELECT quantity FROM daily_sales ds JOIN brands b ON ds.brand_id = b.id WHERE ds.submission_id = s.id AND b.name = 'Express'), 0)::numeric(12, 4) AS c_express_sales,
            COALESCE((SELECT quantity FROM daily_sales ds JOIN brands b ON ds.brand_id = b.id WHERE ds.submission_id = s.id AND b.name = 'Nexus'), 0)::numeric(12, 4) AS c_nexus_sales,
            COALESCE((SELECT quantity FROM daily_sales ds JOIN brands b ON ds.brand_id = b.id WHERE ds.submission_id = s.id AND b.name = 'SB'), 0)::numeric(12, 4) AS c_sb_sales,
            COALESCE((SELECT quantity FROM daily_sales ds JOIN brands b ON ds.brand_id = b.id WHERE ds.submission_id = s.id AND b.name = 'SM'), 0)::numeric(12, 4) AS c_sm_sales,
            -- Cigarette Brand Stock
            COALESCE((SELECT closing_stock FROM daily_stock dst JOIN brands b ON dst.brand_id = b.id WHERE dst.submission_id = s.id AND b.name = 'Wilson'), 0)::numeric(12, 4) AS c_wilson_stock,
            COALESCE((SELECT closing_stock FROM daily_stock dst JOIN brands b ON dst.brand_id = b.id WHERE dst.submission_id = s.id AND b.name = 'Shahara'), 0)::numeric(12, 4) AS c_shahara_stock,
            COALESCE((SELECT closing_stock FROM daily_stock dst JOIN brands b ON dst.brand_id = b.id WHERE dst.submission_id = s.id AND b.name = 'Express'), 0)::numeric(12, 4) AS c_express_stock,
            COALESCE((SELECT closing_stock FROM daily_stock dst JOIN brands b ON dst.brand_id = b.id WHERE dst.submission_id = s.id AND b.name = 'Nexus'), 0)::numeric(12, 4) AS c_nexus_stock,
            COALESCE((SELECT closing_stock FROM daily_stock dst JOIN brands b ON dst.brand_id = b.id WHERE dst.submission_id = s.id AND b.name = 'SB'), 0)::numeric(12, 4) AS c_sb_stock,
            COALESCE((SELECT closing_stock FROM daily_stock dst JOIN brands b ON dst.brand_id = b.id WHERE dst.submission_id = s.id AND b.name = 'SM'), 0)::numeric(12, 4) AS c_sm_stock,
            -- Zarda Sales
            COALESCE((SELECT quantity FROM zarda_sales zs JOIN brands b ON zs.brand_id = b.id WHERE zs.submission_id = s.id AND b.name = 'SLB'), 0)::numeric(12, 4) AS z_slb_sales,
            COALESCE((SELECT quantity FROM zarda_sales zs JOIN brands b ON zs.brand_id = b.id WHERE zs.submission_id = s.id AND b.name = '22/25'), 0)::int AS z_22_25_sales,
            COALESCE((SELECT quantity FROM zarda_sales zs JOIN brands b ON zs.brand_id = b.id WHERE zs.submission_id = s.id AND b.name = '99/14'), 0)::int AS z_99_14_sales,
            COALESCE((SELECT quantity FROM zarda_sales zs JOIN brands b ON zs.brand_id = b.id WHERE zs.submission_id = s.id AND b.name = '33/15'), 0)::int AS z_33_15_sales,
            -- Zarda Stock
            COALESCE((SELECT closing_stock FROM zarda_stock zst JOIN brands b ON zst.brand_id = b.id WHERE zst.submission_id = s.id AND b.name = 'SLB'), 0)::numeric(12, 4) AS z_slb_stock,
            COALESCE((SELECT closing_stock FROM zarda_stock zst JOIN brands b ON zst.brand_id = b.id WHERE zst.submission_id = s.id AND b.name = '22/25'), 0)::int AS z_22_25_stock,
            COALESCE((SELECT closing_stock FROM zarda_stock zst JOIN brands b ON zst.brand_id = b.id WHERE zst.submission_id = s.id AND b.name = '99/14'), 0)::int AS z_99_14_stock,
            COALESCE((SELECT closing_stock FROM zarda_stock zst JOIN brands b ON zst.brand_id = b.id WHERE zst.submission_id = s.id AND b.name = '33/15'), 0)::int AS z_33_15_stock,
            -- Empty Packets & Total Values
            COALESCE((SELECT quantity FROM empty_packets ep JOIN brands b ON ep.brand_id = b.id WHERE ep.submission_id = s.id AND b.name = 'Express'), 0)::int AS empty_packets,
            COALESCE((SELECT SUM(quantity) FROM daily_sales ds WHERE ds.submission_id = s.id), 0)::numeric(12, 4) AS total_cigarette_sales,
            COALESCE((SELECT SUM(closing_stock) FROM daily_stock dst WHERE dst.submission_id = s.id), 0)::numeric(12, 4) AS total_cigarette_stock,
            COALESCE((SELECT SUM(total_value) FROM zarda_sales zs WHERE zs.submission_id = s.id), 0)::numeric(12, 4) AS total_zarda_sales_value,
            COALESCE((SELECT SUM(total_value) FROM zarda_stock zst WHERE zst.submission_id = s.id), 0)::numeric(12, 4) AS total_zarda_stock_value
        FROM daily_submissions s
        JOIN territories t ON s.territory_id = t.id
        JOIN regions r ON t.region_id = r.id
        JOIN wings w ON r.wing_id = w.id
        JOIN divisions d ON w.division_id = d.id
        JOIN companies c ON d.company_id = c.id
        WHERE (v_search IS NULL OR t.name ILIKE '%' || v_search || '%' OR r.name ILIKE '%' || v_search || '%' OR COALESCE(s.remarks, '') ILIKE '%' || v_search || '%')
          AND (p_report_date IS NULL OR s.report_date = p_report_date)
          AND (p_territory_id IS NULL OR s.territory_id = p_territory_id)
          AND (p_status IS NULL OR p_status = 'ALL' OR s.status::text = p_status)
          AND (p_company_id IS NULL OR c.id = p_company_id)
        ORDER BY
            CASE WHEN p_sort_by = 'reporting_date' AND LOWER(p_sort_order) = 'asc' THEN s.report_date END ASC,
            CASE WHEN p_sort_by = 'reporting_date' AND LOWER(p_sort_order) = 'desc' THEN s.report_date END DESC,
            CASE WHEN p_sort_by = 'territory_name' AND LOWER(p_sort_order) = 'asc' THEN t.name END ASC,
            CASE WHEN p_sort_by = 'territory_name' AND LOWER(p_sort_order) = 'desc' THEN t.name END DESC,
            CASE WHEN p_sort_by = 'status' AND LOWER(p_sort_order) = 'asc' THEN s.status::text END ASC,
            CASE WHEN p_sort_by = 'status' AND LOWER(p_sort_order) = 'desc' THEN s.status::text END DESC,
            s.report_date DESC, t.sort_order ASC
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


-- ----------------------------------------------------------------------------
-- 4. sp_get_territories_paginated
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_get_territories_paginated(
    p_page INT DEFAULT 1,
    p_page_size INT DEFAULT 10,
    p_search TEXT DEFAULT NULL,
    p_region_id UUID DEFAULT NULL,
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
    FROM territories t
    JOIN regions r ON t.region_id = r.id
    JOIN wings w ON r.wing_id = w.id
    JOIN divisions d ON w.division_id = d.id
    JOIN companies c ON d.company_id = c.id
    WHERE (v_search IS NULL OR t.name ILIKE '%' || v_search || '%' OR r.name ILIKE '%' || v_search || '%')
      AND (p_region_id IS NULL OR t.region_id = p_region_id)
      AND (p_company_id IS NULL OR c.id = p_company_id);

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
            t.id,
            t.name,
            t.sort_order,
            t.created_at,
            r.id AS region_id,
            r.name AS region_name,
            w.name AS wing_name,
            d.name AS division_name,
            c.name AS company_name,
            (SELECT COUNT(*) FROM routes rt WHERE rt.territory_id = t.id) AS route_count,
            (SELECT COUNT(*) FROM outlets o JOIN routes rt ON o.route_id = rt.id WHERE rt.territory_id = t.id) AS outlet_count
        FROM territories t
        JOIN regions r ON t.region_id = r.id
        JOIN wings w ON r.wing_id = w.id
        JOIN divisions d ON w.division_id = d.id
        JOIN companies c ON d.company_id = c.id
        WHERE (v_search IS NULL OR t.name ILIKE '%' || v_search || '%' OR r.name ILIKE '%' || v_search || '%')
          AND (p_region_id IS NULL OR t.region_id = p_region_id)
          AND (p_company_id IS NULL OR c.id = p_company_id)
        ORDER BY
            CASE WHEN p_sort_by = 'name' AND LOWER(p_sort_order) = 'asc' THEN t.name END ASC,
            CASE WHEN p_sort_by = 'name' AND LOWER(p_sort_order) = 'desc' THEN t.name END DESC,
            CASE WHEN p_sort_by = 'region_name' AND LOWER(p_sort_order) = 'asc' THEN r.name END ASC,
            CASE WHEN p_sort_by = 'region_name' AND LOWER(p_sort_order) = 'desc' THEN r.name END DESC,
            CASE WHEN p_sort_by = 'sort_order' AND LOWER(p_sort_order) = 'asc' THEN t.sort_order END ASC,
            CASE WHEN p_sort_by = 'sort_order' AND LOWER(p_sort_order) = 'desc' THEN t.sort_order END DESC,
            t.sort_order ASC
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


-- ----------------------------------------------------------------------------
-- 5. sp_get_brands_paginated
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_get_brands_paginated(
    p_page INT DEFAULT 1,
    p_page_size INT DEFAULT 10,
    p_search TEXT DEFAULT NULL,
    p_type TEXT DEFAULT NULL,
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
      AND (p_type IS NULL OR p_type = 'ALL' OR b.type::text = p_type);

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
            b.created_at,
            COALESCE(p.unit_price, 0)::numeric(12, 4) AS unit_price,
            p.effective_from::text AS effective_from
        FROM brands b
        LEFT JOIN LATERAL (
            SELECT unit_price, effective_from
            FROM prices pr
            WHERE pr.brand_id = b.id
            ORDER BY effective_from DESC
            LIMIT 1
        ) p ON TRUE
        WHERE (v_search IS NULL OR b.name ILIKE '%' || v_search || '%')
          AND (p_type IS NULL OR p_type = 'ALL' OR b.type::text = p_type)
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


-- ----------------------------------------------------------------------------
-- 6. sp_get_targets_paginated
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_get_targets_paginated(
    p_page INT DEFAULT 1,
    p_page_size INT DEFAULT 10,
    p_search TEXT DEFAULT NULL,
    p_year INT DEFAULT NULL,
    p_month INT DEFAULT NULL,
    p_territory_id UUID DEFAULT NULL,
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
    WHERE (v_search IS NULL OR t.name ILIKE '%' || v_search || '%' OR b.name ILIKE '%' || v_search || '%')
      AND (p_year IS NULL OR tg.year = p_year)
      AND (p_month IS NULL OR tg.month = p_month)
      AND (p_territory_id IS NULL OR tg.territory_id = p_territory_id);

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
        JOIN brands b ON tg.brand_id = b.id
        WHERE (v_search IS NULL OR t.name ILIKE '%' || v_search || '%' OR b.name ILIKE '%' || v_search || '%')
          AND (p_year IS NULL OR tg.year = p_year)
          AND (p_month IS NULL OR tg.month = p_month)
          AND (p_territory_id IS NULL OR tg.territory_id = p_territory_id)
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


-- ----------------------------------------------------------------------------
-- 7. sp_get_audit_logs_paginated
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_get_audit_logs_paginated(
    p_page INT DEFAULT 1,
    p_page_size INT DEFAULT 10,
    p_search TEXT DEFAULT NULL,
    p_event_type TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
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
    WHERE (v_search IS NULL OR a.event_type ILIKE '%' || v_search || '%' OR COALESCE(a.entity_name, '') ILIKE '%' || v_search || '%' OR COALESCE(u.email, '') ILIKE '%' || v_search || '%')
      AND (p_event_type IS NULL OR p_event_type = 'ALL' OR a.event_type = p_event_type)
      AND (p_user_id IS NULL OR a.user_id = p_user_id)
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
            a.ip_address,
            a.old_values,
            a.new_values,
            a.created_at
        FROM audit_logs a
        LEFT JOIN user_profiles u ON a.user_id = u.id
        WHERE (v_search IS NULL OR a.event_type ILIKE '%' || v_search || '%' OR COALESCE(a.entity_name, '') ILIKE '%' || v_search || '%' OR COALESCE(u.email, '') ILIKE '%' || v_search || '%')
          AND (p_event_type IS NULL OR p_event_type = 'ALL' OR a.event_type = p_event_type)
          AND (p_user_id IS NULL OR a.user_id = p_user_id)
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
