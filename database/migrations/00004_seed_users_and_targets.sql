-- ============================================================================
-- Afaz Tobacco Platform: Seed Users, Scopes & Monthly Targets
-- Migration: 00004_seed_users_and_targets.sql
-- ============================================================================

DO $$
DECLARE
    role_admin_id UUID;
    role_rso_id UUID;
    role_tso_id UUID;
    role_csr_id UUID;

    user_admin_id UUID;
    user_rso_id UUID;
    user_tso_id UUID;
    user_csr_id UUID;

    reg_satkania_id UUID;
    t_kerani_id UUID;
    t_satkania_id UUID;
    t_bandarban_id UUID;
    t_rajasthali_id UUID;
    t_dohazari_id UUID;

    b_wilson_id UUID;
    b_shahara_id UUID;
    b_express_id UUID;
    b_nexus_id UUID;
    b_sb_id UUID;
    b_sm_id UUID;
BEGIN
    -- Fetch Roles
    SELECT id INTO role_admin_id FROM roles WHERE name = 'SUPER_ADMIN' LIMIT 1;
    SELECT id INTO role_rso_id FROM roles WHERE name = 'RSO' LIMIT 1;
    SELECT id INTO role_tso_id FROM roles WHERE name = 'TSO' LIMIT 1;
    SELECT id INTO role_csr_id FROM roles WHERE name = 'CSR' LIMIT 1;

    -- Fetch Region & Territories
    SELECT id INTO reg_satkania_id FROM regions WHERE name = 'Satkania' LIMIT 1;
    SELECT id INTO t_kerani_id FROM territories WHERE name = 'Kerani hat' LIMIT 1;
    SELECT id INTO t_satkania_id FROM territories WHERE name = 'Satkania' LIMIT 1;
    SELECT id INTO t_bandarban_id FROM territories WHERE name = 'Bandarban' LIMIT 1;
    SELECT id INTO t_rajasthali_id FROM territories WHERE name = 'Rajasthali' LIMIT 1;
    SELECT id INTO t_dohazari_id FROM territories WHERE name = 'Dohazari' LIMIT 1;

    -- Fetch Brands
    SELECT id INTO b_wilson_id FROM brands WHERE name = 'Wilson' LIMIT 1;
    SELECT id INTO b_shahara_id FROM brands WHERE name = 'Shahara' LIMIT 1;
    SELECT id INTO b_express_id FROM brands WHERE name = 'Express' LIMIT 1;
    SELECT id INTO b_nexus_id FROM brands WHERE name = 'Nexus' LIMIT 1;
    SELECT id INTO b_sb_id FROM brands WHERE name = 'SB' LIMIT 1;
    SELECT id INTO b_sm_id FROM brands WHERE name = 'SM' LIMIT 1;

    -- 1. Create Super Admin User
    INSERT INTO user_profiles (email, full_name, phone, role_id)
    VALUES ('admin@afaztobacco.com', 'System Administrator', '+8801700000001', role_admin_id)
    ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
    RETURNING id INTO user_admin_id;

    -- 2. Create RSO User
    INSERT INTO user_profiles (email, full_name, phone, role_id)
    VALUES ('rso.satkania@afaztobacco.com', 'Satkania Regional Officer', '+8801700000002', role_rso_id)
    ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
    RETURNING id INTO user_rso_id;

    -- Assign RSO Scope
    IF NOT EXISTS (SELECT 1 FROM user_scopes WHERE user_id = user_rso_id AND region_id = reg_satkania_id) THEN
        INSERT INTO user_scopes (user_id, region_id) VALUES (user_rso_id, reg_satkania_id);
    END IF;

    -- 3. Create TSO User
    INSERT INTO user_profiles (email, full_name, phone, role_id)
    VALUES ('tso.keranihat@afaztobacco.com', 'Kerani Hat Territory Officer', '+8801700000003', role_tso_id)
    ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
    RETURNING id INTO user_tso_id;

    -- Assign TSO Scope
    IF NOT EXISTS (SELECT 1 FROM user_scopes WHERE user_id = user_tso_id AND territory_id = t_kerani_id) THEN
        INSERT INTO user_scopes (user_id, territory_id) VALUES (user_tso_id, t_kerani_id);
    END IF;

    -- 4. Create CSR User
    INSERT INTO user_profiles (email, full_name, phone, role_id)
    VALUES ('csr.keranihat@afaztobacco.com', 'Kerani Hat Sales Representative', '+8801700000004', role_csr_id)
    ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
    RETURNING id INTO user_csr_id;

    -- Assign CSR Scope
    IF NOT EXISTS (SELECT 1 FROM user_scopes WHERE user_id = user_csr_id AND territory_id = t_kerani_id) THEN
        INSERT INTO user_scopes (user_id, territory_id) VALUES (user_csr_id, t_kerani_id);
    END IF;

    -- 5. Seed October 2026 Targets for Territories
    -- Kerani hat
    INSERT INTO targets (territory_id, brand_id, year, month, target_quantity, route_count, outlet_count) VALUES
    (t_kerani_id, b_wilson_id, 2026, 10, 25000, 12, 350),
    (t_kerani_id, b_shahara_id, 2026, 10, 18000, 12, 350),
    (t_kerani_id, b_express_id, 2026, 10, 12000, 12, 350),
    (t_kerani_id, b_nexus_id, 2026, 10, 15000, 12, 350),
    (t_kerani_id, b_sb_id, 2026, 10, 8000, 12, 350),
    (t_kerani_id, b_sm_id, 2026, 10, 6000, 12, 350)
    ON CONFLICT (territory_id, brand_id, year, month) DO UPDATE
    SET target_quantity = EXCLUDED.target_quantity;

    -- Satkania
    INSERT INTO targets (territory_id, brand_id, year, month, target_quantity, route_count, outlet_count) VALUES
    (t_satkania_id, b_wilson_id, 2026, 10, 28000, 14, 400),
    (t_satkania_id, b_shahara_id, 2026, 10, 20000, 14, 400),
    (t_satkania_id, b_express_id, 2026, 10, 14000, 14, 400),
    (t_satkania_id, b_nexus_id, 2026, 10, 16000, 14, 400),
    (t_satkania_id, b_sb_id, 2026, 10, 9000, 14, 400),
    (t_satkania_id, b_sm_id, 2026, 10, 7000, 14, 400)
    ON CONFLICT (territory_id, brand_id, year, month) DO UPDATE
    SET target_quantity = EXCLUDED.target_quantity;

    -- Bandarban
    INSERT INTO targets (territory_id, brand_id, year, month, target_quantity, route_count, outlet_count) VALUES
    (t_bandarban_id, b_wilson_id, 2026, 10, 20000, 10, 280),
    (t_bandarban_id, b_shahara_id, 2026, 10, 15000, 10, 280),
    (t_bandarban_id, b_express_id, 2026, 10, 10000, 10, 280),
    (t_bandarban_id, b_nexus_id, 2026, 10, 12000, 10, 280),
    (t_bandarban_id, b_sb_id, 2026, 10, 7000, 10, 280),
    (t_bandarban_id, b_sm_id, 2026, 10, 5000, 10, 280)
    ON CONFLICT (territory_id, brand_id, year, month) DO UPDATE
    SET target_quantity = EXCLUDED.target_quantity;

    -- Rajasthali
    INSERT INTO targets (territory_id, brand_id, year, month, target_quantity, route_count, outlet_count) VALUES
    (t_rajasthali_id, b_wilson_id, 2026, 10, 15000, 8, 220),
    (t_rajasthali_id, b_shahara_id, 2026, 10, 11000, 8, 220),
    (t_rajasthali_id, b_express_id, 2026, 10, 8000, 8, 220),
    (t_rajasthali_id, b_nexus_id, 2026, 10, 9000, 8, 220),
    (t_rajasthali_id, b_sb_id, 2026, 10, 5000, 8, 220),
    (t_rajasthali_id, b_sm_id, 2026, 10, 4000, 8, 220)
    ON CONFLICT (territory_id, brand_id, year, month) DO UPDATE
    SET target_quantity = EXCLUDED.target_quantity;

    -- Dohazari
    INSERT INTO targets (territory_id, brand_id, year, month, target_quantity, route_count, outlet_count) VALUES
    (t_dohazari_id, b_wilson_id, 2026, 10, 22000, 11, 310),
    (t_dohazari_id, b_shahara_id, 2026, 10, 16000, 11, 310),
    (t_dohazari_id, b_express_id, 2026, 10, 11000, 11, 310),
    (t_dohazari_id, b_nexus_id, 2026, 10, 13000, 11, 310),
    (t_dohazari_id, b_sb_id, 2026, 10, 7500, 11, 310),
    (t_dohazari_id, b_sm_id, 2026, 10, 5500, 11, 310)
    ON CONFLICT (territory_id, brand_id, year, month) DO UPDATE
    SET target_quantity = EXCLUDED.target_quantity;

END $$;
