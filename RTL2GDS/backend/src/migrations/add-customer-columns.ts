/**
 * Migration: Add customer_name and customer_email columns to projects table
 * Run this script to update your existing database
 * 
 * Usage: npx ts-node src/migrations/add-customer-columns.ts
 */

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'rtlgds',
});

async function runMigration() {
  try {
    console.log('Connecting to database...');
    await dataSource.initialize();
    console.log('Connected to database successfully!');

    console.log('Running migration: Adding customer_name and customer_email columns...');
    
    // Add customer_name column
    await dataSource.query(`
      ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS customer_name VARCHAR(150);
    `);
    console.log('✓ Added customer_name column');

    // Add customer_email column
    await dataSource.query(`
      ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS customer_email VARCHAR(150);
    `);
    console.log('✓ Added customer_email column');

    // Verify the columns were added
    const result = await dataSource.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'projects'
      AND column_name IN ('customer_name', 'customer_email');
    `);
    
    console.log('\nVerification:');
    console.table(result);

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

runMigration();

