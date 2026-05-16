-- Fix estimated_duration_months column type to accept decimals
-- Change from integer to numeric(10,1) to match the entity definition

ALTER TABLE projects 
ALTER COLUMN estimated_duration_months TYPE numeric(10,1) 
USING estimated_duration_months::numeric(10,1);
