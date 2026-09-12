-- One-time product catalogue seed for the LIVE `morechard` production database.
-- Not part of the migration chain — run manually if the products table is
-- ever empty in production:
--   npx wrangler d1 execute morechard --remote --env production --file=dev/seed_products_prod.sql
INSERT OR IGNORE INTO products (sku, name, stripe_product_id, stripe_price_id, unit_amount_pence, currency, active) VALUES
  ('COMPLETE', 'Morechard Core', 'prod_VFHawfwlGcBusF', 'price_1UEmyUKGVFJVwtJFbbav5F6k', 4499, 'GBP', 1),
  ('COMPLETE_AI', 'Morechard Core AI', 'prod_VFHawfwlGcBusF', 'price_1UEmzzKGVFJVwtJFPWUcpeCI', 6499, 'GBP', 1),
  ('SHIELD_AI', 'Morechard Shield AI', 'prod_VFHawfwlGcBusF', 'price_1UEn0rKGVFJVwtJFDk3avBvV', 14999, 'GBP', 1),
  ('AI_UPGRADE', 'AI Mentor + Learning Lab Upgrade', 'prod_VFHawfwlGcBusF', 'price_1UEn1HKGVFJVwtJFm27L00L1', 2999, 'GBP', 1);
