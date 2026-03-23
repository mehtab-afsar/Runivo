-- AI usage log: tracks token counts and cost per Claude API call
create table public.ai_usage_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  feature       text not null,
  input_tokens  int  not null,
  output_tokens int  not null,
  cost_usd      numeric(10,6) not null,
  created_at    timestamptz not null default now()
);

alter table public.ai_usage_log enable row level security;

-- Users can read their own usage (e.g. for a future "AI usage" settings page)
create policy "Users read own ai_usage_log" on public.ai_usage_log
  for select using (auth.uid() = user_id);

-- Edge functions (service_role) insert records; no client writes
-- service_role bypasses RLS — no explicit insert policy needed

create index ai_usage_log_user_created
  on public.ai_usage_log(user_id, created_at desc);
