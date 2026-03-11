-- ============================================================
-- Migration 016: Auto-sync event participant_count via trigger
-- ============================================================
-- Previously the client manually called an update after joining/
-- leaving events, creating a race condition for concurrent joins.
-- This trigger atomically increments/decrements the count in the
-- same transaction as the insert/delete on event_participants.
-- ============================================================

create or replace function public.sync_event_participant_count()
returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then
    update public.events
    set participant_count = participant_count + 1
    where id = NEW.event_id;
    return NEW;
  elsif TG_OP = 'DELETE' then
    update public.events
    set participant_count = greatest(participant_count - 1, 0)
    where id = OLD.event_id;
    return OLD;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_sync_event_participant_count on public.event_participants;
create trigger trg_sync_event_participant_count
  after insert or delete on public.event_participants
  for each row execute function public.sync_event_participant_count();
