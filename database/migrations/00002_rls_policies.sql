-- ============================================================================
-- Afaz Tobacco Platform: Row Level Security (RLS) Policies
-- Migration: 00002_rls_policies.sql
-- ============================================================================

-- Function to get current user role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS VARCHAR AS $$
    SELECT r.name 
    FROM user_profiles u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Function to check territory scope access
CREATE OR REPLACE FUNCTION public.can_access_territory(target_territory_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_role VARCHAR;
BEGIN
    SELECT public.current_user_role() INTO user_role;
    
    -- SUPER_ADMIN has global enterprise scope
    IF user_role = 'SUPER_ADMIN' THEN
        RETURN TRUE;
    END IF;
    
    -- TSO and CSR check direct territory assignment
    IF user_role IN ('TSO', 'CSR') THEN
        RETURN EXISTS (
            SELECT 1 FROM user_scopes s
            WHERE s.user_id = auth.uid()
              AND s.territory_id = target_territory_id
        );
    END IF;
    
    -- RSO checks regional scope containing the territory
    IF user_role = 'RSO' THEN
        RETURN EXISTS (
            SELECT 1 FROM user_scopes s
            JOIN territories t ON t.region_id = s.region_id
            WHERE s.user_id = auth.uid()
              AND t.id = target_territory_id
        );
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Enable RLS on Operational Tables
ALTER TABLE daily_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE zarda_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE zarda_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE empty_packets ENABLE ROW LEVEL SECURITY;

-- Submissions Select Policy
DROP POLICY IF EXISTS "Users can view submissions within their scope" ON daily_submissions;
CREATE POLICY "Users can view submissions within their scope"
ON daily_submissions FOR SELECT
USING (public.can_access_territory(territory_id));

-- Submissions Insert Policy
DROP POLICY IF EXISTS "Authorized users can insert submissions" ON daily_submissions;
CREATE POLICY "Authorized users can insert submissions"
ON daily_submissions FOR INSERT
WITH CHECK (
    public.can_access_territory(territory_id)
    AND (public.current_user_role() IN ('CSR', 'TSO', 'SUPER_ADMIN'))
);

-- Submissions Update Policy
DROP POLICY IF EXISTS "Authorized users can update submissions" ON daily_submissions;
CREATE POLICY "Authorized users can update submissions"
ON daily_submissions FOR UPDATE
USING (
    public.can_access_territory(territory_id)
    AND (
        (public.current_user_role() = 'SUPER_ADMIN')
        OR (is_locked = FALSE AND (
            (public.current_user_role() = 'CSR' AND status = 'DRAFT')
            OR (public.current_user_role() = 'TSO' AND status IN ('SUBMITTED', 'DRAFT'))
            OR (public.current_user_role() = 'RSO' AND status = 'TSO_APPROVED')
        ))
    )
);

-- Audit Logs Policy: Read-only for Super Admin
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Only Super Admin can view audit logs" ON audit_logs;
CREATE POLICY "Only Super Admin can view audit logs"
ON audit_logs FOR SELECT
USING (public.current_user_role() = 'SUPER_ADMIN');
