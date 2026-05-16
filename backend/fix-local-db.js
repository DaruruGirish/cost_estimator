// Run this script to fix your local database schema
// Usage: node fix-local-db.js

require('dotenv').config();
const { Client } = require('pg');

async function fixDatabase() {
    const client = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        user: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'rtlgds',
    });

    try {
        await client.connect();
        console.log('✓ Connected to database');

        // 1. Add OTP columns to leads table if they don't exist
        console.log('\n1. Checking leads table...');
        await client.query(`
      ALTER TABLE leads 
      ADD COLUMN IF NOT EXISTS otp_code VARCHAR(6),
      ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
    `);
        console.log('✓ OTP columns added/verified in leads table');

        // 2. Add customer columns to projects table if they don't exist
        console.log('\n2. Checking projects table...');
        await client.query(`
      ALTER TABLE projects 
      ADD COLUMN IF NOT EXISTS customer_name VARCHAR(150),
      ADD COLUMN IF NOT EXISTS customer_email VARCHAR(150);
    `);
        console.log('✓ Customer columns added/verified in projects table');

        // 3. Verify leads table structure
        console.log('\n3. Verifying leads table structure:');
        const leadsResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'leads' 
      ORDER BY ordinal_position;
    `);
        console.table(leadsResult.rows);

        // 4. Verify projects table structure
        console.log('\n4. Verifying projects table structure:');
        const projectsResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'projects' 
      ORDER BY ordinal_position;
    `);
        console.table(projectsResult.rows);

        console.log('\n✅ Database schema updated successfully!');
        console.log('You can now restart your backend server.');

    } catch (error) {
        console.error('❌ Error updating database:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

fixDatabase();
