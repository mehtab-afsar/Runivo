# Backend security audit, 24 Nov 2026

Scope: Supabase migrations (21 files), RLS, the 12 edge functions, env/secret hygiene, the web admin API. Read-only against live infrastructure: nothing was deployed, pushed or changed remotely. Everything below is from the working tree; live grants and live keys still need the dashboard checks at the end.

## 1. Keys and git history

| Item | Finding |
|---|---|
| Leaked key | `supabase/seed.ts` in commit `618bea7` (2026-03-11) holds a `service_role` JWT for project ref `mlmrqtbaerdhlvrhtnry`. It is in 11 commits, 2026-03-11 to 2026-03-17 (the file was deleted in `3e3182b`, 2026-03-23). It is still in history and in `origin` (github.com, visibility not checked). |
| Claims of the leaked key | HS256, role `service_role`, **iat 2026-03-09T13:10:55Z**, exp 2036-03-09. |
| Anon key in `eas.json` (development, preview, production) and in `apps/mobile/.env` | HS256, role `anon`, **iat 2026-03-09T13:10:55Z**, exp 2036-03-09. |
| Verdict | **The anon key was not re-issued after the leak.** It was minted in the same second as the leaked service-role key, which is how Supabase mints both keys from one JWT secret. The JWT secret has not been rotated since 2026-03-09, so the leaked service-role key is almost certainly still valid: it bypasses RLS and every grant. Rotate before launch (checklist, step 1). |
| Other secrets in the tree | None found: no `sk_`, `whsec_`, private keys, AWS or GitHub tokens in tracked files or any commit (only placeholders in `.env.example`). `apps/mobile/.env` is git-ignored and holds only the URL and the anon key. `apps/mobile/certs/certificate.pem` is a public certificate (no private key). |
| Client bundles | Only public values are in `EXPO_PUBLIC_*` / `NEXT_PUBLIC_*`: Supabase URL and anon key, Sentry DSN, PostHog and RevenueCat public keys, plus `EXPO_PUBLIC_ORS_KEY` and `EXPO_PUBLIC_MAP_TILE_KEY`. Those two are extractable from the app, so restrict them at the provider (bundle id, quota). |
| Service role in client code | None in `apps/mobile` or `packages/shared`. In `apps/web` it is only in `lib/adminServer.ts`, imported by `app/api/admin/*` and `app/api/partners/apply` route handlers (server only). Admin routes check `subscription_tier = 'admin'`, a column clients cannot write (`protect_profile_columns`). Mobile and web call only `ai-coach`, `delete-account`, `export-workout`, `process-run-territory`, `redeem-reward`, `foot-scan` and `safety-share`. Nothing calls `send-push-notification`, `weekly-digest` or the webhooks. |

## 2. Edge function matrix

All 12 are `verify_jwt = false` in `supabase/config.toml`. `device-oauth` was the only one missing from the file (it kept the gateway default); it is now listed.

| Function | Auth mechanism | Input validation | Rate limit / abuse guard | CORS | Status / risks |
|---|---|---|---|---|---|
| `ai-coach` | `auth.getUser(token)` → 401; `user.id` from the JWT, body never carries a user id. Plus tier (402) and `ai_consent_at` (403) checked server-side | feature allowlist, `message` ≤ 4000, `goal` ≤ 500, `runId` ≤ 64, food image ≤ 7 MB base64 and MIME allowlist (**added**, now in `ai-coach/lib/requestValidation.ts`) | `ai_reserve_spend` takes a per-user advisory lock and reserves spend before the model call (daily $0.60, chat $0.45); fails closed with 503 | `*` (bearer auth, no cookies) | OK after fix. Internal error text is no longer returned. While `subscriptions_enabled = false`, everyone counts as Plus, so AI spend is open to all runners up to the daily cap |
| `foot-scan` | `getUser` → 401; consent 403 | MIME allowlist, 7 MB cap, JSON parse → 400 (**added**) | Was read-then-check on `ai_usage_log`, so parallel requests all passed; now `ai_reserve_spend` (**fixed**). Not Plus-gated; capped at $0.12 combined | `*` | OK after fix. Provider and SDK error text no longer returned |
| `process-run-territory` | `getUser` → 401, then `body.userId !== user.id` → 403; run must belong to the caller and match the stored row. Internal watch path: service-role bearer plus `x-runivo-internal` | coordinate, accuracy and activity checks, `MAX_GPS_POINTS` → 413, invalid JSON → 400 (**added**) | `run_processing` claim makes replays idempotent; needs an existing run row | `*` | Service-key compare is now constant-time (**fixed**). The internal path trusts `body.userId`, so the service-role key must stay secret (rotation) |
| `redeem-reward` | `getUser` → 401; calls the service-role-only `redeem_reward` RPC with `user.id` | `rewardId` must be a UUID (**added**); lat/lng finite numbers | All rules and stock live in the atomic RPC (one per runner, balance, code pool, review hold) | `*` | OK |
| `delete-account` | `getUser` → 401; deletes `user.id` only | only `appleAuthorizationCode` is read | Irreversible but needs a live session | `*` | OK. A stolen session token can delete the account (accepted) |
| `device-oauth` | `getUser` → 401. CSRF `state` held server-side for Coros and Polar; Garmin OAuth1 token secret | provider allowlist; `state`, `code`, verifier required | none (each authorize call hits Garmin's request-token endpoint) | `*` | Upstream error bodies are no longer echoed (**fixed**). Added to `config.toml` (**fixed**) |
| `export-workout` | `getUser` → 401; the session must be in the caller's own active plan; Garmin tokens read server-side | `sessionId` looked up in the caller's plan | none (2 Garmin calls per request; Garmin rate-limits) | none (no OPTIONS handler; fine for the native app) | Garmin response body no longer returned (**fixed**) |
| `device-webhook` | Garmin: HMAC-SHA1 of the raw body in `x-garmin-signature`, constant-time, **503 when the secret is unset, 401 on mismatch**. Coros and Polar: 501 (no scheme, rejected) | provider allowlist, plausibility checks (`plausible()`), owner resolved by token or provider id, unmatched activities dropped | none; body size is gateway-limited | `*` (not needed for server-to-server) | OK. Confirm Garmin really sends that header, otherwise every genuine push gets 401 (fails safe) |
| `rc-webhook` | `Authorization: Bearer <RC_WEBHOOK_SECRET>`; 500 if unset, 401 on mismatch | event parsed by `rcTier`; stale-event guard; admins never changed; `null` body guard (**added**) | idempotent by event timestamp | none | Compare is now digest-based constant-time (the old loop leaked the secret length) (**fixed**) |
| `safety-share` | none by design; token-gated | token must match `^[0-9a-f]{40,80}$` | none needed: tokens are 244 random bits (two `gen_random_uuid()`), 12 h expiry | `*` on the JSON only | See section 2.1 |
| `send-push-notification` | service-role bearer only, 401 otherwise | `user_id` must be a UUID, title ≤ 120, body ≤ 500, `action_url` ≤ 300, type ≤ 60 (**added**); per-category opt-outs respected | server-to-server | none | Compare was `!==` on the header; now constant-time (**fixed**) |
| `weekly-digest` | service-role bearer only | no user input | scheduler only | none | Compare is now constant-time, POST only, 401 instead of 403 (**fixed**) |

### 2.1 safety-share

Token: server-generated, 244 random bits. The row expires after 12 h (`expires_at`); location is returned only while live or within 30 min of the end, otherwise null. `view_safety_share` returns only username, sport, status, lat, lng, position time, distance, elapsed time and start/end times: no email, phone, user id, avatar or profile fields. Responses carry `no-store`, `noindex` and `no-referrer`. The page escapes the username and inlines JSON with `<` escaped. Residual: the page loads Leaflet from `unpkg.com` with no Subresource Integrity hash on a page that shows live location; self-host it or add the hash.

## 3. Database

Method: the 21 migrations were replayed statement by statement (create/drop table and policy, grants, revokes, function definitions; last definition wins). Live ACLs were not read. The Postgres here has no PostGIS and Docker is not running, so `supabase/tests/run.sh` could not run; see section 5.

| Check | Result |
|---|---|
| Tables in `public` | 80 live (83 created, 3 dropped: `stories`, `run_photos`, `run_territories`) |
| RLS enabled | **All of them.** 0 missing. 17 tables have RLS and no client policy on purpose (service-role only): `blocked_terms`, `content_reports`, `user_bans`, `user_reports`, `partners`, `reward_events`, `run_processing`, `zone_events`, `notification_campaigns`, `pace_discrepancy_log`, and others |
| `USING (true)` on INSERT/UPDATE/DELETE | **None.** Every write policy is tied to `auth.uid()`, a role check or an ownership helper |
| `USING (true)` on SELECT | `app_settings` (holds only `subscriptions_enabled`), `clubs`, `club_members`, `events`, `lobbies`, `kudos`, `feed_post_likes`, `promotions`, `store_cities`, `event_finishers`, `personal_records` (**tightened**) |
| SECURITY DEFINER functions | 211. All have a pinned `search_path` (23 older ones through `ALTER FUNCTION` in `…000014`; none redefined afterwards). `scripts/lint-migrations.mjs` passes |
| PACE and territory cannot be self-awarded | Only `claim_mission_reward` credits PACE from a client call. It uses `auth.uid()`, a server reward table and a ledger key per day. `credit_pace_capped`, `apply_pace_adjustment`, `grant_award`, `redeem_reward`, `increment_run_stats` and the territory writers are server-only. `protect_profile_columns` resets tier, PACE, rank, streak, level, xp and counters on any client UPDATE. `device_connections.secrets` has no client column grant |
| Sensitive tables | `profiles`, `runs`, `nutrition_logs`, `notifications`, `club_messages` (members only), `device_connections`, `safety_shares`, `live_run_positions` (mutual follows, live only), `pace_redemptions`, `ai_*`, `coach_messages`: owner-scoped. `territory_polygons` honours `hide_zones_from_map` and privacy places. Subscriptions are `profiles.subscription_*` columns, not a table. `player` and `pending_actions` do not exist in this schema |

### Findings fixed in `20261124000001_backend_hardening.sql`

1. **High: anyone could read a runner's block and mute lists.** `hidden_user_ids(uuid)` and `leaderboard_circle(uuid, text)` are SECURITY DEFINER, take any runner's id, and were granted to `anon` (and not to `authenticated`). An anonymous call returned who a runner blocked, was blocked by, or muted. Now service-role only.
2. **High: home-location oracle.** `public_route_for(user, points, hidden)` drops the points near that user's privacy places and was executable by anyone. Probing it with test points locates a runner's home. The `blur_feed_post_route` trigger was its only caller (it ran as the runner), so the trigger is now SECURITY DEFINER and clients lose access.
3. **Medium (functional): `event_participants` read policy.** It called `hidden_user_ids`, which signed-in runners cannot execute, so reads would fail with "permission denied for function". Reproduced on a throwaway Postgres 18. It now uses `is_hidden_from_me()`, bound to the caller. Untested before: no suite queries it as `authenticated`.
4. **Medium: `personal_records`** were readable by anyone, including anonymous callers and private profiles. Now the same rule as `user_awards`.
5. **Low: `sync_energy(uuid)`** let anyone reset any runner's energy regeneration clock. No client calls it. Revoked.
6. **Low: `is_blocked_between`** no longer callable anonymously.
7. **Hygiene:** `anon` loses INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER/REFERENCES on every public table, and `authenticated` loses TRUNCATE/TRIGGER/REFERENCES (TRUNCATE ignores RLS), including for future tables.

### Open (not changed, needs your decision or a running test suite)

- `is_blocked_between(a, b)`, `can_view_post` and `can_view_profile` can still be called by any signed-in runner with arbitrary ids, so a runner can test whether two other runners have a block between them. Binding them to `auth.uid()` also affects trigger paths that run as another user, which cannot be verified without the SQL suite (needs PostGIS).
- `club_members`, `kudos`, `feed_post_likes` and `lobbies` are readable by anonymous callers. This shows who is in a club and who liked what, regardless of profile privacy. Consider `TO authenticated` plus a profile-visibility filter.
- `profiles` has an INSERT policy (`auth.uid() = id`) and the protective trigger is BEFORE UPDATE only. The sign-up trigger creates the row first, so the INSERT path is unreachable; confirm with the dashboard query in step 6.
- `partners/apply` rate limit is in memory per serverless instance.
- Runs and GPS traces are written by the client; only consistency checks and the server-verified distance stand behind scoring (known, H4 of the November audit).

## 4. Code changes

- `supabase/functions/_shared/auth.ts` (new): `safeEqual` (SHA-256 digest + `timingSafeEqual`), `hasBearer`, `isServiceRoleRequest`, `isUuid`.
- Edited: `send-push-notification`, `weekly-digest`, `rc-webhook`, `process-run-territory`, `redeem-reward`, `foot-scan`, `device-oauth`, `export-workout`, `config.toml`; `ai-coach` validation and error hardening (now carried in `ai-coach/lib/` by the parallel refactor).
- New migration `supabase/migrations/20261124000001_backend_hardening.sql` and test `supabase/tests/backend_hardening.test.sql`.

## 5. Verification run

- `npm test`: 86 files, 735 tests pass.
- `node scripts/lint-migrations.mjs`: 22 files OK.
- Migration and new SQL test were run against a throwaway Postgres 18 with the affected objects stubbed (roles, default privileges, the squashed grant state): migration applies, all 16 checks pass, an authenticated insert into `feed_posts` still fires the route trigger.
- Not run: the 58 SQL tests (`supabase/tests/run.sh`, no PostGIS/Docker here) and Deno type-checks/tests (no `deno`). Edited functions were syntax-checked only (`node --check`). Run `npm run test:sql` and the Deno tests in CI before deploying.

## 6. Checklist for you (nothing here was done for you)

**A. Supabase Dashboard**

1. Project Settings → API → JWT Settings → **Generate a new JWT secret** (or migrate to the new publishable/secret API keys and disable the legacy ones). This invalidates the leaked service-role key and every anon and service key at once, and signs everyone out. Do it first. Do it before the build below so the new anon key goes into it.
2. Copy the new `anon` key. Update `apps/mobile/eas.json` (3 places) and `apps/mobile/.env`, and Vercel's `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Copy the new `service_role` key into Vercel's `SUPABASE_SERVICE_ROLE_KEY` and into **every place the database keeps it**, or push notifications and the digest stop working with a 401: (a) Vault secret `service_role_key` (read by `notify_push_on_notification`; check with `select name from vault.secrets;`, update with `select vault.update_secret((select id from vault.secrets where name = 'service_role_key'), '<new key>');`); (b) the `app.service_role_key` database setting if you use it instead (`run_hourly_notifications` reads it; re-run `alter database postgres set app.service_role_key = '<new key>';`); (c) the Authorization header of the weekly-digest scheduled job (`select jobid, command from cron.job;`). Edge functions get `SUPABASE_SERVICE_ROLE_KEY` automatically.
3. Verify the old key is dead: `curl -s -o /dev/null -w '%{http_code}\n' "https://<ref>.supabase.co/rest/v1/profiles?select=id&limit=1" -H "apikey: <OLD service_role>" -H "Authorization: Bearer <OLD service_role>"` should be 401.
4. Database → run `supabase/tests/audit_function_privileges.sql` in the SQL editor before and after the migration. After: `hidden_user_ids`, `leaderboard_circle`, `public_route_for` and `sync_energy` must not list `anon` or `authenticated`.
5. After `supabase db push`, as a signed-in test user check that `select count(*) from event_participants;` no longer errors, and that posting a run to the feed still saves a blurred route.
6. `select count(*) from auth.users u left join public.profiles p on p.id = u.id where p.id is null;` should be 0.
7. Authentication → Providers: Apple and Google secrets set; Email: confirm email on, minimum password length ≥ 8 (local `config.toml` says 6); Rate limits: sign-in 30 / 5 min is fine.
8. Edge Functions → Secrets: confirm each is set and none is empty: `ANTHROPIC_API_KEY`, `RC_WEBHOOK_SECRET`, `GARMIN_WEBHOOK_SECRET`, `GARMIN_CONSUMER_KEY/SECRET`, `COROS_*`, `POLAR_*`, `RESEND_API_KEY`, `DIGEST_FROM`, `VAPID_*`, `APPLE_*` (token revocation on delete), `POSTHOG_*`, `APP_URL`. Rotate any of them that were ever pasted into chat, tickets or a CI log.
9. Deploy order: `supabase db push`, then `supabase functions deploy` (all 12; `config.toml` now carries `device-oauth`).
10. Dashboard → Edge Functions → each function → confirm "Enforce JWT verification" is **off** for all 12 (the CLI applies `config.toml` on deploy; confirm).
11. Storage → each bucket (`avatars`, `feed`, `stories`, `user-media`, `club-media`): try listing the bucket anonymously (`curl -H "apikey: <anon>" -X POST "https://<ref>.supabase.co/storage/v1/object/list/feed" -d '{"prefix":""}'` should return nothing). Photos on private activities were still readable by URL in the November audit; confirm that is accepted.
12. Database → Backups / PITR on; Network restrictions for direct DB access if you use them; Logs → API: search for `service_role` requests from unfamiliar IPs since 2026-03-11.

**B. Git**

13. Rotating the secret is what makes the leaked key harmless; rewriting history is optional. If you also want it gone from GitHub: `git filter-repo --path supabase/seed.ts --invert-paths` on a fresh clone, force-push, and tell collaborators to re-clone. Check the repo's visibility first (Settings → General). If it was ever public, assume the key was copied.

**C. Vercel**

14. Environment Variables (Production and Preview): replace `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; rotate Sentry auth token and PostHog keys if they were shared; redeploy. Confirm `NEXT_PUBLIC_SUPABASE_URL` is the production project.

**D. EAS**

15. `eas secret:list` (and project env vars): replace the anon key with the new one in `eas.json` or move it to EAS environment variables; set the real `EXPO_PUBLIC_RC_API_KEY_IOS/ANDROID`, `EXPO_PUBLIC_POSTHOG_API_KEY` (currently empty strings in `eas.json`), and restrict `EXPO_PUBLIC_ORS_KEY` and `EXPO_PUBLIC_MAP_TILE_KEY` at the provider.
16. Rebuild the production binary after rotation: an app built with the old anon key stops working the moment the secret changes.
17. Apple/RevenueCat: set the RevenueCat webhook Authorization header to exactly `Bearer <RC_WEBHOOK_SECRET>`; rotate that secret too if it was ever shared.
18. Decide `subscriptions_enabled` before submission: while it is `false`, every runner is Plus and can use the AI coach (bounded at $0.60 per runner per day).
