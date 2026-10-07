-- ============================================================================
-- Afaz Tobacco Platform: Role Management Stored Procedures
-- Migration: 00008_roles_management.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION sp_get_roles_paginated(
    p_page INT DEFAULT 1,
    p_page_size INT DEFAULT 10,
    p_search TEXT DEFAULT NULL,
    p_sort_by TEXT DEFAULT 'name',
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
    FROM roles r
    WHERE (v_search IS NULL OR r.name ILIKE '%' || v_search || '%' OR r.description ILIKE '%' || v_search || '%');

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
            r.id,
            r.name,
            r.description,
            r.created_at,
            (SELECT COUNT(*) FROM user_profiles u WHERE u.role_id = r.id) AS user_count,
            (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id) AS permission_count,
            (r.name IN ('SUPER_ADMIN', 'RSO', 'TSO', 'CSR')) AS is_system_role
        FROM roles r
        WHERE (v_search IS NULL OR r.name ILIKE '%' || v_search || '%' OR r.description ILIKE '%' || v_search || '%')
        ORDER BY
            CASE WHEN p_sort_by = 'name' AND LOWER(p_sort_order) = 'asc' THEN r.name END ASC,
            CASE WHEN p_sort_by = 'name' AND LOWER(p_sort_order) = 'desc' THEN r.name END DESC,
            CASE WHEN p_sort_by = 'created_at' AND LOWER(p_sort_order) = 'asc' THEN r.created_at END ASC,
            CASE WHEN p_sort_by = 'created_at' AND LOWER(p_sort_order) = 'desc' THEN r.created_at END DESC,
            r.name ASC
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
