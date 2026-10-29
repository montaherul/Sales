-- Migration 00013: Dynamic Territory CSR & Route Sales Intelligence System
-- Supports TSO (Territory Sales Officer) route-level target setting, daily sales recording,
-- ATDA (Achievement To Date Average), ADS (Average Daily Sales), projections, and 34-sheet Excel reporting.

-- 1. Enhance routes table with CSR assignments and operational metadata
ALTER TABLE routes 
  ADD COLUMN IF NOT EXISTS csr_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS csr_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS outlet_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 2. Create route_targets table (Monthly targets per route/CSR)
CREATE TABLE IF NOT EXISTS route_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  territory_id UUID NOT NULL REFERENCES territories(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  target_cigarette NUMERIC(15, 4) DEFAULT 0,
  target_bidi NUMERIC(15, 4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_route_target_period UNIQUE(route_id, year, month)
);

-- 3. Create territory_target_benchmarks table (Territory-level baselines: LMS, LM ADS, Working Days)
CREATE TABLE IF NOT EXISTS territory_target_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  territory_id UUID NOT NULL REFERENCES territories(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  lms NUMERIC(15, 4) DEFAULT 0,          -- Last Month Sales
  lm_ads NUMERIC(15, 4) DEFAULT 0,       -- Last Month ADS
  working_days INTEGER DEFAULT 26,       -- Standard 26 working days (excl. Fridays)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_territory_benchmark_period UNIQUE(territory_id, year, month)
);

-- 4. Create route_daily_sales table (Daily sales recorded per route for sheets 1-31)
CREATE TABLE IF NOT EXISTS route_daily_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  territory_id UUID NOT NULL REFERENCES territories(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  csr_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  report_date DATE NOT NULL,
  sales_cigarette NUMERIC(15, 4) DEFAULT 0,
  sales_bidi NUMERIC(15, 4) DEFAULT 0,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_route_daily_sales_date UNIQUE(route_id, report_date)
);

-- 5. Indexes for high-speed reporting and aggregation
CREATE INDEX IF NOT EXISTS idx_routes_territory ON routes(territory_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_route_targets_lookup ON route_targets(territory_id, year, month);
CREATE INDEX IF NOT EXISTS idx_route_daily_sales_lookup ON route_daily_sales(territory_id, report_date);
CREATE INDEX IF NOT EXISTS idx_route_daily_sales_period ON route_daily_sales(route_id, report_date);

-- 6. Enable RLS
ALTER TABLE route_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE territory_target_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_daily_sales ENABLE ROW LEVEL SECURITY;

-- Permissive public policies for authenticated operations (scoped through application layer & company_id)
DROP POLICY IF EXISTS route_targets_all_policy ON route_targets;
CREATE POLICY route_targets_all_policy ON route_targets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS territory_target_benchmarks_all_policy ON territory_target_benchmarks;
CREATE POLICY territory_target_benchmarks_all_policy ON territory_target_benchmarks FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS route_daily_sales_all_policy ON route_daily_sales;
CREATE POLICY route_daily_sales_all_policy ON route_daily_sales FOR ALL USING (true) WITH CHECK (true);
