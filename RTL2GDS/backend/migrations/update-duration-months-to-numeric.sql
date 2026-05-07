-- Migration: Update estimated_duration_months from INTEGER to NUMERIC
-- This allows storing decimal values for man-months (e.g., 51.3)
-- Run this migration to support the new man-months calculation

DO $$
BEGIN
    -- Check if column exists and is currently INTEGER type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'projects'
        AND column_name = 'estimated_duration_months'
        AND data_type = 'integer'
    ) THEN
        -- Convert INTEGER to NUMERIC(10,1) to support decimal values
        ALTER TABLE projects 
        ALTER COLUMN estimated_duration_months TYPE NUMERIC(10,1) 
        USING estimated_duration_months::NUMERIC(10,1);
        
        RAISE NOTICE 'Successfully updated estimated_duration_months from INTEGER to NUMERIC(10,1)';
    ELSE
        -- Check if column already exists as NUMERIC
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'projects'
            AND column_name = 'estimated_duration_months'
            AND data_type = 'numeric'
        ) THEN
            RAISE NOTICE 'Column estimated_duration_months already exists as NUMERIC. No changes needed.';
        ELSE
            RAISE NOTICE 'Column estimated_duration_months does not exist. This migration may not be needed.';
        END IF;
    END IF;
END $$;
