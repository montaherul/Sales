-- Stored Procedure: sp_get_users_paginated
-- Company-Scoped & Hierarchy Aware Paginated User Retrieval

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
            c.code AS company_code,
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
            CASE WHEN p_sort_by = 'company_name' AND LOWER(p_sort_order) = 'asc' THEN c.name END ASC,
            CASE WHEN p_sort_by = 'company_name' AND LOWER(p_sort_order) = 'desc' THEN c.name END DESC,
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
