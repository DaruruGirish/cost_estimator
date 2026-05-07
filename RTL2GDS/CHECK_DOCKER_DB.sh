#!/bin/bash
# Script to check customer_details table in Docker database

echo "=========================================="
echo "Checking Docker Database Tables"
echo "=========================================="

# Check if Docker container is running
if ! docker ps | grep -q rtlgds-db; then
    echo "❌ Docker container 'rtlgds-db' is not running"
    echo "Start it with: docker-compose up -d postgres"
    exit 1
fi

echo ""
echo "1. Checking if customer_details table exists..."
docker exec rtlgds-db psql -U postgres -d rtlgds -c "
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'customer_details'
        ) THEN '✅ customer_details table EXISTS'
        ELSE '❌ customer_details table DOES NOT EXIST'
    END AS status;
"

echo ""
echo "2. Listing all tables with 'customer' in the name..."
docker exec rtlgds-db psql -U postgres -d rtlgds -c "
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE '%customer%'
ORDER BY table_name;
"

echo ""
echo "3. If customer_details exists, showing its structure..."
docker exec rtlgds-db psql -U postgres -d rtlgds -c "
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'customer_details'
ORDER BY ordinal_position;
" 2>/dev/null || echo "Table does not exist or error occurred"

echo ""
echo "4. Counting rows in customer_details (if exists)..."
docker exec rtlgds-db psql -U postgres -d rtlgds -c "
SELECT COUNT(*) as row_count FROM customer_details;
" 2>/dev/null || echo "Table does not exist"

echo ""
echo "=========================================="
echo "To drop the table (if you want to):"
echo "docker exec rtlgds-db psql -U postgres -d rtlgds -c 'DROP TABLE IF EXISTS customer_details CASCADE;'"
echo "=========================================="
