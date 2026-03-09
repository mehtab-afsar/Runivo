-- ============================================================
-- Migration 010: Run Media — Kudos + Photos
-- ============================================================
-- Kudos are emoji reactions sent between runners for a specific run.
-- Receiving kudos fires a notification automatically.
-- Run photos are optional post-run media stored in Supabase Storage
-- under the "run-photos" bucket.
--
-- Tables:   kudos, run_photos
-- Triggers: trg_notify_kudos
-- RPCs:     run_kudos_count()
-- ============================================================

-- ----------------------------------------------------------------
-- KUDOS
-- ----------------------------------------------------------------
create table public.kudos (
  id          uuid        primary key default gen_random_uuid(),
  from_id     uuid        not null references public.profiles(id) on delete cascade,
  to_id       uuid        not null references public.profiles(id) on delete cascade,
  run_id      uuid        references public.runs(id) on delete cascade,
  emoji       text        not null default '👏' check (emoji in ('👏','🔥','💪','⚡','🏆')),
  created_at  timestamptz not null default now(),
  unique (from_id, run_id)   -- one kudos per sender per run
);

create index kudos_to_id_idx  on public.kudos(to_id, created_at desc);
create index kudos_run_id_idx on public.kudos(run_id);

comment on table public.kudos is 'Emoji kudos sent between runners for specific runs.';

-- Trigger: send a notification to the recipient when kudos arrive
create or replace function public.notify_kudos()
returns trigger language plpgsql security definer as $$
declare
  sender_name text;
begin
  select username into sender_name from public.profiles where id = new.from_id;

  insert into public.notifications (user_id, type, title, body, action_url)
  values (
    new.to_id,
    'kudos',
    sender_name || ' gave you kudos ' || new.emoji,
    'Keep it up!',
    case when new.run_id is not null then '/run/' || new.run_id::text else null end
  );
  return new;
end;
$$;

create trigger trg_notify_kudos
  after insert on public.kudos
  for each row execute function public.notify_kudos();

-- RPC: total kudos count for a given run
create or replace function public.run_kudos_count(run_id uuid)
returns int language sql security definer stable as $$
  select count(*)::int from public.kudos where kudos.run_id = run_kudos_count.run_id;
$$;

-- ----------------------------------------------------------------
-- RUN PHOTOS
-- ----------------------------------------------------------------
create table public.run_photos (
  id          uuid        primary key default gen_random_uuid(),
  run_id      uuid        not null references public.runs(id) on delete cascade,
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  storage_key text        not null,   -- path in Supabase Storage "run-photos" bucket
  width       int,
  height      int,
  created_at  timestamptz not null default now()
);

create index run_photos_run_id_idx on public.run_photos(run_id);

comment on table public.run_photos is 'Optional photos attached to a run — stored in the run-photos Storage bucket.';

-- ----------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------
alter table public.kudos      enable row level security;
alter table public.run_photos enable row level security;

create policy "kudos: anyone can read"
  on public.kudos for select using (true);
create policy "kudos: authenticated can send"
  on public.kudos for insert with check (auth.uid() = from_id and from_id <> to_id);
create policy "kudos: sender can delete"
  on public.kudos for delete using (auth.uid() = from_id);

create policy "run_photos: anyone can read"
  on public.run_photos for select using (true);
create policy "run_photos: owner can insert"
  on public.run_photos for insert with check (auth.uid() = user_id);
create policy "run_photos: owner can delete"
  on public.run_photos for delete using (auth.uid() = user_id);
