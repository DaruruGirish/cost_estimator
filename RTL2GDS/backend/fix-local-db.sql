-- Fix local database schema to match staging
-- Run this script on your local PostgreSQL database

-- 1. Check if leads table exists and has the correct columns
-- If otp_code, otp_expires_at, email_verified columns don't exist, this will add them
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS otp_code VARCHAR(6),
ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

-- 2. Add customer_name and customer_email to projects table if they don't exist
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(150),
ADD COLUMN IF NOT EXISTS customer_email VARCHAR(150);

-- 3. Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'leads' 
ORDER BY ordinal_position;

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'projects' 
ORDER BY ordinal_position;
