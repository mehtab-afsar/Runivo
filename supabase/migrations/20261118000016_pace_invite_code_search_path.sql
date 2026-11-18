-- PACE: invite codes ("Invite friends · get 50 PACE each") failed for everyone.
--
-- my_referral_code() calls gen_random_bytes(), which lives in the pgcrypto
-- extension. On Supabase that is installed in the `extensions` schema, but the
-- function's search_path was only 'public', so it raised "function
-- gen_random_bytes(integer) does not exist" and the app showed "Couldn't get
-- your invite code". Same path as every other SECURITY DEFINER function (0014).
SET check_function_bodies = false;
SET client_min_messages = warning;
SET search_path = public, extensions;

ALTER FUNCTION public.my_referral_code() SET search_path = public, extensions;
