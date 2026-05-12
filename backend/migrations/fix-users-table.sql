-- Migration script to update users table structure
-- Run this BEFORE starting the application if you have existing data

-- Step 1: Copy password column to password_hash (if password_hash doesn't exist yet)
-- If password_hash column already exists, skip this step
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='users' AND column_name='password') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name='users' AND column_name='password_hash') THEN
        -- Add password_hash column as nullable first
        ALTER TABLE users ADD COLUMN password_hash TEXT;
        
        -- Copy existing password values to password_hash
        UPDATE users SET password_hash = password WHERE password IS NOT NULL;
        
        -- For any NULL passwords, set a temporary value (users will need to reset password)
        UPDATE users SET password_hash = '' WHERE password_hash IS NULL;
        
        -- Drop the old password column
        ALTER TABLE users DROP COLUMN password;
    END IF;
END $$;

-- Step 2: Add is_active column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='is_active') THEN
        ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true;
        UPDATE users SET is_active = true WHERE is_active IS NULL;
    END IF;
END $$;

-- Step 3: Rename created_by to user_id in projects table (if needed)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='projects' AND column_name='created_by') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name='projects' AND column_name='user_id') THEN
        ALTER TABLE projects RENAME COLUMN created_by TO user_id;
    END IF;
END $$;

-- Step 4: Make password_hash NOT NULL (after data migration)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='users' AND column_name='password_hash' 
               AND is_nullable='YES') THEN
        -- Update any remaining NULL values
        UPDATE users SET password_hash = '' WHERE password_hash IS NULL;
        
        -- Make column NOT NULL
        ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;
    END IF;
END $$;

-- Step 5: Remove updated_at column from users if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='users' AND column_name='updated_at') THEN
        ALTER TABLE users DROP COLUMN updated_at;
    END IF;
END $$;

-- Step 6: Update projects table structure
DO $$ 
BEGIN
    -- Rename fullChipEnabled to is_full_chip if needed
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='projects' AND column_name='fullChipEnabled') THEN
        ALTER TABLE projects RENAME COLUMN "fullChipEnabled" TO is_full_chip;
    END IF;
    
    -- Remove customerName and customerEmail if they exist
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='projects' AND column_name='customerName') THEN
        ALTER TABLE projects DROP COLUMN "customerName";
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='projects' AND column_name='customerEmail') THEN
        ALTER TABLE projects DROP COLUMN "customerEmail";
    END IF;
    
    -- Remove totalResources if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='projects' AND column_name='totalResources') THEN
        ALTER TABLE projects DROP COLUMN "totalResources";
    END IF;
    
    -- Remove updated_at if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='projects' AND column_name='updated_at') THEN
        ALTER TABLE projects DROP COLUMN updated_at;
    END IF;
    
    -- Add number_of_blocks if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='projects' AND column_name='number_of_blocks') THEN
        ALTER TABLE projects ADD COLUMN number_of_blocks INTEGER;
        -- Set default based on existing blocks count
        UPDATE projects SET number_of_blocks = (
            SELECT COUNT(*) FROM project_blocks WHERE project_blocks.project_id = projects.id
        );
    END IF;
END $$;

-- Step 7: Update project_blocks table structure
DO $$ 
BEGIN
    -- Rename gateCount to gate_count_million if needed
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='project_blocks' AND column_name='gateCount') THEN
        ALTER TABLE project_blocks RENAME COLUMN "gateCount" TO gate_count_million;
    END IF;
    
    -- Rename rtlDropCount to rtl_drops if needed
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='project_blocks' AND column_name='rtlDropCount') THEN
        ALTER TABLE project_blocks RENAME COLUMN "rtlDropCount" TO rtl_drops;
    END IF;
    
    -- Remove complexityFactors if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='project_blocks' AND column_name='complexityFactors') THEN
        ALTER TABLE project_blocks DROP COLUMN "complexityFactors";
    END IF;
    
    -- Remove blockEffort if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='project_blocks' AND column_name='blockEffort') THEN
        ALTER TABLE project_blocks DROP COLUMN "blockEffort";
    END IF;
    
    -- Add low_power_type if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='project_blocks' AND column_name='low_power_type') THEN
        ALTER TABLE project_blocks ADD COLUMN low_power_type VARCHAR(20);
    END IF;
END $$;

-- Note: After running this migration, you may want to drop and recreate project_full_chip_config
-- if it exists, as it's no longer used in the new schema. Or simply let TypeORM handle it.

