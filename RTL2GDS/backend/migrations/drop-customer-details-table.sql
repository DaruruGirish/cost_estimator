-- Migration: Drop unused customer_details table
-- This table is not referenced anywhere in the codebase
-- Customer information is stored in:
--   - users table (for authentication)
--   - projects table (customer_name, customer_email columns)
--   - leads table (for landing page submissions)

-- Step 1: Check if the table exists and has any data
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'customer_details'
    ) THEN
        -- Check if table has any data
        IF EXISTS (SELECT 1 FROM customer_details LIMIT 1) THEN
            RAISE NOTICE 'WARNING: customer_details table contains data. Please review before dropping.';
            RAISE NOTICE 'You can backup the data first with: CREATE TABLE customer_details_backup AS SELECT * FROM customer_details;';
        ELSE
            RAISE NOTICE 'customer_details table exists but is empty. Safe to drop.';
        END IF;
    ELSE
        RAISE NOTICE 'customer_details table does not exist. Nothing to drop.';
    END IF;
END $$;

-- Step 2: Backup data (optional - uncomment if you want to keep a backup)
-- CREATE TABLE customer_details_backup AS SELECT * FROM customer_details;

-- Step 3: Drop the table (uncomment to execute)
-- DROP TABLE IF EXISTS customer_details CASCADE;

-- ============================================================================
-- QUICK DROP (if you're sure you want to delete it):
-- ============================================================================
-- Run this command directly in psql or your database client:
-- DROP TABLE IF EXISTS customer_details CASCADE;
