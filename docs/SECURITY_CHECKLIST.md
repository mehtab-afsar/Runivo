# Runivo pre-release security & quality checklist

Run this before every store build. Each item names the command or file that proves it. Tick a box only after running the check, not after remembering it.

Last full audit: 2026-11 (findings and status in [AUDIT_2026-11.md](AUDIT_2026-11.md)).

## 1. Secrets and config

- [ ] No secret files are tracked: `git ls-files | grep -E '\.env$|\.p8$|\.p12$|\.key$|service[-_]account'` prints nothing (`.env.example` is fine).
- [ ] No server secret is exposed to the app bundle: `grep -rn "EXPO_PUBLIC_" apps/mobile --include=*.ts --include=*.tsx --include=*.json | grep -iE "secret|service_role|private"` prints nothing. The anon key, Sentry DSN, PostHog key and RevenueCat public keys are meant to be public.
- [ ] `apps/mobile/eas.json` has non-empty `EXPO_PUBLIC_RC_API_KEY_IOS/ANDROID` and `EXPO_PUBLIC_POSTHOG_API_KEY` for `preview` and `production` (or the Subscription route is hidden).
- [ ] `apps/mobile/certs/` holds only the public OTA certificate, never the private key.

## 2. Auth and session

- [ ] Sign-in links are PKCE-only: `grep -rn "token_hash" apps/mobile/src` shows only comments and tests.
- [ ] Sign-out wipes this phone: SQLite tables, GPS buffer, crash checkpoints, cached plan, and calls `Purchases.logOut()` (`settingsService.signOut`).
- [ ] Sign in as account A, run, sign out, sign in as account B: B sees none of A's runs, zones, PACE, weight log or "recover interrupted run" prompt.
- [ ] Deep links and notification taps route only through the allowlist (`notificationRoutes.ts`).
- [ ] Hosted Supabase Auth (dashboard, not in this repo): captcha on, email confirmation on, password minimum 8+, SMS rate limit set, manual identity linking enabled.

## 3. Database and RPC (run against the live project)

- [ ] Paste `supabase/tests/audit_function_privileges.sql` into the SQL editor. None of the server-only functions listed in migration `20261115000010` may appear in the result.
- [ ] Every `SECURITY DEFINER` function in the result either checks `auth.uid()` or reads only data the caller may see, and pins `search_path`.
- [ ] Any migration that creates or re-creates a privileged function ends with `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon, authenticated`. Postgres grants new functions to `PUBLIC` by default, and a schema-level default privilege cannot undo that.
- [ ] Any new server-only function ends its migration with `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon, authenticated` **and** is added to `supabase/tests/function_privileges.test.sql`.
- [ ] Every table has RLS enabled, and client-writable columns exclude anything economic (PACE, rank, territory, awards).
- [ ] Storage buckets: public only where the content is meant to be public. Anything tied to a post's visibility is private with signed URLs.

## 4. Integrity and anti-abuse

- [ ] Scoring happens server-side from data the server can check (`process-run-territory`): the request must agree with the stored run row, stay inside the run's time window, and stay under the point cap (`consistency.ts`).
- [ ] Runs flagged with mock location earn nothing and claim nothing.
- [ ] PACE credit is idempotent per run and capped in the database (`credit_pace_capped`, `pace_awards`, `run_processing`).
- [ ] Mission and leaderboard distance comes from server-verified runs, not raw client-written rows (open: audit H4).
- [ ] Speed ceilings agree across client, edge function and database triggers (open: audit M11).

## 5. Privacy

- [ ] Sentry scrubs coordinates and tokens (`sentryScrub.ts`); no PII in `console.*`, Sentry breadcrumbs or PostHog events.
- [ ] Analytics and health-data sharing are gated on user consent (open: audit M9).
- [ ] Account deletion removes rows, every storage object (recursively), the Apple token and provider links (Apple and Garmin revocation open: audit M6).
- [ ] Photos shared to the feed are re-encoded without EXIF (open: audit H5).

## 6. Native and permissions

- [ ] Every permission string and background capability in `app.config.ts` is justified in the store listing (background location, HealthKit background delivery, `RECEIVE_BOOT_COMPLETED`).
- [ ] ATS stays on: `NSAllowsArbitraryLoads` is `false`; `grep -rn "http://" apps/mobile/src` finds no endpoints.
- [ ] Only the launcher activity is exported on Android.

## 7. Reliability (run path)

- [ ] On a device: start a run with Location Services off and confirm Start recovers; kill the app mid-run and confirm recovery keeps screen-off points; switch to miles and confirm the Live Activity pace and speed use miles.
- [ ] Offline run: finish a run in airplane mode, reconnect, foreground the app: the run uploads without a new run or restart.
- [ ] `npm test` passes, including `useActiveRun`-adjacent and sync tests.
- [ ] No fire-and-forget Supabase call: `grep -rnE "^\s*(void\s+)?supabase\.(from|rpc)\(" apps/mobile/src packages/shared/src` shows only calls with `.then(` or inside `Promise.all`. The builder sends nothing until it is awaited or `.then` is called.

## 8. Hygiene

- [ ] `npm ci && npm run typecheck && npx tsc --noEmit -p packages/shared/tsconfig.json && npm run lint && npm test` passes on a **fresh clone** (this catches untracked files that tracked code imports).
- [ ] `git status` shows no untracked files under `apps/` or `supabase/` that you mean to ship.
- [ ] `npx knip` (or the import-graph script in the audit) reports no orphan files and no unused dependencies.
- [ ] CI runs the SQL tests in `supabase/tests/` against a local Supabase (open: not wired yet).
