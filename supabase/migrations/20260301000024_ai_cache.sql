-- ============================================================
-- Migration 024: AI Cache
-- ============================================================
-- Stores pre-computed AI results (weekly brief, post-run
-- analysis, training plan) so the client never blocks on
-- a live Claude API call. One row per (user, feature).
-- coach_chat is NOT cached here — it lives in coach_messages.
-- ============================================================

create table public.ai_cache (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  feature       text not null,        -- 'weekly_brief' | 'post_run' | 'training_plan'
  payload       jsonb not null,       -- Claude-generated structured content
  context_hash  text,                 -- SHA-256 of serialised input; skip regen if unchanged
  generated_at  timestamptz not null default now(),
  unique(user_id, feature)
);

alter table public.ai_cache enable row level security;

-- Users can read their own cache rows
create policy "Users read own ai_cache"
  on public.ai_cache for select
  using (auth.uid() = user_id);

-- Edge functions use the service-role key which bypasses RLS,
-- so no explicit insert/update policy is required for them.
-- The policy below covers any authenticated upsert from clients
-- (e.g. optimistic writes) if needed in future.
create policy "Users upsert own ai_cache"
  on public.ai_cache for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
