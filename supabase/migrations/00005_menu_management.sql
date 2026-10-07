-- ============================================================================
-- Afaz Tobacco Platform: Menu Management (RWMA & UWMA)
-- Migration: 00005_menu_management.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_menus (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'OPERATIONAL', 'ADMINISTRATIVE'
    icon VARCHAR(50),
    description TEXT,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_menu_access (
    role_name VARCHAR(50) NOT NULL,
    menu_id VARCHAR(50) REFERENCES system_menus(id) ON DELETE CASCADE,
    can_view BOOLEAN DEFAULT TRUE,
    can_edit BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (role_name, menu_id)
);

CREATE TABLE IF NOT EXISTS user_menu_access (
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    menu_id VARCHAR(50) REFERENCES system_menus(id) ON DELETE CASCADE,
    can_view BOOLEAN DEFAULT TRUE,
    can_edit BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (user_id, menu_id)
);

-- Seed System Menus
INSERT INTO system_menus (id, title, category, icon, description, sort_order) VALUES
-- Operational Menus
('dashboard', 'Executive Analytics', 'OPERATIONAL', 'LayoutDashboard', 'Real-time sales pacing and closing stock KPIs', 1),
('entry', 'Daily Sales & Stock Entry', 'OPERATIONAL', 'FileEdit', 'Route and field daily sales and closing stock input', 2),
('approvals', 'Review & Approval Queue', 'OPERATIONAL', 'ShieldCheck', 'Multi-tier CSR -> TSO -> RSO -> Admin approval hub', 3),
('export_xlsx', 'Authoritative 34-Sheet Export', 'OPERATIONAL', 'FileDown', 'Export exact 34-sheet monthly Excel reporting workbook', 4),
('import_xlsx', 'Date-Safe XLSX Import', 'OPERATIONAL', 'FileUp', 'Import operational workbooks with strict date validation', 5),
('drive_archival', 'Google Drive Cloud Archival', 'OPERATIONAL', 'CloudUpload', 'Cloud report archiving to Afaz_Tobacco_Reports folder', 6),

-- Administrative Menus (Super Admin Only)
('rwma', 'Role-Wise Menu Access (RWMA)', 'ADMINISTRATIVE', 'ShieldAlert', 'Configure menu access permissions per system role', 7),
('uwma', 'User-Wise Menu Access (UWMA)', 'ADMINISTRATIVE', 'UserCheck', 'Fine-grained menu permissions and territorial scope overrides', 8),
('user_management', 'User & Role Directory', 'ADMINISTRATIVE', 'Users', 'Manage corporate users, credentials, roles and assignments', 9),
('master_hierarchy', 'Master Hierarchy & Pricing', 'ADMINISTRATIVE', 'Building2', 'Territories, routes, brands and official product prices', 10),
('audit_trail', 'Audit & Governance Trail', 'ADMINISTRATIVE', 'History', 'Immutable audit log of all system changes and events', 11),
('system_settings', 'Platform Settings', 'ADMINISTRATIVE', 'Settings', 'Working days configuration, calculation parameters', 12)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  category = EXCLUDED.category,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- Seed Default Role-Wise Menu Access (RWMA)
-- 1. SUPER_ADMIN gets access to ALL menus (view + edit)
INSERT INTO role_menu_access (role_name, menu_id, can_view, can_edit)
SELECT 'SUPER_ADMIN', id, TRUE, TRUE FROM system_menus
ON CONFLICT (role_name, menu_id) DO UPDATE SET can_view = TRUE, can_edit = TRUE;

-- 2. RSO (Regional Sales Officer)
INSERT INTO role_menu_access (role_name, menu_id, can_view, can_edit) VALUES
('RSO', 'dashboard', TRUE, FALSE),
('RSO', 'approvals', TRUE, TRUE),
('RSO', 'export_xlsx', TRUE, FALSE)
ON CONFLICT (role_name, menu_id) DO UPDATE SET can_view = EXCLUDED.can_view, can_edit = EXCLUDED.can_edit;

-- 3. TSO (Territory Sales Officer)
INSERT INTO role_menu_access (role_name, menu_id, can_view, can_edit) VALUES
('TSO', 'dashboard', TRUE, FALSE),
('TSO', 'entry', TRUE, TRUE),
('TSO', 'approvals', TRUE, TRUE),
('TSO', 'export_xlsx', TRUE, FALSE)
ON CONFLICT (role_name, menu_id) DO UPDATE SET can_view = EXCLUDED.can_view, can_edit = EXCLUDED.can_edit;

-- 4. CSR (Customer Sales Representative)
INSERT INTO role_menu_access (role_name, menu_id, can_view, can_edit) VALUES
('CSR', 'entry', TRUE, TRUE),
('CSR', 'dashboard', TRUE, FALSE)
ON CONFLICT (role_name, menu_id) DO UPDATE SET can_view = EXCLUDED.can_view, can_edit = EXCLUDED.can_edit;
