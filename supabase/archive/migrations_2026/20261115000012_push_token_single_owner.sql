-- ============================================================
-- A push token identifies one physical device, so it should belong to one user.
--
-- The unique key was (user_id, token). If a runner signs out and the token
-- cleanup fails (offline, app killed), the row stays; when someone else signs in
-- on that phone it registers the same token under their id, and BOTH accounts
-- now receive pushes on that device, so the previous runner's notifications
-- (zone attacks, club activity) land on a stranger's screen.
--
-- Fix: whichever user registers a token last owns it. A SECURITY DEFINER trigger
-- removes other users' rows for that token (clients can't: RLS limits them to
-- their own rows). The existing duplicates are cleaned once, keeping the newest.
-- ============================================================

-- One-time cleanup: keep the most recently updated owner of each token.
DELETE FROM public.expo_push_tokens t
 USING public.expo_push_tokens newer
 WHERE t.token = newer.token
   AND t.user_id <> newer.user_id
   AND (newer.updated_at, newer.id) > (t.updated_at, t.id);

CREATE OR REPLACE FUNCTION public.expo_push_token_single_owner()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.expo_push_tokens
   WHERE token = NEW.token
     AND user_id <> NEW.user_id;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.expo_push_token_single_owner() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_expo_push_token_single_owner ON public.expo_push_tokens;
CREATE TRIGGER trg_expo_push_token_single_owner
  AFTER INSERT OR UPDATE OF token, user_id ON public.expo_push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.expo_push_token_single_owner();
