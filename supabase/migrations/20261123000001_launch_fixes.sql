-- Launch fixes found in the pre-submission review (23 Nov 2026).
--
-- 1. Account deletion (App Store 5.1.1(v)) failed for anyone who had stolen or
--    lost a zone: feed_posts.stolen_from_user_id pointed at profiles with no
--    ON DELETE rule, so deleting the user hit a foreign-key violation.
-- 2. The word filter (App Store 1.2) had an empty list unless a seed was run by
--    hand. The list now ships with the schema.
-- 3. Post titles and text, run titles and descriptions, and usernames skipped the
--    filter. New rows are cleaned (the offending field is cleared, so a run upload
--    or sign-up never fails over a word); edits are refused with content_not_allowed.

-- ── 1. Deleting a runner keeps the zone-steal posts, without the link ──────────
ALTER TABLE public.feed_posts DROP CONSTRAINT feed_posts_stolen_from_user_id_fkey;
ALTER TABLE public.feed_posts
  ADD CONSTRAINT feed_posts_stolen_from_user_id_fkey
  FOREIGN KEY (stolen_from_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ── 2. Blocked words ─────────────────────────────────────────────────────────
-- Single lowercase words, matched whole-word after folding 0/1/3/4/@/$/5/! to
-- letters (contains_blocked_term). Built from the "List of Dirty, Naughty, Obscene,
-- and Otherwise Bad Words" (github.com/LDNOOBW, CC BY 4.0), English and Hindi,
-- with words runners use innocently removed (e.g. nipple, butt kicks, domination,
-- snatch, hardcore, suck, chakke). Moderators can add more rows at any time.
INSERT INTO public.blocked_terms (term) VALUES
 ('2g1c'), ('aand'), ('aandu'), ('acrotomophilia'), ('anal'), ('anilingus'), ('anus'),
 ('apeshit'), ('arsehole'), ('ass'), ('asshole'), ('assmunch'), ('autoerotic'), ('babeland'),
 ('balatkar'), ('balatkari'), ('bangbros'), ('bangbus'), ('bareback'), ('barenaked'),
 ('bastard'), ('bastardo'), ('bastinado'), ('bbw'), ('bdsm'), ('beaner'), ('beaners'),
 ('beastiality'), ('bestiality'), ('bhadva'), ('bhadve'), ('bhandve'), ('bhangi'), ('bhosad'),
 ('bimbos'), ('birdlock'), ('bitch'), ('bitches'), ('blowjob'), ('blumpkin'), ('bollocks'),
 ('bondage'), ('boner'), ('boob'), ('boobe'), ('boobs'), ('bukkake'), ('bulldyke'),
 ('bullshit'), ('bunghole'), ('busty'), ('butthole'), ('camgirl'), ('camslut'), ('camwhore'),
 ('carpetmuncher'), ('chinaal'), ('chinki'), ('chod'), ('chodu'), ('chooche'), ('choochi'),
 ('choope'), ('choot'), ('chootia'), ('chootiya'), ('chuche'), ('chuchi'), ('chudaap'),
 ('chude'), ('chut'), ('chutad'), ('chutadd'), ('chutan'), ('chutia'), ('chutiya'), ('cialis'),
 ('circlejerk'), ('clit'), ('clitoris'), ('clusterfuck'), ('cock'), ('cocks'), ('coon'),
 ('coons'), ('coprolagnia'), ('coprophilia'), ('cornhole'), ('creampie'), ('cum'), ('cumming'),
 ('cumshot'), ('cumshots'), ('cunnilingus'), ('cunt'), ('darkie'), ('daterape'),
 ('deepthroat'), ('dendrophilia'), ('dick'), ('dickhead'), ('dildo'), ('dingleberries'),
 ('dingleberry'), ('doggiestyle'), ('doggystyle'), ('dolcett'), ('dominatrix'), ('dommes'),
 ('dvda'), ('ecchi'), ('ejaculation'), ('erotic'), ('fag'), ('faggot'), ('fecal'), ('felch'),
 ('fellatio'), ('feltch'), ('femdom'), ('figging'), ('fingerbang'), ('fingering'), ('fisting'),
 ('footjob'), ('frotting'), ('fuck'), ('fucker'), ('fuckin'), ('fucking'), ('fucktards'),
 ('fudgepacker'), ('futanari'), ('gaand'), ('gaandfat'), ('gaandmasti'), ('gaandufad'),
 ('gandfattu'), ('gandu'), ('gangbang'), ('gashti'), ('gasti'), ('genitals'), ('ghasti'),
 ('goatcx'), ('goatse'), ('gokkun'), ('goregasm'), ('grope'), ('guro'), ('handjob'),
 ('haramzade'), ('hentai'), ('homoerotic'), ('honkey'), ('horny'), ('humping'), ('incest'),
 ('jailbait'), ('jhant'), ('jhantu'), ('jigaboo'), ('jiggaboo'), ('jiggerboo'), ('jizz'),
 ('juggs'), ('kanjar'), ('kike'), ('kinbaku'), ('kinkster'), ('kinky'), ('knobbing'),
 ('kuttiya'), ('kys'), ('livesex'), ('loda'), ('lodu'), ('lolita'), ('lovemaking'), ('lund'),
 ('lundtopi'), ('lundure'), ('madarchod'), ('madhavchod'), ('masturbate'), ('masturbating'),
 ('masturbation'), ('milf'), ('motherfucker'), ('muffdiving'), ('mutth'), ('mutthal'),
 ('nambla'), ('nawashi'), ('negro'), ('neonazi'), ('nigga'), ('nigger'), ('nimphomania'),
 ('nsfw'), ('nude'), ('nudity'), ('nutten'), ('nympho'), ('nymphomania'), ('octopussy'),
 ('omorashi'), ('orgasm'), ('orgy'), ('paedophile'), ('paki'), ('panties'), ('panty'),
 ('pedobear'), ('pedophile'), ('pegging'), ('penis'), ('pikey'), ('pissing'), ('pisspig'),
 ('playboy'), ('ponyplay'), ('poof'), ('poon'), ('poontang'), ('poopchute'), ('porn'),
 ('porno'), ('pornography'), ('pthc'), ('pubes'), ('punany'), ('pussy'), ('queaf'), ('queef'),
 ('quim'), ('raand'), ('raghead'), ('randaap'), ('randi'), ('rape'), ('raping'), ('rapist'),
 ('rectum'), ('rimjob'), ('rimming'), ('sadism'), ('santorum'), ('schlong'), ('semen'),
 ('sexcam'), ('sexo'), ('sexy'), ('shemale'), ('shibari'), ('shit'), ('shitblimp'), ('shitty'),
 ('shota'), ('slanteye'), ('slut'), ('smut'), ('sodomize'), ('sodomy'), ('spastic'), ('spic'),
 ('splooge'), ('spooge'), ('strapon'), ('strappado'), ('swastika'), ('swinger'), ('tatte'),
 ('tharak'), ('tharki'), ('threesome'), ('throating'), ('thumbzilla'), ('tits'), ('titties'),
 ('titty'), ('tosser'), ('towelhead'), ('tranny'), ('tribadism'), ('tubgirl'), ('tushy'),
 ('twat'), ('upskirt'), ('urophilia'), ('vagina'), ('viagra'), ('vibrator'), ('vorarephilia'),
 ('voyeur'), ('voyeurweb'), ('voyuer'), ('vulva'), ('wank'), ('wanker'), ('wetback'),
 ('whore'), ('worldsex'), ('xxx'), ('yaoi'), ('yiffy'), ('zoophilia')
ON CONFLICT (term) DO NOTHING;

-- ── 3. Filter the remaining text fields ─────────────────────────────────────
-- Clears any named text column that holds a blocked word (for inserts that must
-- not fail: run uploads, posts written by sync, the profile made at sign-up).
-- SECURITY DEFINER like reject_blocked_text: contains_blocked_term (and the word
-- list) is not executable by runners, and these run inside their inserts.
CREATE OR REPLACE FUNCTION public.clear_blocked_text() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  col text;
BEGIN
  FOREACH col IN ARRAY TG_ARGV LOOP
    IF public.contains_blocked_term(to_jsonb(NEW) ->> col) THEN
      NEW := jsonb_populate_record(NEW, jsonb_build_object(col, NULL));
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

-- A username can't be cleared (NOT NULL, unique): swap in a neutral one.
CREATE OR REPLACE FUNCTION public.replace_blocked_username() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF public.contains_blocked_term(NEW.username) THEN
    NEW.username := 'runner_' || substr(md5(NEW.id::text), 1, 8);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_blocked_text() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.replace_blocked_username() FROM PUBLIC, anon, authenticated;

-- Posts
CREATE TRIGGER trg_clear_posts BEFORE INSERT ON public.feed_posts
  FOR EACH ROW EXECUTE FUNCTION public.clear_blocked_text('title', 'content');
CREATE TRIGGER trg_filter_posts BEFORE UPDATE OF title, content ON public.feed_posts
  FOR EACH ROW WHEN ((new.title IS DISTINCT FROM old.title) OR (new.content IS DISTINCT FROM old.content))
  EXECUTE FUNCTION public.reject_blocked_text('title', 'content');

-- Runs (title and description show on the feed post)
CREATE TRIGGER trg_clear_runs BEFORE INSERT ON public.runs
  FOR EACH ROW EXECUTE FUNCTION public.clear_blocked_text('title', 'description');
CREATE TRIGGER trg_filter_runs BEFORE UPDATE OF title, description ON public.runs
  FOR EACH ROW WHEN ((new.title IS DISTINCT FROM old.title) OR (new.description IS DISTINCT FROM old.description))
  EXECUTE FUNCTION public.reject_blocked_text('title', 'description');

-- Usernames: a new profile gets a neutral name; a rename is refused.
CREATE TRIGGER trg_clear_profile_username BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.replace_blocked_username();
DROP TRIGGER trg_filter_profiles ON public.profiles;
CREATE TRIGGER trg_filter_profiles BEFORE UPDATE OF bio, display_name, username ON public.profiles
  FOR EACH ROW WHEN ((new.bio IS DISTINCT FROM old.bio) OR (new.display_name IS DISTINCT FROM old.display_name) OR (new.username IS DISTINCT FROM old.username))
  EXECUTE FUNCTION public.reject_blocked_text('bio', 'display_name', 'username');

-- ── 4. Deleting a club owner ────────────────────────────────────────────────
-- prevent_orphaned_club refused to drop the last owner, so deleting the account
-- of anyone who owned a club failed. delete-account now calls this first: the
-- club passes to its longest-standing admin (else member); a club with nobody
-- else in it is deleted.
CREATE OR REPLACE FUNCTION public.release_owned_clubs(p_user uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  c record;
  v_heir uuid;
BEGIN
  FOR c IN SELECT id FROM public.clubs WHERE owner_id = p_user LOOP
    SELECT user_id INTO v_heir
      FROM public.club_members
     WHERE club_id = c.id AND user_id <> p_user
     ORDER BY (role = 'admin') DESC, joined_at ASC
     LIMIT 1;
    IF v_heir IS NULL THEN
      DELETE FROM public.clubs WHERE id = c.id;
    ELSE
      UPDATE public.club_members SET role = 'owner' WHERE club_id = c.id AND user_id = v_heir;
      UPDATE public.clubs SET owner_id = v_heir WHERE id = c.id;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.release_owned_clubs(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_owned_clubs(uuid) TO service_role;

-- ── 5. Push delivery settings from Vault ────────────────────────────────────
-- The push trigger read app.edge_function_url / app.service_role_key, which a
-- hosted Supabase project often won't let you set (ALTER DATABASE ... SET is
-- refused). It now reads Vault secrets of the same names first, falling back to
-- the old settings. Set them once in the SQL editor:
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1', 'edge_function_url');
--   select vault.create_secret('<service_role key>', 'service_role_key');
CREATE OR REPLACE FUNCTION public.notify_push_on_notification() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  edge_url text;
  svc_key  text;
BEGIN
  IF NEW.silent THEN RETURN NEW; END IF;
  BEGIN
    SELECT decrypted_secret INTO edge_url FROM vault.decrypted_secrets WHERE name = 'edge_function_url' LIMIT 1;
    SELECT decrypted_secret INTO svc_key  FROM vault.decrypted_secrets WHERE name = 'service_role_key'  LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    edge_url := NULL; svc_key := NULL;   -- no Vault: use the settings below
  END;
  edge_url := COALESCE(NULLIF(edge_url, ''), current_setting('app.edge_function_url', true));
  svc_key  := COALESCE(NULLIF(svc_key, ''),  current_setting('app.service_role_key', true));
  IF edge_url IS NULL OR edge_url = '' OR svc_key IS NULL OR svc_key = '' THEN RETURN NEW; END IF;

  PERFORM net.http_post(
    url     := rtrim(edge_url, '/') || '/send-push-notification',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || svc_key
               ),
    body    := jsonb_build_object(
                 'user_id',    NEW.user_id,
                 'title',      NEW.title,
                 'body',       COALESCE(NEW.body, ''),
                 'action_url', COALESCE(NEW.action_url, '/'),
                 'type',       NEW.type
               )::text
  );
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.notify_push_on_notification() FROM PUBLIC, anon, authenticated;
