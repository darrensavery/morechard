-- 0053_family_global_rules.sql
-- Adds pocket_money_day, overdraft_enabled, overdraft_limit_pence to families.

ALTER TABLE families ADD COLUMN pocket_money_day INTEGER NOT NULL DEFAULT 6
  CHECK (pocket_money_day BETWEEN 0 AND 6);

ALTER TABLE families ADD COLUMN overdraft_enabled INTEGER NOT NULL DEFAULT 0;

ALTER TABLE families ADD COLUMN overdraft_limit_pence INTEGER NOT NULL DEFAULT 0
  CHECK (overdraft_limit_pence >= 0);
