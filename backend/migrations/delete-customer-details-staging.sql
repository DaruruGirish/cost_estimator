-- ============================================================================
-- Migration: Delete customer_details table from Staging Database
-- ============================================================================
-- This script safely checks and deletes the unused customer_details table
-- Run this on your staging database
-- ============================================================================

-- Step 1: Check if the table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'customer_details'
    ) THEN
        RAISE NOTICE '✓ customer_details table found';
        
        -- Check if it has any data
        IF EXISTS (SELECT 1 FROM customer_details LIMIT 1) THEN
            RAISE WARNING '⚠️  WARNING: customer_details table contains data!';
            RAISE NOTICE '   Review the data before deleting:';
            RAISE NOTICE '   SELECT * FROM customer_details;';
            RAISE NOTICE '';
            RAISE NOTICE '   To backup first, run:';
            RAISE NOTICE '   CREATE TABLE customer_details_backup AS SELECT * FROM customer_details;';
        ELSE
            RAISE NOTICE '✓ Table is empty - safe to delete';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ️  customer_details table does not exist - nothing to delete';
    END IF;
END $$;

-- Step 2: Backup (optional - uncomment if you want to backup first)
-- CREATE TABLE customer_details_backup AS SELECT * FROM customer_details;

-- Step 3: Drop the table
-- Uncomment the line below to execute the deletion
-- DROP TABLE IF EXISTS customer_details CASCADE;

-- ============================================================================
-- VERIFICATION: After running, verify the table is gone
-- ============================================================================
-- Run this to verify:
-- SELECT CASE 
--     WHEN EXISTS (
--         SELECT FROM information_schema.tables 
--         WHERE table_schema = 'public' 
--         AND table_name = 'customer_details'
--     ) THEN 'STILL EXISTS'
--     ELSE 'DELETED SUCCESSFULLY'
-- END AS status;
-- ============================================================================
