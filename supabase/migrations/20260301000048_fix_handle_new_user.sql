-- ============================================================
-- Migration 048: Fix handle_new_user trigger
-- ============================================================
-- The original trigger fails with "database error saving new user"
-- when the chosen username is already taken (unique constraint on
-- profiles.username). Fix: if the base username is taken, append
-- a 4-char random hex suffix until unique.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  base_username text;
  final_username text;
  attempt       int := 0;
begin
  base_username := coalesce(
    nullif(trim(new.raw_user_meta_data->>'username'), ''),
    split_part(new.email, '@', 1)
  );

  -- Sanitise: keep only alphanumerics and underscores, max 20 chars
  base_username := substring(regexp_replace(base_username, '[^a-zA-Z0-9_]', '', 'g'), 1, 20);

  -- Fallback if sanitisation yields empty string
  if base_username = '' then
    base_username := 'runner';
  end if;

  final_username := base_username;

  -- Try up to 10 times with a random suffix to avoid collisions
  loop
    begin
      insert into public.profiles (id, username)
      values (new.id, final_username)
      on conflict (id) do nothing;
      -- If we reach here the insert succeeded (or id conflict → do nothing)
      return new;
    exception when unique_violation then
      -- username collision — try with a suffix
      attempt := attempt + 1;
      if attempt > 10 then
        -- Last resort: use user id prefix
        final_username := base_username || '_' || substring(replace(new.id::text, '-', ''), 1, 6);
        insert into public.profiles (id, username)
        values (new.id, final_username)
        on conflict do nothing;
        return new;
      end if;
      final_username := base_username || '_' || substring(md5(random()::text), 1, 4);
    end;
  end loop;
end;
$$;
