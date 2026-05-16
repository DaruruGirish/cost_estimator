-- Migration: Add customer_name and customer_email columns to projects table
-- Run this script to update your existing database

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(150),
ADD COLUMN IF NOT EXISTS customer_email VARCHAR(150);

-- Verify the columns were added
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'projects'
AND column_name IN ('customer_name', 'customer_email');

