/**
 * Migration: Fix estimated_duration_months column type to accept decimals
 * Change from integer to numeric(10,1) to match the entity definition
 * 
 * Usage: npx ts-node src/migrations/fix-estimated-duration-months-type.ts
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

    console.log('Running migration: Fixing estimated_duration_months column type...');
    
    // Check current column type
    const beforeResult = await dataSource.query(`
      SELECT column_name, data_type, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_name = 'projects' 
      AND column_name = 'estimated_duration_months';
    `);
    
    console.log('\nCurrent column type:');
    console.table(beforeResult);
    
    // Change column type from integer to numeric(10,1)
    await dataSource.query(`
      ALTER TABLE projects 
      ALTER COLUMN estimated_duration_months TYPE numeric(10,1) 
      USING estimated_duration_months::numeric(10,1);
    `);
    console.log('✓ Changed estimated_duration_months column type to numeric(10,1)');

    // Verify the change
    const afterResult = await dataSource.query(`
      SELECT column_name, data_type, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_name = 'projects' 
      AND column_name = 'estimated_duration_months';
    `);
    
    console.log('\nUpdated column type:');
    console.table(afterResult);

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

runMigration();
