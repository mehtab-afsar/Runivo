-- Stand-ins for what 20260301000001_core_schema / 20260301000048 create:
-- the onboarding columns on profiles and the auth.users sign-up trigger.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS primary_goal text CHECK (primary_goal IN ('get_fit', 'lose_weight', 'run_faster', 'explore', 'compete')),
  ADD COLUMN IF NOT EXISTS weekly_frequency int,
  ADD COLUMN IF NOT EXISTS age int;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text, phone text, raw_user_meta_data jsonb DEFAULT '{}'::jsonb
);
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN new; END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
