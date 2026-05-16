# PowerShell script to check customer_details table in Docker database

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Checking Docker Database Tables" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Check if Docker container is running
$containerRunning = docker ps --filter "name=rtlgds-db" --format "{{.Names}}"
if (-not $containerRunning) {
    Write-Host "❌ Docker container 'rtlgds-db' is not running" -ForegroundColor Red
    Write-Host "Start it with: docker-compose up -d postgres" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "1. Checking if customer_details table exists..." -ForegroundColor Yellow
docker exec rtlgds-db psql -U postgres -d rtlgds -c @"
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'customer_details'
        ) THEN '✅ customer_details table EXISTS'
        ELSE '❌ customer_details table DOES NOT EXIST'
    END AS status;
"@

Write-Host ""
Write-Host "2. Listing all tables with 'customer' in the name..." -ForegroundColor Yellow
docker exec rtlgds-db psql -U postgres -d rtlgds -c @"
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE '%customer%'
ORDER BY table_name;
"@

Write-Host ""
Write-Host "3. If customer_details exists, showing its structure..." -ForegroundColor Yellow
docker exec rtlgds-db psql -U postgres -d rtlgds -c @"
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'customer_details'
ORDER BY ordinal_position;
"@ 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Table does not exist or error occurred" -ForegroundColor Red
}

Write-Host ""
Write-Host "4. Counting rows in customer_details (if exists)..." -ForegroundColor Yellow
docker exec rtlgds-db psql -U postgres -d rtlgds -c "SELECT COUNT(*) as row_count FROM customer_details;" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Table does not exist" -ForegroundColor Red
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "To drop the table (if you want to):" -ForegroundColor Yellow
Write-Host "docker exec rtlgds-db psql -U postgres -d rtlgds -c 'DROP TABLE IF EXISTS customer_details CASCADE;'" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
