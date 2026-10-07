-- ============================================================================
-- Afaz Tobacco Platform: Initial Seed Data
-- Migration: 00003_seed_data.sql
-- ============================================================================

-- Seed Roles
INSERT INTO roles (name, description) VALUES
('SUPER_ADMIN', 'Global system administrator with full access'),
('RSO', 'Regional Sales Officer with regional scope'),
('TSO', 'Territory Sales Officer with territory supervision scope'),
('CSR', 'Customer Sales Representative with field route data entry scope')
ON CONFLICT (name) DO NOTHING;

-- Seed Master Company & Hierarchy
INSERT INTO companies (name, code) VALUES
('Afaz Tobacco Company', 'ATC')
ON CONFLICT DO NOTHING;

DO $$
DECLARE
    company_uuid UUID;
    division_uuid UUID;
    wing_uuid UUID;
    region_uuid UUID;
BEGIN
    SELECT id INTO company_uuid FROM companies WHERE code = 'ATC' LIMIT 1;

    INSERT INTO divisions (company_id, name)
    VALUES (company_uuid, 'Ctg South')
    RETURNING id INTO division_uuid;

    INSERT INTO wings (division_id, name)
    VALUES (division_uuid, 'Chittagong')
    RETURNING id INTO wing_uuid;

    INSERT INTO regions (wing_id, name)
    VALUES (wing_uuid, 'Satkania')
    RETURNING id INTO region_uuid;

    -- Seed Satkania Region Territories
    INSERT INTO territories (region_id, name, sort_order) VALUES
    (region_uuid, 'Kerani hat', 1),
    (region_uuid, 'Satkania', 2),
    (region_uuid, 'Bandarban', 3),
    (region_uuid, 'Rajasthali', 4),
    (region_uuid, 'Dohazari', 5)
    ON CONFLICT (region_id, name) DO NOTHING;
END $$;

-- Seed Brands
INSERT INTO brands (name, type, sort_order) VALUES
('Wilson', 'CIGARETTE', 1),
('Shahara', 'CIGARETTE', 2),
('Express', 'CIGARETTE', 3),
('Nexus', 'CIGARETTE', 4),
('SB', 'CIGARETTE', 5),
('SM', 'CIGARETTE', 6),
('SLB', 'ZARDA', 7),
('22/25', 'ZARDA', 8),
('99/14', 'ZARDA', 9),
('33/15', 'ZARDA', 10)
ON CONFLICT DO NOTHING;

-- Seed Zarda Prices
DO $$
DECLARE
    b_22_25 UUID;
    b_99_14 UUID;
    b_33_15 UUID;
BEGIN
    SELECT id INTO b_22_25 FROM brands WHERE name = '22/25' LIMIT 1;
    SELECT id INTO b_99_14 FROM brands WHERE name = '99/14' LIMIT 1;
    SELECT id INTO b_33_15 FROM brands WHERE name = '33/15' LIMIT 1;

    IF b_22_25 IS NOT NULL THEN
        INSERT INTO prices (brand_id, unit_price, effective_from)
        VALUES (b_22_25, 15.0000, '2026-01-01');
    END IF;

    IF b_99_14 IS NOT NULL THEN
        INSERT INTO prices (brand_id, unit_price, effective_from)
        VALUES (b_99_14, 6.0000, '2026-01-01');
    END IF;

    IF b_33_15 IS NOT NULL THEN
        INSERT INTO prices (brand_id, unit_price, effective_from)
        VALUES (b_33_15, 8.0000, '2026-01-01');
    END IF;
END $$;

-- Seed Working Days (Default 26 days for 2026)
INSERT INTO working_days (year, month, working_days) VALUES
(2026, 1, 26),
(2026, 2, 26),
(2026, 3, 26),
(2026, 4, 26),
(2026, 5, 26),
(2026, 6, 26),
(2026, 7, 26),
(2026, 8, 26),
(2026, 9, 26),
(2026, 10, 26),
(2026, 11, 26),
(2026, 12, 26)
ON CONFLICT (year, month) DO NOTHING;
