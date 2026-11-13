-- Stand-ins for PACE Store columns created by earlier migrations
-- (20260301000001 core schema, 20260515000057 city rank, 20260518000069
-- store rewards, 20260811000001 redemptions). Run after _stub_notifications.sql.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_known_location geometry(Point, 4326);
ALTER TABLE public.pace_store_rewards
  ADD COLUMN IF NOT EXISTS brand text NOT NULL DEFAULT 'Brand',
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'entry',
  ADD COLUMN IF NOT EXISTS brand_color text NOT NULL DEFAULT '#000000',
  ADD COLUMN IF NOT EXISTS brand_initial text NOT NULL DEFAULT 'B',
  ADD COLUMN IF NOT EXISTS value_label text NOT NULL DEFAULT '20% off',
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'gear',
  ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
CREATE EXTENSION IF NOT EXISTS dblink;
