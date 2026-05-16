-- ============================================================================
-- RTL-to-GDS Cost Estimator - Database Schema
-- ============================================================================
-- Complete database schema matching the specification
-- Database: PostgreSQL
-- ============================================================================

-- ============================================================================
-- 1. users
-- ============================================================================
-- Login + registration (both Admin & Customer)
-- Used for auth, can be extended later, clean & minimal
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) CHECK (role IN ('admin', 'customer')) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- ============================================================================
-- 2. admin_project_timelineskk
-- ============================================================================
-- RTL drops → duration mapping (from Excel)
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_project_timelines (
    id SERIAL PRIMARY KEY,
    scope VARCHAR(20) CHECK (scope IN ('block', 'full_chip')),
    rtl_drops INTEGER NOT NULL,
    duration_months INTEGER NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_project_timelines_scope ON admin_project_timelines(scope);
CREATE INDEX IF NOT EXISTS idx_admin_project_timelines_rtl_drops ON admin_project_timelines(rtl_drops);

-- ============================================================================
-- 3. admin_pricing_factors
-- ============================================================================
-- MASTER TABLE – matches Excel exactly
-- THIS is where admin sets values from Excel
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_pricing_factors (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    -- Block Complexity, Full Chip, DFT, Gate Count, Technology Node
    factor_key VARCHAR(50) UNIQUE NOT NULL,
    -- constraints_development, low_power_nested, dft_block_level
    label VARCHAR(100) NOT NULL,
    description TEXT,
    scope VARCHAR(20) CHECK (scope IN ('block', 'full_chip', 'dft')),
    factor_type VARCHAR(30) CHECK (factor_type IN ('fixed_resource', 'percentage', 'level', 'auto')),
    base_value NUMERIC,
    -- % or fixed resource value
    meta JSONB,
    -- ranges, conditions, levels (blocks, pads, node <=7nm)
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_pricing_factors_category ON admin_pricing_factors(category);
CREATE INDEX IF NOT EXISTS idx_admin_pricing_factors_scope ON admin_pricing_factors(scope);
CREATE INDEX IF NOT EXISTS idx_admin_pricing_factors_factor_type ON admin_pricing_factors(factor_type);
CREATE INDEX IF NOT EXISTS idx_admin_pricing_factors_is_enabled ON admin_pricing_factors(is_enabled);
CREATE INDEX IF NOT EXISTS idx_admin_pricing_factors_factor_key ON admin_pricing_factors(factor_key);

-- ============================================================================
-- 4. admin_cost_settings
-- ============================================================================
-- Cost per resource per month
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_cost_settings (
    id SERIAL PRIMARY KEY,
    cost_per_resource_per_month NUMERIC NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- 5. projects
-- ============================================================================
-- One row = one customer estimation
-- ============================================================================

CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    project_name VARCHAR(150),
    customer_name VARCHAR(150),
    customer_email VARCHAR(150),
    technology_node VARCHAR(50),
    is_full_chip BOOLEAN,
    number_of_blocks INTEGER,
    estimated_cost NUMERIC,
    estimated_duration_months INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);
CREATE INDEX IF NOT EXISTS idx_projects_is_full_chip ON projects(is_full_chip);

-- ============================================================================
-- 6. project_blocks
-- ============================================================================
-- Each block inside a project
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_blocks (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    block_name VARCHAR(100),
    gate_count_million NUMERIC,
    rtl_drops INTEGER,
    low_power_type VARCHAR(20) CHECK (low_power_type IN ('none', 'non_nested', 'nested')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_project_blocks_project_id ON project_blocks(project_id);

-- ============================================================================
-- 7. project_selected_factors
-- ============================================================================
-- MOST IMPORTANT TABLE
-- Stores what customer selected + admin snapshot
-- Admin changes later → old projects safe
-- Exact audit trail
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_selected_factors (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    block_id INTEGER REFERENCES project_blocks(id) ON DELETE CASCADE,
    factor_key VARCHAR(50),
    applied_value NUMERIC,
    factor_snapshot JSONB,
    -- admin % / resources AT THAT TIME
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_project_selected_factors_project_id ON project_selected_factors(project_id);
CREATE INDEX IF NOT EXISTS idx_project_selected_factors_block_id ON project_selected_factors(block_id);
CREATE INDEX IF NOT EXISTS idx_project_selected_factors_factor_key ON project_selected_factors(factor_key);

-- ============================================================================
-- 8. project_dft_cad_flow
-- ============================================================================
-- CAD/Flow resources applied once per project
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_dft_cad_flow (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    resources NUMERIC,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_project_dft_cad_flow_project_id ON project_dft_cad_flow(project_id);

-- ============================================================================
-- 9. project_cost_breakdown (OPTIONAL but recommended)
-- ============================================================================
-- For UI explanation
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_cost_breakdown (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    component VARCHAR(100),
    resources NUMERIC,
    cost NUMERIC,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_project_cost_breakdown_project_id ON project_cost_breakdown(project_id);

-- ============================================================================
-- 10. leads (Customer Details)
-- ============================================================================
-- Stores customer contact information for landing page submissions
-- Used for email domain validation and auto-fill functionality
-- ============================================================================

CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(20),
    company VARCHAR(150),
    otp_code VARCHAR(6),
    otp_expires_at TIMESTAMP,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);

-- ============================================================================
-- COMMENTS ON TABLES
-- ============================================================================

COMMENT ON TABLE users IS 'Login + registration (Admin Only). Used for auth, can be extended later, clean & minimal.';
COMMENT ON TABLE admin_project_timelines IS 'RTL drops → duration mapping (from Excel)';
COMMENT ON TABLE admin_pricing_factors IS 'MASTER TABLE – matches Excel exactly. THIS is where admin sets values from Excel';
COMMENT ON TABLE admin_cost_settings IS 'Cost per resource per month';
COMMENT ON TABLE projects IS 'One row = one customer estimation';
COMMENT ON TABLE project_blocks IS 'Each block inside a project';
COMMENT ON TABLE project_selected_factors IS 'MOST IMPORTANT TABLE. Stores what customer selected + admin snapshot. Admin changes later → old projects safe. Exact audit trail.';
COMMENT ON TABLE project_dft_cad_flow IS 'CAD/Flow resources applied once per project';
COMMENT ON TABLE project_cost_breakdown IS 'For UI explanation (OPTIONAL but recommended)';
COMMENT ON TABLE leads IS 'Customer contact information from landing page. Used for email validation and auto-fill functionality.';
COMMENT ON COLUMN leads.otp_code IS 'OTP code for email verification';
COMMENT ON COLUMN leads.otp_expires_at IS 'Timestamp when OTP expires';
COMMENT ON COLUMN leads.email_verified IS 'Whether the email has been verified via OTP';

-- ============================================================================
-- COMMENTS ON COLUMNS
-- ============================================================================

-- users table
COMMENT ON COLUMN users.id IS 'Primary key, auto-incrementing user ID';
COMMENT ON COLUMN users.name IS 'User full name';
COMMENT ON COLUMN users.email IS 'User email address (unique)';
COMMENT ON COLUMN users.password_hash IS 'Hashed password (should use bcrypt/argon2)';
COMMENT ON COLUMN users.role IS 'User role: admin or customer';
COMMENT ON COLUMN users.is_active IS 'Whether the user account is active';
COMMENT ON COLUMN users.created_at IS 'Timestamp when user was created';

-- admin_project_timelines table
COMMENT ON COLUMN admin_project_timelines.id IS 'Primary key, auto-incrementing ID';
COMMENT ON COLUMN admin_project_timelines.scope IS 'Scope: block or full_chip';
COMMENT ON COLUMN admin_project_timelines.rtl_drops IS 'Number of RTL drops';
COMMENT ON COLUMN admin_project_timelines.duration_months IS 'Duration in months for this RTL drop count';
COMMENT ON COLUMN admin_project_timelines.notes IS 'Optional notes';
COMMENT ON COLUMN admin_project_timelines.created_at IS 'Timestamp when entry was created';

-- admin_pricing_factors table
COMMENT ON COLUMN admin_pricing_factors.id IS 'Primary key, auto-incrementing ID';
COMMENT ON COLUMN admin_pricing_factors.category IS 'Category: Block Complexity, Full Chip, DFT, Gate Count, Technology Node';
COMMENT ON COLUMN admin_pricing_factors.factor_key IS 'Unique factor key (e.g., constraints_development, low_power_nested, dft_block_level)';
COMMENT ON COLUMN admin_pricing_factors.label IS 'Human-readable label for the factor';
COMMENT ON COLUMN admin_pricing_factors.description IS 'Optional description';
COMMENT ON COLUMN admin_pricing_factors.scope IS 'Scope: block, full_chip, or dft';
COMMENT ON COLUMN admin_pricing_factors.factor_type IS 'Type: fixed_resource, percentage, level, or auto';
COMMENT ON COLUMN admin_pricing_factors.base_value IS 'Base value (% or fixed resource value)';
COMMENT ON COLUMN admin_pricing_factors.meta IS 'JSONB: ranges, conditions, levels (blocks, pads, node <=7nm)';
COMMENT ON COLUMN admin_pricing_factors.is_enabled IS 'Whether this factor is currently enabled';
COMMENT ON COLUMN admin_pricing_factors.created_at IS 'Timestamp when entry was created';

-- admin_cost_settings table
COMMENT ON COLUMN admin_cost_settings.id IS 'Primary key, auto-incrementing ID';
COMMENT ON COLUMN admin_cost_settings.cost_per_resource_per_month IS 'Cost per resource per month';
COMMENT ON COLUMN admin_cost_settings.currency IS 'Currency code (default: INR)';
COMMENT ON COLUMN admin_cost_settings.created_at IS 'Timestamp when entry was created';

-- projects table
COMMENT ON COLUMN projects.id IS 'Primary key, auto-incrementing project ID';
COMMENT ON COLUMN projects.user_id IS 'Foreign key to users table - user who created this project';
COMMENT ON COLUMN projects.project_name IS 'Name of the project';
COMMENT ON COLUMN projects.technology_node IS 'Technology node (e.g., 7nm, 10nm)';
COMMENT ON COLUMN projects.is_full_chip IS 'Whether this is a full chip project';
COMMENT ON COLUMN projects.number_of_blocks IS 'Number of blocks in the project';
COMMENT ON COLUMN projects.estimated_cost IS 'Total estimated cost';
COMMENT ON COLUMN projects.estimated_duration_months IS 'Estimated duration in months';
COMMENT ON COLUMN projects.created_at IS 'Timestamp when project was created';

-- project_blocks table
COMMENT ON COLUMN project_blocks.id IS 'Primary key, auto-incrementing block ID';
COMMENT ON COLUMN project_blocks.project_id IS 'Foreign key to projects table';
COMMENT ON COLUMN project_blocks.block_name IS 'Name of the block';
COMMENT ON COLUMN project_blocks.gate_count_million IS 'Gate count in millions';
COMMENT ON COLUMN project_blocks.rtl_drops IS 'Number of RTL drops for this block';
COMMENT ON COLUMN project_blocks.low_power_type IS 'Low power type: none, non_nested, or nested';
COMMENT ON COLUMN project_blocks.created_at IS 'Timestamp when block was created';

-- project_selected_factors table
COMMENT ON COLUMN project_selected_factors.id IS 'Primary key, auto-incrementing ID';
COMMENT ON COLUMN project_selected_factors.project_id IS 'Foreign key to projects table';
COMMENT ON COLUMN project_selected_factors.block_id IS 'Foreign key to project_blocks table (NULL for project-level factors)';
COMMENT ON COLUMN project_selected_factors.factor_key IS 'Reference to admin_pricing_factors.factor_key';
COMMENT ON COLUMN project_selected_factors.applied_value IS 'The value that was applied for this factor';
COMMENT ON COLUMN project_selected_factors.factor_snapshot IS 'JSONB: Snapshot of admin % / resources AT THAT TIME (for audit trail)';
COMMENT ON COLUMN project_selected_factors.created_at IS 'Timestamp when factor was selected';

-- project_dft_cad_flow table
COMMENT ON COLUMN project_dft_cad_flow.id IS 'Primary key, auto-incrementing ID';
COMMENT ON COLUMN project_dft_cad_flow.project_id IS 'Foreign key to projects table';
COMMENT ON COLUMN project_dft_cad_flow.resources IS 'CAD/Flow resources for this project';
COMMENT ON COLUMN project_dft_cad_flow.created_at IS 'Timestamp when entry was created';

-- project_cost_breakdown table
COMMENT ON COLUMN project_cost_breakdown.id IS 'Primary key, auto-incrementing ID';
COMMENT ON COLUMN project_cost_breakdown.project_id IS 'Foreign key to projects table';
COMMENT ON COLUMN project_cost_breakdown.component IS 'Component name (e.g., Block 1, Full Chip, DFT)';
COMMENT ON COLUMN project_cost_breakdown.resources IS 'Resources for this component';
COMMENT ON COLUMN project_cost_breakdown.cost IS 'Cost for this component';
COMMENT ON COLUMN project_cost_breakdown.created_at IS 'Timestamp when entry was created';

-- ============================================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================================

-- Insert default admin user
-- Password should be hashed using bcrypt/argon2 in production
-- Example hash for 'admin123' using bcrypt (rounds=10): $2b$10$...
INSERT INTO users (name, email, password_hash, role, is_active) 
VALUES ('Admin User', 'admin@rtlgds.com', '$2b$10$YourHashedPasswordHere', 'admin', true)
ON CONFLICT (email) DO NOTHING;

-- Insert default customer user
-- Password should be hashed using bcrypt/argon2 in production
INSERT INTO users (name, email, password_hash, role, is_active) 
VALUES ('Customer User', 'customer@rtlgds.com', '$2b$10$YourHashedPasswordHere', 'customer', true)
ON CONFLICT (email) DO NOTHING;

-- Insert default cost settings
INSERT INTO admin_cost_settings (cost_per_resource_per_month, currency)
VALUES (400000, 'INR')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- USEFUL QUERIES
-- ============================================================================

-- View all users
-- SELECT * FROM users;

-- View all projects with user information
-- SELECT 
--     p.id,
--     p.project_name,
--     p.technology_node,
--     p.estimated_cost,
--     p.estimated_duration_months,
--     u.name as created_by,
--     u.email as creator_email,
--     p.created_at
-- FROM projects p
-- JOIN users u ON p.user_id = u.id
-- ORDER BY p.created_at DESC;

-- View project with all blocks
-- SELECT 
--     p.id as project_id,
--     p.project_name,
--     pb.id as block_id,
--     pb.block_name,
--     pb.gate_count_million,
--     pb.rtl_drops,
--     pb.low_power_type
-- FROM projects p
-- LEFT JOIN project_blocks pb ON p.id = pb.project_id
-- WHERE p.id = 1;

-- View project with selected factors
-- SELECT 
--     p.id as project_id,
--     p.project_name,
--     psf.factor_key,
--     psf.applied_value,
--     psf.factor_snapshot,
--     apf.label,
--     apf.category
-- FROM projects p
-- LEFT JOIN project_selected_factors psf ON p.id = psf.project_id
-- LEFT JOIN admin_pricing_factors apf ON psf.factor_key = apf.factor_key
-- WHERE p.id = 1;

-- View admin pricing factors by category
-- SELECT 
--     category,
--     factor_key,
--     label,
--     scope,
--     factor_type,
--     base_value,
--     is_enabled
-- FROM admin_pricing_factors
-- ORDER BY category, factor_key;

-- Count projects per user
-- SELECT 
--     u.name,
--     u.email,
--     COUNT(p.id) as project_count
-- FROM users u
-- LEFT JOIN projects p ON u.id = p.user_id
-- GROUP BY u.id, u.name, u.email
-- ORDER BY project_count DESC;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
