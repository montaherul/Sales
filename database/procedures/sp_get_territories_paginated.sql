-- Stored Procedure: sp_get_territories_paginated
-- Hierarchical Paginated Territory Retrieval with Route & Outlet Counts

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
