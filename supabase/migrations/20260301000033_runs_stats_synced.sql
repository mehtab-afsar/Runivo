-- ============================================================
-- Migration 024: Idempotent run stats trigger
-- ============================================================
-- Adds a stats_synced flag to the runs table so that the
-- sync_profile_run_stats trigger only increments profile totals
-- on the first successful INSERT, not on retried upserts.
--
-- Also moves the trigger from AFTER INSERT to BEFORE INSERT so
-- it can set new.stats_synced = true before the row is committed.
-- Subsequent upserts become UPDATEs (which don't fire INSERT
-- triggers), making the guard belt-and-suspenders safety.
-- ============================================================

alter table public.runs
  add column if not exists stats_synced boolean not null default false;

comment on column public.runs.stats_synced is
  'True once sync_profile_run_stats has run for this row. Prevents double-counting on retried pushes.';

-- Re-create trigger function to check the flag
create or replace function public.sync_profile_run_stats()
returns trigger language plpgsql security definer as $$
declare
  today    date := new.started_at::date;
  last_run date;
begin
  -- Skip if already processed (idempotency guard)
  if new.stats_synced then
    return new;
  end if;

  -- Increment lifetime stats
  update public.profiles
  set
    total_runs        = total_runs + 1,
    total_distance_km = total_distance_km + (new.distance_m / 1000.0)
  where id = new.user_id;

  -- Update streak server-side
  select last_run_date into last_run
  from   public.profiles
  where  id = new.user_id;

  if last_run is null or last_run < today - interval '1 day' then
    -- First run ever, or streak broken
    update public.profiles
    set streak_days   = 1,
        last_run_date = today
    where id = new.user_id;
  elsif last_run = today - interval '1 day' then
    -- Consecutive day — extend streak
    update public.profiles
    set streak_days   = streak_days + 1,
        last_run_date = today
    where id = new.user_id;
  elsif last_run = today then
    -- Already ran today — just update last_run_date, no streak change
    update public.profiles
    set last_run_date = today
    where id = new.user_id;
  end if;

  -- Mark this row as processed
  new.stats_synced := true;
  return new;
end;
$$;

-- Switch to BEFORE INSERT so we can mutate new.stats_synced
drop trigger if exists trg_sync_profile_run_stats on public.runs;
create trigger trg_sync_profile_run_stats
  before insert on public.runs
  for each row execute function public.sync_profile_run_stats();
