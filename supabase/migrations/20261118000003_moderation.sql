-- ========================================================================
-- Moderation and safety
-- ========================================================================
-- Blocks, mutes, reports, bans and blocked terms.
--
-- One file per feature: this file creates everything this feature owns
-- (tables, functions, triggers, row-level security, grants, scheduled jobs).
-- It needs only the files before it. Built from the 178 migrations up to
-- 20261117000012 (the 178 old files were removed after commit 9e5cf19; see git history); a fresh
-- database built from these files matches one built from those exactly.
--
-- Tables: blocked_terms, content_reports, user_bans, user_blocks, user_mutes, user_reports

SET check_function_bodies = false;
SET client_min_messages = warning;
SET search_path = public, extensions;


-- ── Tables ────────────────────────────────────────────────────────────

CREATE TABLE public.blocked_terms (
    term text NOT NULL,
    CONSTRAINT blocked_terms_term_check CHECK (((term = lower(term)) AND (term ~ '^[a-z0-9]+$'::text)))
);

CREATE TABLE public.content_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reporter_id uuid NOT NULL,
    target_type text NOT NULL,
    target_id uuid NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    CONSTRAINT content_reports_reason_check CHECK (((char_length(reason) >= 1) AND (char_length(reason) <= 300))),
    CONSTRAINT content_reports_status_check CHECK ((status = ANY (ARRAY['open'::text, 'actioned'::text, 'dismissed'::text]))),
    CONSTRAINT content_reports_target_type_check CHECK ((target_type = ANY (ARRAY['comment'::text, 'club'::text, 'event'::text])))
);

CREATE TABLE public.user_bans (
    user_id uuid NOT NULL,
    reason text,
    banned_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_blocks (
    blocker_id uuid NOT NULL,
    blocked_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_blocks_check CHECK ((blocker_id <> blocked_id))
);

CREATE TABLE public.user_mutes (
    muter_id uuid NOT NULL,
    muted_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_mutes_check CHECK ((muter_id <> muted_id))
);

CREATE TABLE public.user_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reporter_id uuid NOT NULL,
    target_user_id uuid NOT NULL,
    reason text NOT NULL,
    details text,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_reports_details_check CHECK (((details IS NULL) OR (length(details) <= 1000))),
    CONSTRAINT user_reports_reason_check CHECK ((reason = ANY (ARRAY['spam'::text, 'harassment'::text, 'impersonation'::text, 'cheating'::text, 'inappropriate'::text, 'other'::text]))),
    CONSTRAINT user_reports_status_check CHECK ((status = ANY (ARRAY['open'::text, 'reviewed'::text, 'actioned'::text, 'dismissed'::text])))
);


-- ── Keys and checks ───────────────────────────────────────────────────

ALTER TABLE ONLY public.blocked_terms
    ADD CONSTRAINT blocked_terms_pkey PRIMARY KEY (term);

ALTER TABLE ONLY public.content_reports
    ADD CONSTRAINT content_reports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.content_reports
    ADD CONSTRAINT content_reports_reporter_id_target_type_target_id_key UNIQUE (reporter_id, target_type, target_id);

ALTER TABLE ONLY public.user_bans
    ADD CONSTRAINT user_bans_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_pkey PRIMARY KEY (blocker_id, blocked_id);

ALTER TABLE ONLY public.user_mutes
    ADD CONSTRAINT user_mutes_pkey PRIMARY KEY (muter_id, muted_id);

ALTER TABLE ONLY public.user_reports
    ADD CONSTRAINT user_reports_pkey PRIMARY KEY (id);


-- ── Functions ─────────────────────────────────────────────────────────

CREATE FUNCTION public.block_user(p_target uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  IF p_target IS NULL OR p_target = v_uid THEN RAISE EXCEPTION 'cannot block yourself' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.user_blocks (blocker_id, blocked_id) VALUES (v_uid, p_target) ON CONFLICT DO NOTHING;
  -- Unfollow both ways (sync_follow_counts keeps the counters right).
  DELETE FROM public.followers
   WHERE (follower_id = v_uid AND following_id = p_target)
      OR (follower_id = p_target AND following_id = v_uid);
  -- A block replaces a mute.
  DELETE FROM public.user_mutes WHERE muter_id = v_uid AND muted_id = p_target;
END;
$$;

CREATE FUNCTION public.contains_blocked_term(p text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
  SELECT EXISTS (
    SELECT 1
      FROM regexp_split_to_table(lower(translate(coalesce(p, ''), '0134@$5!', 'oieaassi')), '[^a-z0-9]+') AS t(word)
      JOIN public.blocked_terms b ON b.term = t.word
  );
$_$;

CREATE FUNCTION public.hidden_user_ids(p_viewer uuid) RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT blocked_id FROM public.user_blocks WHERE blocker_id = p_viewer
  UNION SELECT blocker_id FROM public.user_blocks WHERE blocked_id = p_viewer
  UNION SELECT muted_id FROM public.user_mutes WHERE muter_id = p_viewer;
$$;

CREATE FUNCTION public.is_banned(p_user uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ SELECT EXISTS (SELECT 1 FROM public.user_bans WHERE user_id = p_user) $$;

CREATE FUNCTION public.is_blocked_between(a uuid, b uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT a IS NOT NULL AND b IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_blocks
     WHERE (blocker_id = a AND blocked_id = b) OR (blocker_id = b AND blocked_id = a));
$$;

CREATE FUNCTION public.mute_user(p_target uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  IF p_target IS NULL OR p_target = v_uid THEN RAISE EXCEPTION 'cannot mute yourself' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.user_mutes (muter_id, muted_id) VALUES (v_uid, p_target) ON CONFLICT DO NOTHING;
END;
$$;

CREATE FUNCTION public.refuse_blocked_follow() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF public.is_blocked_between(NEW.follower_id, NEW.following_id) THEN
    RAISE EXCEPTION 'blocked' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.refuse_blocked_interaction() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_owner uuid; v_vis text;
BEGIN
  SELECT user_id, visibility INTO v_owner, v_vis FROM public.feed_posts WHERE id = NEW.post_id;
  IF v_owner IS NULL OR NOT public.can_view_post(NEW.user_id, v_owner, v_vis) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.reject_blocked_text() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

CREATE FUNCTION public.reject_if_banned() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF public.is_banned(NEW.user_id) THEN
    RAISE EXCEPTION 'account_suspended' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.report_content(p_type text, p_id uuid, p_reason text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

CREATE FUNCTION public.report_user(p_target uuid, p_reason text, p_details text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  IF p_target IS NULL OR p_target = v_uid THEN RAISE EXCEPTION 'cannot report yourself' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_reports WHERE reporter_id = v_uid AND target_user_id = p_target AND status = 'open') THEN
    RETURN;
  END IF;
  IF (SELECT count(*) FROM public.user_reports WHERE reporter_id = v_uid AND created_at > now() - interval '1 day') >= 5 THEN
    RAISE EXCEPTION 'too many reports today' USING ERRCODE = '54000';
  END IF;
  INSERT INTO public.user_reports (reporter_id, target_user_id, reason, details)
  VALUES (v_uid, p_target, p_reason, NULLIF(trim(COALESCE(p_details, '')), ''));
END;
$$;

CREATE FUNCTION public.unblock_user(p_target uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  DELETE FROM public.user_blocks WHERE blocker_id = auth.uid() AND blocked_id = p_target;
$$;

CREATE FUNCTION public.unmute_user(p_target uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  DELETE FROM public.user_mutes WHERE muter_id = auth.uid() AND muted_id = p_target;
$$;


-- ── Foreign keys ──────────────────────────────────────────────────────

ALTER TABLE ONLY public.content_reports
    ADD CONSTRAINT content_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_bans
    ADD CONSTRAINT user_bans_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_mutes
    ADD CONSTRAINT user_mutes_muted_id_fkey FOREIGN KEY (muted_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_mutes
    ADD CONSTRAINT user_mutes_muter_id_fkey FOREIGN KEY (muter_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_reports
    ADD CONSTRAINT user_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_reports
    ADD CONSTRAINT user_reports_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


-- ── Indexes ───────────────────────────────────────────────────────────

CREATE INDEX content_reports_open_idx ON public.content_reports USING btree (status, created_at) WHERE (status = 'open'::text);

CREATE INDEX content_reports_target_idx ON public.content_reports USING btree (target_type, target_id);

CREATE INDEX user_blocks_blocked_idx ON public.user_blocks USING btree (blocked_id);

CREATE INDEX user_reports_target_idx ON public.user_reports USING btree (target_user_id, created_at DESC);


-- ── Triggers ──────────────────────────────────────────────────────────

CREATE TRIGGER trg_filter_profiles BEFORE UPDATE OF bio, display_name ON public.profiles FOR EACH ROW WHEN (((new.bio IS DISTINCT FROM old.bio) OR (new.display_name IS DISTINCT FROM old.display_name))) EXECUTE FUNCTION public.reject_blocked_text('bio', 'display_name');


-- ── Row-level security ────────────────────────────────────────────────

ALTER TABLE public.blocked_terms ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_mutes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;


-- ── Policies ──────────────────────────────────────────────────────────

CREATE POLICY "user_blocks: own" ON public.user_blocks FOR SELECT TO authenticated USING ((blocker_id = auth.uid()));

CREATE POLICY "user_mutes: own" ON public.user_mutes FOR SELECT TO authenticated USING ((muter_id = auth.uid()));


-- ── Comments ──────────────────────────────────────────────────────────

COMMENT ON TABLE public.blocked_terms IS 'Single words (lowercase) that are rejected in comments, chat, bios, club and event text. Whole-word match, so innocent words that merely contain one are not blocked. Managed by moderators.';

COMMENT ON TABLE public.content_reports IS 'User reports on comments, clubs and events. Moderation input only: no client policy, written by report_content(), read by the admin (service role).';

COMMENT ON TABLE public.user_bans IS 'Runners suspended from posting. Not a profiles column: owners can update their own profile row, and must not be able to lift a ban.';


-- ── Grants ────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.contains_blocked_term(p text) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.contains_blocked_term(p text) TO service_role;

REVOKE ALL ON FUNCTION public.hidden_user_ids(p_viewer uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.hidden_user_ids(p_viewer uuid) TO anon;
GRANT ALL ON FUNCTION public.hidden_user_ids(p_viewer uuid) TO service_role;

REVOKE ALL ON FUNCTION public.is_banned(p_user uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.is_banned(p_user uuid) TO service_role;

REVOKE ALL ON FUNCTION public.reject_blocked_text() FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.reject_blocked_text() TO service_role;

REVOKE ALL ON FUNCTION public.reject_if_banned() FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.reject_if_banned() TO service_role;

REVOKE ALL ON FUNCTION public.report_content(p_type text, p_id uuid, p_reason text) FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.report_content(p_type text, p_id uuid, p_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.report_content(p_type text, p_id uuid, p_reason text) TO service_role;

REVOKE ALL ON TABLE public.blocked_terms FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.blocked_terms TO service_role;

REVOKE ALL ON TABLE public.content_reports FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.content_reports TO service_role;

REVOKE ALL ON TABLE public.user_bans FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.user_bans TO service_role;
