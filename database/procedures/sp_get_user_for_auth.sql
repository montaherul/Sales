-- Stored Procedure: sp_get_user_for_auth
-- Safely fetches user authentication context, role, and organizational scopes

CREATE OR REPLACE FUNCTION sp_get_user_for_auth(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user RECORD;
    v_result JSONB;
BEGIN
    SELECT 
        u.id,
        u.email,
        u.full_name,
        u.phone,
        u.password_hash,
        u.is_active,
        u.must_change_password,
        u.is_onboarded,
        u.created_at,
        r.id AS role_id,
        r.name AS role_name,
        us.company_id,
        c.name AS company_name,
        us.region_id,
        reg.name AS region_name,
        us.territory_id,
        t.name AS territory_name
    INTO v_user
    FROM user_profiles u
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN user_scopes us ON u.id = us.user_id
    LEFT JOIN companies c ON us.company_id = c.id
    LEFT JOIN regions reg ON us.region_id = reg.id
    LEFT JOIN territories t ON us.territory_id = t.id
    WHERE LOWER(u.email) = LOWER(TRIM(p_email))
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    v_result := jsonb_build_object(
        'id', v_user.id,
        'email', v_user.email,
        'fullName', v_user.full_name,
        'phone', v_user.phone,
        'passwordHash', v_user.password_hash,
        'isActive', v_user.is_active,
        'mustChangePassword', v_user.must_change_password,
        'isOnboarded', v_user.is_onboarded,
        'roleId', v_user.role_id,
        'role', v_user.role_name,
        'companyId', v_user.company_id,
        'companyName', v_user.company_name,
        'regionId', v_user.region_id,
        'regionName', v_user.region_name,
        'territoryId', v_user.territory_id,
        'territoryName', v_user.territory_name
    );

    RETURN v_result;
END;
$$;
