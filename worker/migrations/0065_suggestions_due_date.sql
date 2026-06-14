-- Add due_date to suggestions so children can request a target completion date.
ALTER TABLE suggestions ADD COLUMN due_date TEXT;
