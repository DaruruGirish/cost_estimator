-- Script to check tables in Docker database
-- Run this inside the Docker PostgreSQL container to see all tables

-- Connect to the database and run these queries:

-- 1. List all tables in the database
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. Check if customer_details table exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'customer_details'
        ) THEN 'EXISTS'
        ELSE 'DOES NOT EXIST'
    END AS customer_details_status;

-- 3. If customer_details exists, show its structure
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'customer_details'
ORDER BY ordinal_position;

-- 4. Count rows in customer_details (if it exists)
SELECT 
    COUNT(*) as row_count
FROM customer_details;

-- 5. Show all tables that match 'customer' pattern
SELECT 
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE '%customer%'
ORDER BY table_name;
