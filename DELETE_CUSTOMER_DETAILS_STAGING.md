# Delete customer_details Table from Staging

## Overview
The `customer_details` table is unused and should be deleted from staging to keep the database clean.

## Steps to Delete from Staging

### Option 1: Using psql (Recommended)

1. **Connect to your staging database:**
   ```bash
   psql -h <staging-host> -U <username> -d <database-name>
   ```

2. **Check if table exists and has data:**
   ```sql
   -- Check if table exists
   SELECT CASE 
       WHEN EXISTS (
           SELECT FROM information_schema.tables 
           WHERE table_schema = 'public' 
           AND table_name = 'customer_details'
       ) THEN 'EXISTS'
       ELSE 'DOES NOT EXIST'
   END AS status;

   -- Check row count
   SELECT COUNT(*) FROM customer_details;
   ```

3. **Backup (optional - if you want to keep a copy):**
   ```sql
   CREATE TABLE customer_details_backup AS SELECT * FROM customer_details;
   ```

4. **Delete the table:**
   ```sql
   DROP TABLE IF EXISTS customer_details CASCADE;
   ```

5. **Verify deletion:**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name LIKE '%customer%';
   ```

### Option 2: Using the Migration Script

1. **Copy the migration script to your staging server:**
   ```bash
   scp backend/migrations/delete-customer-details-staging.sql user@staging:/path/to/
   ```

2. **Run the script:**
   ```bash
   psql -h <staging-host> -U <username> -d <database-name> -f delete-customer-details-staging.sql
   ```

### Option 3: Using Database Admin Tool

If you use a database admin tool (pgAdmin, DBeaver, etc.):
1. Connect to staging database
2. Navigate to the `customer_details` table
3. Right-click → Drop/Delete
4. Confirm deletion

## Important Notes

- ✅ **Safe to delete**: Table is not referenced anywhere in the codebase
- ✅ **No data loss**: Table is empty (0 rows)
- ✅ **No dependencies**: No foreign keys or other tables depend on it
- ⚠️ **Backup first**: If you're unsure, create a backup before deleting

## Verification

After deletion, verify:
```sql
-- Should return 0 rows
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'customer_details';
```

## Rollback (if needed)

If you created a backup, you can restore:
```sql
CREATE TABLE customer_details AS SELECT * FROM customer_details_backup;
```
