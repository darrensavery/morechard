-- Development seed data
-- Run with: npm run db:seed

INSERT INTO families (id, name, currency, verify_mode)
VALUES ('fam_dev_001', 'Test Family', 'GBP', 'standard');

INSERT INTO users (id, family_id, display_name, email, locale)
VALUES
  ('usr_parent_a', 'fam_dev_001', 'Parent A', 'parent.a@example.com', 'en'),
  ('usr_parent_b', 'fam_dev_001', 'Parent B', 'parent.b@example.com', 'en'),
  ('usr_child_1',  'fam_dev_001', 'Child One', NULL, 'en');

INSERT INTO family_roles (user_id, family_id, role, granted_by)
VALUES
  ('usr_parent_a', 'fam_dev_001', 'parent', NULL),
  ('usr_parent_b', 'fam_dev_001', 'parent', 'usr_parent_a'),
  ('usr_child_1',  'fam_dev_001', 'child',  'usr_parent_a');
