-- ============================================================================
-- Afaz Tobacco Platform: User Authentication, Password Hashing & Onboarding
-- Migration: 00007_auth_passwords.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Add Auth & Onboarding Columns to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_onboarded BOOLEAN DEFAULT FALSE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- 2. Seed / Update Initial Users for Each Role with Hashed Password "123"
DO $$
DECLARE
    v_default_hash TEXT;
    v_role_admin UUID;
    v_role_rso UUID;
    v_role_tso UUID;
    v_role_csr UUID;
BEGIN
    -- Compute standard bcrypt hash for password "123"
    v_default_hash := crypt('123', gen_salt('bf', 10));

    SELECT id INTO v_role_admin FROM roles WHERE name = 'SUPER_ADMIN' LIMIT 1;
    SELECT id INTO v_role_rso FROM roles WHERE name = 'RSO' LIMIT 1;
    SELECT id INTO v_role_tso FROM roles WHERE name = 'TSO' LIMIT 1;
    SELECT id INTO v_role_csr FROM roles WHERE name = 'CSR' LIMIT 1;

    -- Update or ensure Super Admin user
    UPDATE user_profiles
    SET password_hash = v_default_hash,
        must_change_password = FALSE,
        is_onboarded = TRUE
    WHERE email = 'admin@afaztobacco.com';

    -- Update or ensure RSO user
    UPDATE user_profiles
    SET password_hash = v_default_hash,
        must_change_password = FALSE,
        is_onboarded = TRUE
    WHERE email = 'rso.satkania@afaztobacco.com';

    -- Update or ensure TSO user
    UPDATE user_profiles
    SET password_hash = v_default_hash,
        must_change_password = FALSE,
        is_onboarded = TRUE
    WHERE email = 'tso.keranihat@afaztobacco.com';

    -- Update or ensure CSR user
    UPDATE user_profiles
    SET password_hash = v_default_hash,
        must_change_password = FALSE,
        is_onboarded = TRUE
    WHERE email = 'csr.keranihat@afaztobacco.com';

    -- Ensure ATC Company scope for all initial users
    INSERT INTO user_scopes (user_id, company_id)
    SELECT u.id, c.id
    FROM user_profiles u, companies c
    WHERE c.code = 'ATC'
      AND NOT EXISTS (SELECT 1 FROM user_scopes WHERE user_id = u.id AND company_id = c.id);

    UPDATE user_scopes
    SET company_id = (SELECT id FROM companies WHERE code = 'ATC' LIMIT 1)
    WHERE company_id IS NULL;

END $$;

-- 3. Stored Procedure: sp_get_user_for_auth
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
