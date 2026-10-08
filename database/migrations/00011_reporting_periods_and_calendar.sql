-- Migration 00011: Reporting Periods & Calendar Management (Year -> Month -> Date)
-- Provides full CRUD and auto-generation for Yearly, Monthly, and Daily operational controls.

-- 1. Create reporting_years table
CREATE TABLE IF NOT EXISTS reporting_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    year INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'CLOSED', 'UPCOMING'
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, year)
);

-- 2. Enhance working_days table (Monthly Periods)
ALTER TABLE working_days ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'OPEN'; -- 'OPEN', 'CLOSED', 'LOCKED', 'FINALIZED'
ALTER TABLE working_days ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE working_days ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE working_days ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Create reporting_dates table (Daily Periods)
CREATE TABLE IF NOT EXISTS reporting_dates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    reporting_date DATE NOT NULL,
    year INT NOT NULL,
    month INT NOT NULL,
    day INT NOT NULL,
    is_working_day BOOLEAN NOT NULL DEFAULT TRUE,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'CLOSED', 'HOLIDAY'
    holiday_name VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, reporting_date)
);

CREATE INDEX IF NOT EXISTS idx_reporting_years_company ON reporting_years(company_id, year);
CREATE INDEX IF NOT EXISTS idx_working_days_lookup ON working_days(company_id, year, month);
CREATE INDEX IF NOT EXISTS idx_reporting_dates_lookup ON reporting_dates(company_id, reporting_date);

-- 4. Stored Procedure: Auto create or provision Year, Months, and Dates
CREATE OR REPLACE FUNCTION sp_auto_create_reporting_period(
    p_company_id UUID,
    p_year INT,
    p_default_working_days INT DEFAULT 26
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_target_company UUID;
    v_month INT;
    v_date DATE;
    v_start_date DATE;
    v_end_date DATE;
    v_dow INT;
    v_months_created INT := 0;
    v_dates_created INT := 0;
BEGIN
    v_target_company := p_company_id;
    IF v_target_company IS NULL THEN
        SELECT id INTO v_target_company FROM companies ORDER BY created_at ASC LIMIT 1;
    END IF;

    -- 1. Ensure Year exists
    INSERT INTO reporting_years (company_id, year, status)
    VALUES (v_target_company, p_year, 'ACTIVE')
    ON CONFLICT (company_id, year) DO UPDATE SET updated_at = NOW();

    -- 2. Ensure all 12 Months exist
    FOR v_month IN 1..12 LOOP
        INSERT INTO working_days (company_id, year, month, working_days, status)
        VALUES (v_target_company, p_year, v_month, p_default_working_days, 'OPEN')
        ON CONFLICT (company_id, year, month) DO UPDATE 
        SET working_days = EXCLUDED.working_days, updated_at = NOW();
        v_months_created := v_months_created + 1;
    END LOOP;

    -- 3. Ensure all Dates of the Year exist
    v_start_date := MAKE_DATE(p_year, 1, 1);
    v_end_date := MAKE_DATE(p_year, 12, 31);
    v_date := v_start_date;

    WHILE v_date <= v_end_date LOOP
        v_dow := EXTRACT(DOW FROM v_date); -- 0=Sun, 5=Fri
        INSERT INTO reporting_dates (
            company_id, reporting_date, year, month, day, is_working_day, status
        )
        VALUES (
            v_target_company,
            v_date,
            EXTRACT(YEAR FROM v_date)::INT,
            EXTRACT(MONTH FROM v_date)::INT,
            EXTRACT(DAY FROM v_date)::INT,
            CASE WHEN v_dow = 5 THEN FALSE ELSE TRUE END,
            CASE WHEN v_dow = 5 THEN 'CLOSED' ELSE 'OPEN' END
        )
        ON CONFLICT (company_id, reporting_date) DO NOTHING;

        v_dates_created := v_dates_created + 1;
        v_date := v_date + INTERVAL '1 day';
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'companyId', v_target_company,
        'year', p_year,
        'monthsConfigured', v_months_created,
        'datesConfigured', v_dates_created
    );
END;
$$;

-- 5. Stored Procedure for Paginated Period Querying
CREATE OR REPLACE FUNCTION sp_get_reporting_periods_paginated(
    p_company_id UUID DEFAULT NULL,
    p_year INT DEFAULT NULL
)
RETURNS TABLE (
    year INT,
    company_id UUID,
    company_name VARCHAR,
    year_status VARCHAR,
    total_months INT,
    open_months INT,
    total_working_days INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ry.year,
        ry.company_id,
        c.name as company_name,
        ry.status as year_status,
        COUNT(wd.id)::INT as total_months,
        COUNT(CASE WHEN wd.status = 'OPEN' THEN 1 END)::INT as open_months,
        COALESCE(SUM(wd.working_days), 0)::INT as total_working_days
    FROM reporting_years ry
    JOIN companies c ON ry.company_id = c.id
    LEFT JOIN working_days wd ON wd.company_id = ry.company_id AND wd.year = ry.year
    WHERE (p_company_id IS NULL OR ry.company_id = p_company_id)
      AND (p_year IS NULL OR ry.year = p_year)
    GROUP BY ry.year, ry.company_id, c.name, ry.status
    ORDER BY ry.year DESC;
END;
$$;

-- Pre-seed year 2026 for existing companies
DO $$
DECLARE
    r_comp RECORD;
BEGIN
    FOR r_comp IN SELECT id FROM companies LOOP
        PERFORM sp_auto_create_reporting_period(r_comp.id, 2026, 26);
    END LOOP;
END;
$$;
