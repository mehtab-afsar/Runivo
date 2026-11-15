-- ============================================================
-- User-generated content moderation (App Store Guideline 1.2).
--
-- Apple requires, for any app with user-generated content: a way to report it,
-- a way to block abusive users, filtering of objectionable material, and a
-- developer who acts on reports. What already existed: report_post, report_user,
-- club_message_reports and block/mute. What was missing, and is added here:
--
--   1. Reporting for the surfaces that had none: comments, clubs, events
--      (content_reports + report_content, same shape as report_post: no client
--      read access, idempotent, rate limited).
--   2. Comments auto-hide once 3 different people report them.
--   3. Bans (user_bans). Clients cannot read or lift them, which is why this is
--      a table of its own and not a column on `profiles`, which owners can update.
--      A banned runner can still read but cannot post comments, posts or chat.
--   4. A word filter that rejects objectionable text at the database, so a
--      modified app cannot bypass it. The list lives in `blocked_terms`
--      (managed by moderators; starter list in supabase/seed/blocked_terms.sql).
--
-- The web admin (apps/web/app/admin, Moderation tab) reads the report tables and
-- takes the actions; see docs/MODERATION.md for the process and response time.
-- ============================================================

-- ── 1. Reports ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.content_reports (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type  text        NOT NULL CHECK (target_type IN ('comment', 'club', 'event')),
  target_id    uuid        NOT NULL,
  reason       text        NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 300),
  status       text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'actioned', 'dismissed')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  reviewed_at  timestamptz,
  UNIQUE (reporter_id, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS content_reports_open_idx ON public.content_reports (status, created_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS content_reports_target_idx ON public.content_reports (target_type, target_id);

COMMENT ON TABLE public.content_reports IS 'User reports on comments, clubs and events. Moderation input only: no client policy, written by report_content(), read by the admin (service role).';
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.content_reports FROM anon, authenticated;

ALTER TABLE public.feed_post_comments ADD COLUMN IF NOT EXISTS hidden_at timestamptz;

-- The older report tables had no way to mark a report handled, so a queue could
-- not tell new from done. user_reports already has `status`.
ALTER TABLE public.post_reports
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'actioned', 'dismissed'));
ALTER TABLE public.club_message_reports
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'actioned', 'dismissed'));

CREATE OR REPLACE FUNCTION public.report_content(p_type text, p_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_distinct int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_type NOT IN ('comment', 'club', 'event') THEN RAISE EXCEPTION 'bad_target_type'; END IF;
  IF char_length(trim(coalesce(p_reason, ''))) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'bad_reason'; END IF;

  IF NOT (
    (p_type = 'comment' AND EXISTS (SELECT 1 FROM public.feed_post_comments WHERE id = p_id)) OR
    (p_type = 'club'    AND EXISTS (SELECT 1 FROM public.clubs WHERE id = p_id)) OR
    (p_type = 'event'   AND EXISTS (SELECT 1 FROM public.events WHERE id = p_id))
  ) THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  -- One person cannot flood the queue.
  IF (SELECT count(*) FROM public.content_reports WHERE reporter_id = v_uid AND created_at > now() - interval '1 day') >= 30 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  INSERT INTO public.content_reports (reporter_id, target_type, target_id, reason)
  VALUES (v_uid, p_type, p_id, trim(p_reason))
  ON CONFLICT (reporter_id, target_type, target_id) DO NOTHING;

  -- Comments are the high-volume surface: three different people flagging one is
  -- enough to hide it from everyone until a moderator looks. Clubs and events
  -- go to a person, because hiding them wrongly has a bigger cost.
  IF p_type = 'comment' THEN
    SELECT count(DISTINCT reporter_id) INTO v_distinct
      FROM public.content_reports
     WHERE target_type = 'comment' AND target_id = p_id AND status = 'open';
    IF v_distinct >= 3 THEN
      UPDATE public.feed_post_comments SET hidden_at = COALESCE(hidden_at, now()) WHERE id = p_id;
    END IF;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.report_content(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_content(text, uuid, text) TO authenticated;

-- Hidden comments are gone for everyone (the previous version only filtered blocks).
CREATE OR REPLACE FUNCTION public.get_comments(p_post_id uuid, lim integer DEFAULT 50)
 RETURNS TABLE(id uuid, user_id uuid, username text, avatar_color text, content text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT c.id, c.user_id, p.username, p.avatar_color,
         c.content, c.created_at
  FROM public.feed_post_comments c
  JOIN public.profiles p ON p.id = c.user_id
  WHERE c.post_id = p_post_id
    AND c.hidden_at IS NULL
    AND NOT public.is_blocked_between(auth.uid(), c.user_id)
  ORDER BY c.created_at ASC
  LIMIT lim;
$function$;

-- ── 2. Bans ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_bans (
  user_id    uuid        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason     text,
  banned_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.user_bans IS 'Runners suspended from posting. Not a profiles column: owners can update their own profile row, and must not be able to lift a ban.';
ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_bans FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_banned(p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_bans WHERE user_id = p_user) $$;

CREATE OR REPLACE FUNCTION public.reject_if_banned() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF public.is_banned(NEW.user_id) THEN
    RAISE EXCEPTION 'account_suspended' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_banned_comments ON public.feed_post_comments;
CREATE TRIGGER trg_banned_comments BEFORE INSERT ON public.feed_post_comments
  FOR EACH ROW EXECUTE FUNCTION public.reject_if_banned();
DROP TRIGGER IF EXISTS trg_banned_chat ON public.lobby_messages;
CREATE TRIGGER trg_banned_chat BEFORE INSERT ON public.lobby_messages
  FOR EACH ROW EXECUTE FUNCTION public.reject_if_banned();
DROP TRIGGER IF EXISTS trg_banned_posts ON public.feed_posts;
CREATE TRIGGER trg_banned_posts BEFORE INSERT ON public.feed_posts
  FOR EACH ROW EXECUTE FUNCTION public.reject_if_banned();

-- ── 3. Word filter ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.blocked_terms (
  term text PRIMARY KEY CHECK (term = lower(term) AND term ~ '^[a-z0-9]+$')
);
COMMENT ON TABLE public.blocked_terms IS 'Single words (lowercase) that are rejected in comments, chat, bios, club and event text. Whole-word match, so innocent words that merely contain one are not blocked. Managed by moderators.';
ALTER TABLE public.blocked_terms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blocked_terms FROM anon, authenticated;

-- Whole words only, after folding common letter swaps (0->o, 1->i, 3->e, 4->a, @->a, $->s, 5->s, !->i).
CREATE OR REPLACE FUNCTION public.contains_blocked_term(p text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM regexp_split_to_table(lower(translate(coalesce(p, ''), '0134@$5!', 'oieaassi')), '[^a-z0-9]+') AS t(word)
      JOIN public.blocked_terms b ON b.term = t.word
  );
$$;

-- TG_ARGV lists the columns to check. Runs as the table owner so it can read blocked_terms.
CREATE OR REPLACE FUNCTION public.reject_blocked_text() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  col text;
  val text;
BEGIN
  FOREACH col IN ARRAY TG_ARGV LOOP
    val := to_jsonb(NEW) ->> col;
    IF val IS NOT NULL AND public.contains_blocked_term(val) THEN
      RAISE EXCEPTION 'content_not_allowed' USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_filter_comments ON public.feed_post_comments;
CREATE TRIGGER trg_filter_comments BEFORE INSERT ON public.feed_post_comments
  FOR EACH ROW EXECUTE FUNCTION public.reject_blocked_text('content');
DROP TRIGGER IF EXISTS trg_filter_chat ON public.lobby_messages;
CREATE TRIGGER trg_filter_chat BEFORE INSERT ON public.lobby_messages
  FOR EACH ROW EXECUTE FUNCTION public.reject_blocked_text('content');
DROP TRIGGER IF EXISTS trg_filter_clubs ON public.clubs;
CREATE TRIGGER trg_filter_clubs BEFORE INSERT OR UPDATE OF name, description ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.reject_blocked_text('name', 'description');
DROP TRIGGER IF EXISTS trg_filter_events ON public.events;
CREATE TRIGGER trg_filter_events BEFORE INSERT OR UPDATE OF title, description ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.reject_blocked_text('title', 'description');
-- Profiles: only when the text actually changes, so an old bio never blocks an unrelated sync.
DROP TRIGGER IF EXISTS trg_filter_profiles ON public.profiles;
CREATE TRIGGER trg_filter_profiles BEFORE UPDATE OF bio, display_name ON public.profiles
  FOR EACH ROW WHEN (NEW.bio IS DISTINCT FROM OLD.bio OR NEW.display_name IS DISTINCT FROM OLD.display_name)
  EXECUTE FUNCTION public.reject_blocked_text('bio', 'display_name');

-- ── 4. Nothing here is callable by clients except report_content ────────────
REVOKE ALL ON FUNCTION public.is_banned(uuid)            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.contains_blocked_term(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_if_banned()          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_blocked_text()       FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_banned(uuid), public.contains_blocked_term(text) TO service_role;
