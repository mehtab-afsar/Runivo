-- ============================================================
-- Migration 030: Trigger push notification on notifications INSERT
-- ============================================================
-- When a row is inserted into the notifications table, call the
-- send-push-notification Edge Function via pg_net so the user
-- receives a native push notification on their device.
--
-- pg_net must be enabled in your Supabase project:
--   Extensions → pg_net
--
-- The SUPABASE_EDGE_FUNCTION_URL secret must be set in:
--   Project Settings → Edge Functions → Environment Variables
-- ============================================================

-- Helper function called by the trigger
create or replace function public.notify_push_on_notification()
returns trigger
language plpgsql
security definer
as $$
declare
  edge_url text;
begin
  -- Read the Edge Function base URL from vault / app.settings
  edge_url := current_setting('app.edge_function_url', true);
  if edge_url is null or edge_url = '' then
    -- Graceful degradation: no push if URL not configured
    return new;
  end if;

  perform net.http_post(
    url     := edge_url || '/send-push-notification',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
               ),
    body    := jsonb_build_object(
                 'user_id',    new.user_id,
                 'title',      new.title,
                 'body',       coalesce(new.body, ''),
                 'action_url', coalesce(new.action_url, '/')
               )::text
  );

  return new;
end;
$$;

-- Attach the trigger — fires after each notification row is inserted
drop trigger if exists trg_notify_push on public.notifications;
create trigger trg_notify_push
  after insert on public.notifications
  for each row
  execute function public.notify_push_on_notification();

comment on function public.notify_push_on_notification is
  'Fires after notifications INSERT and calls the send-push-notification Edge Function via pg_net.
   Requires pg_net extension and app.edge_function_url / app.service_role_key settings.';
