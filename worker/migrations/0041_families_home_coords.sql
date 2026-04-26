-- Migration 0041: add home_lat / home_lng to families for PDF export geo-verification block.
ALTER TABLE families ADD COLUMN home_lat REAL;
ALTER TABLE families ADD COLUMN home_lng REAL;
