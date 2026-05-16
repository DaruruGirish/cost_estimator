-- QUICK FIX: Drop and recreate database (DEVELOPMENT ONLY - LOSES ALL DATA)
-- Run this if you don't mind losing existing data

-- Connect to PostgreSQL and run:
-- psql -U postgres
-- Then run these commands:

DROP DATABASE IF EXISTS rtlgds;
CREATE DATABASE rtlgds;

-- Then restart your NestJS application
-- TypeORM will create all tables fresh with the new schema

