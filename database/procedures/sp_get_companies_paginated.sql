-- Stored Procedure: sp_get_companies_paginated
-- Enterprise Tenant Paginated Listing with Statistics

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
            c.status,
            c.plan,
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
