-- Migration 0038: Shield SKU
-- Adds has_shield flag to families for the one-off £149.99 Shield plan.
-- Default 0 (false) — existing rows are unaffected.
ALTER TABLE families ADD COLUMN has_shield INTEGER NOT NULL DEFAULT 0;
