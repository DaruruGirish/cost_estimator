# Database Migration Scripts

## Fix Users Table Migration

If you're upgrading from the old schema to the new schema and getting errors about `password_hash` containing null values, run the migration script:

```bash
# Connect to your PostgreSQL database
psql -U postgres -d rtlgds -f migrations/fix-users-table.sql

# Or using the connection string
psql postgresql://username:password@localhost:5432/rtlgds -f migrations/fix-users-table.sql
```

## What This Migration Does

1. **Users Table:**
   - Copies `password` → `password_hash`
   - Adds `is_active` column (defaults to true)
   - Removes `updated_at` column

2. **Projects Table:**
   - Renames `created_by` → `user_id`
   - Renames `fullChipEnabled` → `is_full_chip`
   - Removes `customerName`, `customerEmail`, `totalResources`, `updated_at`
   - Adds `number_of_blocks` column

3. **Project Blocks Table:**
   - Renames `gateCount` → `gate_count_million`
   - Renames `rtlDropCount` → `rtl_drops`
   - Removes `complexityFactors`, `blockEffort`
   - Adds `low_power_type` column

## Alternative: Fresh Start (Development Only)

If you don't mind losing existing data, you can simply drop and recreate the database:

```sql
DROP DATABASE IF EXISTS rtlgds;
CREATE DATABASE rtlgds;
```

Then let TypeORM create all tables fresh using `synchronize: true`.

