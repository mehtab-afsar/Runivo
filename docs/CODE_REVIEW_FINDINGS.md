# Runivo — End-to-End Code Review Findings

**Date:** 2026-07-09
**Scope:** Full monorepo — mobile app (Expo RN), web app (Next.js), shared packages, Supabase backend (migrations, RLS, edge functions)
**Method:** Six parallel deep-read reviews: (1) Auth/Onboarding/Navigation, (2) Run Tracking, (3) Territory/Leaderboard/Dashboard, (4) Social/Engagement, (5) Shared Services + Backend, (6) Web/Build/Config

**Verdict: NOT launch-ready.** 9 critical, ~15 high, ~30 medium/low findings. Security perimeter is solid; the core game loop (run → territory → PACE → leaderboard) is broken at multiple points, and neither the web app nor the mobile build config can ship as-is.

---

## Legend

- [ ] = not fixed  /  [x] = fixed
- **File:line** references are to the state of the repo at commit `5049c32`

---

## CRITICAL

### C1. Background GPS points double-counted on every run
- [ ] **Fix**
- **File:** `apps/mobile/src/features/run/hooks/useActiveRun.ts:176-197, 390-404` + `apps/mobile/src/features/run/services/locationTask.ts:100-146`
- **Issue:** The background location task buffers GPS points regardless of app state (expo-location delivers to TaskManager in foreground too). Both the foreground-resume drain and the finish drain re-add buffered points to `totalDistanceRef` / `gpsPointsRef` with no timestamp/overlap filtering.
- **Impact:** Distance roughly doubles, pace halves, PACE tokens computed on inflated distance, territory polygon corrupted by out-of-order duplicate points. Affects essentially every run.
- **Fix direction:** Track a drain watermark (last drained timestamp); only drain rows newer than it; skip buffering while app is foregrounded, or dedupe by timestamp on drain.

### C2. Crash recovery is a no-op that deletes the checkpoint
- [ ] **Fix**
- **File:** `apps/mobile/src/features/run/screens/RunScreen.tsx:76`
- **Issue:** "Recover" only calls `postRunSync()` (which pushes already-saved runs) then deletes the checkpoint. The checkpoint's GPS points are never reconstructed into a saved run.
- **Impact:** Guaranteed data loss on the exact path designed to prevent it. The still-running background task is also never stopped.
- **Fix direction:** Rebuild the run from checkpoint GPS points → `saveRun()` → then sync → then delete checkpoint. Also stop/unregister the background task.

### C3. Sign-out never clears local data → cross-account corruption
- [ ] **Fix**
- **File:** `apps/mobile/src/features/settings/services/settingsService.ts:22-25`
- **Issue:** Mobile sign-out only calls `supabase.auth.signOut()` + `resetAnalytics()`. The shared `signOut()` in `packages/shared/src/services/auth.ts` that clears local data has zero mobile callers.
- **Impact:** User B on the same device sees user A's runs/territories/stats, and `initialSync()` **uploads A's unsynced runs and territories into B's account** — permanent cross-account data corruption.
- **Fix direction:** On sign-out: clear all local stores (runs, territories, player, settings-scoped data), unregister push token, then `supabase.auth.signOut()`. Handle the offline sign-out error case.

### C4. Server corridor geometry uses a non-perpendicular offset
- [ ] **Fix**
- **File:** `supabase/functions/process-run-territory/index.ts:66`
- **Issue:** `px = -dlng/len, py = dlat/len` is not perpendicular to tangent `(dlng, dlat)`. Correct (already fixed client-side in `claimEngine.ts:164-165`) is `px = -dlat, py = dlng`.
- **Impact:** North-south / east-west runs produce zero-width degenerate corridors; the WKT fed to `find_intersecting_territories` / `steal_territory_portion` / `claim_unclaimed_area` is garbage; server-side claim/steal/defend silently fails for most runs (errors swallowed as `data: null`).
- **Fix direction:** Apply the identical one-line perpendicular fix that was applied to the client. Redeploy the edge function.

### C5. Weekly PACE cap is actually a lifetime cap
- [ ] **Fix**
- **File:** `supabase/functions/process-run-territory/index.ts:164,257` + `supabase/migrations/20260515000059_territory_engine_rpcs.sql:255-266` + `packages/shared/src/services/sync.ts:207`
- **Issue:** `profiles.pace_weekly_earned` is only ever incremented. No cron/RPC ever resets it; the column-protection trigger blocks client writes; the client's local reset is overwritten by `pullProfile()`.
- **Impact:** Once a free user accumulates 100 PACE lifetime, they earn 0 PACE forever. Core economy dead within the first week.
- **Fix direction:** Add a `pg_cron` job (or reset-on-read logic keyed off `week_start` column) that zeroes `pace_weekly_earned` weekly.

### C6. `profiles.territory_score` is never written — leaderboard default tab all zeros
- [ ] **Fix**
- **File:** `supabase/migrations/20260515000060_leaderboard_pace_ts.sql:28` + `20260701000075_profiles_column_protection.sql:24-26`
- **Issue:** `leaderboard_weekly` ranks by `p.territory_score`, but nothing populates it (migration comment admits "NOTHING writes this column") and the protection trigger blocks client writes. `get_territory_score()` is read-only and never persisted.
- **Impact:** Everyone rank 1 with 0 TS on the default leaderboard tab, while the dashboard shows a non-zero locally computed score — visible contradiction.
- **Fix direction:** Persist `get_territory_score()` into the column via trigger on `territory_polygons` changes or a scheduled job (SECURITY DEFINER).

### C7. Every run claims its territory twice (client push + server insert)
- [ ] **Fix**
- **File:** `packages/shared/src/services/sync.ts:443-472` (pushPolygonTerritories) vs `:298` (edge function invoke)
- **Issue:** `postRunSync` invokes `process-run-territory` (server inserts polygon, fresh UUID), then step 7 pushes the client-built polygon for the same corridor under a different UUID. Nothing dedupes by `run_id`.
- **Impact:** Owned area, territory score, city rank ~doubled per run; rivals get 2× steal PACE; map renders stacked duplicates.
- **Fix direction:** Make the server the single claim path. Remove the client polygon push (or gate it to offline-only with run_id dedupe server-side).

### C8. Lobby/club chat is 100% dead (schema mismatch)
- [ ] **Fix** *(feature-flagged OFF — fix before enabling CHAT/CLUBS flags)*
- **File:** `apps/mobile/src/features/clubs/services/lobbyChatService.ts:19-116` vs `supabase/migrations/20260301000006_notifications.sql:30-36`
- **Issue:** Client queries `lobby_messages.room_id` (text) and inserts a `username` column; schema defines `lobby_id uuid` — no `room_id`, no `username` exist in any migration.
- **Impact:** Every fetch errors, every send silently fails (message text lost), realtime filter can never match. Chat dead in LobbyChatScreen and ClubDetail chat tab.
- **Fix direction:** Align client to `lobby_id` and join usernames from profiles, or migrate the schema to match the client — pick one source of truth.

### C9. Profile followers/following queries a nonexistent table
- [ ] **Fix**
- **File:** `apps/mobile/src/features/profile/services/profileService.ts:62-63`, `FollowersScreen.tsx:24-86`, `FollowingScreen.tsx:24-73`
- **Issue:** Queries a `follows` table; the real table is `public.followers` (used correctly by feedService and `get_feed`).
- **Impact:** Profile always shows 0 followers/0 following; both list screens always empty; follow buttons there silent no-ops.
- **Fix direction:** Rename all `from('follows')` → `from('followers')` and align column names.

---

## HIGH

### Build & Deployment

#### H1. Web production build fails outright
- [ ] **Fix**
- **File:** `apps/web/next.config.mjs:1` + root `package.json` workspaces
- **Issue:** `npm run build` fails with `Cannot find module 'next/constants'` — `@sentry/nextjs@10` hoisted to root while `next@14.2.20` nested (react@19 peer conflict blocked hoisting).
- **Impact:** Any Vercel deploy from clean install fails. Web app cannot ship.

#### H2. vercel.json is leftover Vite SPA config
- [ ] **Fix**
- **File:** `vercel.json:1-6`
- **Issue:** `outputDirectory: "apps/web/dist"` + catch-all rewrite to `/index.html` — Next outputs `.next/`, there is no `index.html`.
- **Impact:** Second independent deploy blocker even after H1.

#### H3. Two competing Expo app identities
- [ ] **Fix**
- **File:** root `app.json` (stray) vs `apps/mobile/app.config.ts:152` + `apps/mobile/app.json:51`; two divergent `eas.json` files
- **Issue:** Root app.json has the real EAS projectId (`024aa932-…`) + bundle ID `com.mehtabafsar.runivo` but **no permission strings/plugins**. Canonical app.config.ts has all permissions but placeholder projectId and different bundle ID (`com.runivo.app`).
- **Impact:** EAS build from apps/mobile fails projectId validation; build from root ships with zero usage descriptions → crash on first permission request + App Store rejection. Which app ships is indeterminate.
- **Fix direction:** Consolidate: move real projectId/bundleId into `apps/mobile/app.config.ts`, delete root `app.json` and root `eas.json`, add `ITSAppUsesNonExemptEncryption` to app.config.ts.

#### H4. expo-updates points at hardcoded placeholder URL
- [ ] **Fix**
- **File:** `apps/mobile/app.config.ts:155-160`
- **Issue:** `updates.url = 'https://u.expo.dev/REPLACE_WITH_EAS_PROJECT_ID'` baked in as a literal, `enabled: true`.
- **Impact:** Production binaries ping a nonexistent update endpoint every launch; OTA permanently broken.

#### H5. Production builds may ship placeholder Supabase creds + no Sentry
- [ ] **Verify/Fix**
- **File:** `apps/mobile/eas.json` (production profile, no `env`) + `packages/shared/src/services/supabase.native.ts:14-15` + `src/shared/services/sentry.ts:12-15`
- **Issue:** `EXPO_PUBLIC_SUPABASE_URL/ANON_KEY` and `EXPO_PUBLIC_SENTRY_DSN` come only from gitignored `.env.local`; not uploaded to EAS.
- **Impact:** Unless EAS project env vars are configured (not verifiable from repo), the store binary points at `https://placeholder.supabase.co` and crash reporting is silently off.
- **Action:** Set EAS environment variables for the production profile before building.

### Run Tracking

#### H6. PACE double-credited on every synced run
- [ ] **Fix**
- **File:** `packages/shared/src/services/sync.ts:306-325` + `packages/shared/src/hooks/useGameEngine.ts:240-255`
- **Issue:** Reconciliation reads `run.xpEarned` as "already credited" but `endRunSession` never writes it — always undefined → `clientCredited = 0` → full server total applied on top of optimistic credit; `pushProfile()` persists the doubled balance. Also fires the server's anti-cheat discrepancy log every run.
- **Fix direction:** Write `paceResult.paceEarned` onto the stored run as `xpEarned` (or a dedicated `paceEarned` field) at save time.

#### H7. Run history detail shows zeroed summary ("claim Failed")
- [ ] **Fix**
- **File:** `apps/mobile/src/features/run/hooks/useRunSummary.ts:64-68` (from `HistoryScreen.tsx:68`)
- **Issue:** Navigation passes only `{ runId }`; hook falls back to `EMPTY_RUN` instead of calling the existing `fetchRunById` in `runSummaryService.ts`.
- **Impact:** Every historical run shows 0.00 km / 00:00 / "claim Failed" + warning haptic. Also breaks the `run/summary/:runId` deep link.

#### H8. Splits are fabricated (identical pace every km)
- [ ] **Fix**
- **File:** `apps/mobile/src/features/run/services/runSummaryService.ts:46-76` + `services/runNavigationHelper.ts:22`
- **Issue:** GPS timestamps stripped before summary; `computeSplits` interpolates time proportional to distance → every split = overall average pace.
- **Fix direction:** Pass real per-point timestamps through `buildRunSummaryParams`.

#### H9. Stale background task survives crashes and misattributes points
- [ ] **Fix**
- **File:** `apps/mobile/src/features/run/services/locationTask.ts:113-131, 184`
- **Issue:** Run-id resolution prefers newest existing `bg_gps_buffer` row (self-perpetuating stale id); `killServiceOnDestroy: false`; nothing on launch stops a still-registered task.
- **Impact:** Battery drain + persistent iOS blue bar after crash; every subsequent run's background points misattributed and never drained.

### Territory & Leaderboard

#### H10. Rival territories never render — inverted viewport bbox
- [ ] **Fix**
- **File:** `apps/mobile/src/features/territory/screens/TerritoryMapScreen.tsx:100-107`
- **Issue:** MapLibre `visibleBounds` is `[northEast, southWest]`; code maps `bounds[0]→min, bounds[1]→max` → `minLat > maxLat` → filter never true.
- **Impact:** Rivals layer permanently empty; "Rivals" filter shows nothing.

#### H11. Freshness decay never applied server-side — capture mechanic dead
- [ ] **Fix**
- **File:** `supabase/migrations/20260515000059_territory_engine_rpcs.sql:74-84` + `process-run-territory/index.ts:214-215`
- **Issue:** Server reads raw stored `freshness` (default 100, never decayed — decay is display-only client-side) → `isFresh` always true → steals require >30% overlap by a 24 m corridor.
- **Impact:** Months-abandoned territory practically unstealable; advertised decay/capture loop never happens.

#### H12. Deleted/stolen territories never leave the loser's device
- [ ] **Fix**
- **File:** `packages/shared/src/services/sync.ts:479-512`
- **Issue:** `pullTerritories` only upserts; server-deleted rows never removed locally.
- **Impact:** Fully captured players still see their zone forever; multi-device users diverge permanently.

#### H13. Client can forge arbitrary territory polygons
- [ ] **Fix**
- **File:** `supabase/migrations/20260515000056_territory_polygon_and_pace.sql:28`
- **Issue:** RLS `tp_owner FOR ALL USING (owner_id = auth.uid())` permits direct INSERT with client-supplied `area_m2`/`tier`/`freshness`/`polygon_coords`; no server validation.
- **Impact:** One curl with the anon key claims a 10⁹ m² unstealable "domain" dominating all rankings.
- **Fix direction:** Tie into C7 — remove client INSERT permission once the server is the sole claim path.

#### H14. Weekly Distance/PACE leaderboard ranks an arbitrary 50-user subset
- [ ] **Fix**
- **File:** `apps/mobile/src/features/leaderboard/services/leaderboardService.ts:12-16, 33-34`
- **Issue:** Query orders by broken territory rank (all ties per C6), limits 50, then client re-sorts by selected metric.
- **Impact:** With >50 users, Distance/PACE tabs show 50 effectively random users; actual top runners absent.

#### H15. Loop-fill cap tests corridor area, not hull area
- [ ] **Fix**
- **File:** `packages/shared/src/services/claimEngine.ts:205-215, 288`
- **Issue:** `shouldLoopFill` compares corridor area to `LOOP_MAX_AREA_M2` (500k m²) but claims the convex hull of the whole run (unbounded — ~20 km loop hull ≈ 3×10⁷ m²).
- **Impact:** Single loop claims 60× intended max; concave routes over-claim everything inside.

### Clubs & Social *(mostly behind OFF feature flags — fix before enabling)*

#### H16. Club join-request approval broken three ways
- [ ] **Fix**
- **File:** `apps/mobile/src/features/clubs/services/clubService.ts:157-160`
- **Issue:** Writes `status: 'approved'` (CHECK allows `'accepted'`); `club_members` upsert for another user blocked by RLS (`auth.uid() = user_id`); `member_count` never incremented. The correct `accept_club_join_request` SECURITY DEFINER RPC exists but is never called.
- **Impact:** Approval appears to work (optimistic UI) but requester is never added; request reappears next load.

#### H17. Join requests to gated clubs are never created
- [ ] **Fix**
- **File:** `apps/mobile/src/features/clubs/hooks/useClubs.ts:29-31`
- **Issue:** "Request sent" alert shows, but no row is inserted into `club_join_requests`.

#### H18. Create-club UI offers policy values the DB CHECK rejects
- [ ] **Fix**
- **File:** `apps/mobile/src/features/clubs/screens/ClubScreen.tsx:71-73` vs migration 005:21 (`CHECK IN ('open','invite_only')`)
- **Issue:** UI offers `'request'`/`'invite'`; both violate the constraint → createClub always fails for non-open clubs.

#### H19. join_policy not enforced server-side — anyone can join any club
- [ ] **Fix**
- **File:** `supabase/migrations/20260301000005_functions_triggers.sql:115-116`
- **Issue:** `club_members` INSERT policy checks only `auth.uid() = user_id`.
- **Impact:** Any user inserts themselves into any invite-only club via one API call, gaining read access to its chat (IDOR-style privacy bypass).

#### H20. Failed kudos RPC zeroes the visible count
- [ ] **Fix**
- **File:** `apps/mobile/src/features/social/services/feedService.ts:44-47` + `useFeed.ts:105-110`
- **Issue:** Error ignored; fallback `{liked:false, count:0}` applied as server truth (supabase-js doesn't throw, so rollback catch never runs).
- **Impact:** Any transient failure wipes the post's kudos display until full refresh.

#### H21. Follow-state check selects nonexistent column
- [ ] **Fix**
- **File:** `apps/mobile/src/features/profile/screens/UserProfileScreen.tsx:54-60`
- **Issue:** Selects `followers.id` but the table has a composite PK and no `id` column — query always errors → `isFollowing` always false.
- **Impact:** "Follow" shown for already-followed users; duplicate insert fails silently; UI flips anyway — persistent desync.

### Auth

#### H22. Password reset is a dead end
- [ ] **Fix**
- **File:** `packages/shared/src/services/auth.ts:94-100` (+ `apps/mobile/index.ts:33-44` window stub, no recovery screen anywhere)
- **Issue:** `redirectTo` resolves to bogus `"/reset-password"` on native; web app has no reset page; mobile has no update-password screen, no `PASSWORD_RECOVERY` handler, no deep-link route.
- **Impact:** Forgot-password users are permanently locked out through the app.
- **Fix direction:** Minimal web `/reset-password` page (or in-app deep-link flow) before launch.

#### H23. Offline onboarding failure wipes local runs
- [ ] **Fix**
- **File:** `apps/mobile/src/features/auth/services/onboardingService.ts:59, 16` + `App.tsx:78-103`
- **Issue:** Completion persisted only via `pushProfile().catch(() => {})`; server row always exists with null `onboarding_completed_at`, so the gate re-forces onboarding, and `saveOnboardingData()` calls `clearLocalUserData()`.
- **Impact:** Complete onboarding offline → run → restart online → forced re-onboarding → local runs deleted.

#### H24. Push tokens never unregistered on sign-out
- [ ] **Fix**
- **File:** `packages/shared/src/services/pushNotificationService.native.ts:121-130`
- **Issue:** `unsubscribeFromPush()` has zero callers.
- **Impact:** Device keeps receiving previous user's notifications after account switch — privacy leak. (Fold into C3's sign-out cleanup.)

#### H25. `clearAllLocalData` not exported from store.native.ts
- [ ] **Fix**
- **File:** `apps/mobile/src/features/settings/context/SettingsContext.tsx:3,44` vs `packages/shared/src/services/store.native.ts`
- **Issue:** Import exists only in web `store.ts`; `undefined` on iOS/Android.
- **Impact:** Settings → Clear Run History throws `TypeError` on device. (Regression from the recent B2 fix — the shared package has platform-split files.)

### Backend

#### H26. XP/coins/level/energy/distance fully client-authoritative
- [ ] **Fix (fast-follow acceptable)**
- **File:** `packages/shared/src/services/sync.ts:100-103` + runs trigger in `20260301000002_social.sql:76`
- **Issue:** `pushProfile()` upserts absolute values; protection trigger intentionally doesn't lock these (deferred per migration 075 comment).
- **Impact:** User sets `energy = 9999`, arbitrary level/coins/distance via one upsert with the anon key. PACE (primary token) IS protected — severity bounded to secondary economy.

---

## MEDIUM

| # | Area | File | Issue → Impact |
|---|------|------|----------------|
| M1 | Backend | `supabase/migrations/20260301000027_mission_completion_rpc.sql:23-52` | `claim_mission_reward` trusts client-supplied `p_xp`/`p_coins`, gated on self-insertable progress row → unlimited coin/XP grants. Look up canonical reward server-side. |
| M2 | Backend | `process-run-territory/index.ts:322-329` vs `send-push-notification/index.ts:146` | Payload key mismatch (`userId`/`actionUrl` vs `user_id`/`action_url`) → territory-attack pushes always 400. Core retention loop silently broken. |
| M3 | Backend | `sync.ts:751` | Nutrition sync uses per-device autoincrement ids + `ignoreDuplicates` → multi-device entries silently dropped, marked synced. Needs UUIDs. |
| M4 | Run | `useActiveRun.ts:178-191, 392-403` | Background-drained points bypass all accuracy gates (no >30 m rejection, no warmup) → zigzag noise inflates distance on screen-off runs. |
| M5 | Run | `ActiveRunScreen.tsx:87-94` | Live-area interval depends on `run.gpsPoints` (new ref each second) → recreated every second, 30 s callback never fires → live territory HUD stuck at 0 while moving. |
| M6 | Run | `useActiveRun.ts:373-440` + `ActiveRunScreen.tsx:149-213` | No error handling around `endRunSession`; one SQLite failure permanently strands the run (isFinishingRef stuck true, listeners removed). Also `endRunSession` silently returns if player not loaded. |
| M7 | Run | `sync.ts:259-389, 809-855` | No in-flight mutex on `pushUnsyncedRuns` → concurrent postRunSync/initialSync can double-push a run and double-invoke the edge function. |
| M8 | Run/UX | `RunHUD.tsx:27`, `RunSummaryHero.tsx:117`, `history/RunItem.tsx:38-41` | km/mi setting collected in onboarding + settings but every run surface hardcodes km. Setting silently does nothing. |
| M9 | Territory | `claimEngine.ts:252-258` vs `process-run-territory/index.ts:89-95` | Tier thresholds differ client (5k/20k/80k/200k) vs server (5k/50k/200k/500k) → same area, different tier depending on code path. |
| M10 | Territory | `territoryService.ts:17` + `useTerritoryMap.ts:107` | Freshness decay applied twice on map screen (pre-decayed then decayed again in TS calc) → map TS ≠ dashboard TS. |
| M11 | Territory | `territoryService.ts:25-30` | Rival fetch = 200 newest rows globally, bbox-filtered client-side; purpose-built `get_map_polygons` RPC unused → nearby rivals vanish at scale. |
| M12 | Territory | migration 59:124-137 (`steal_territory_portion`) | `largest_polygon` drops disconnected remainders; exterior-ring-only keeps stolen strip under both owners. Geometry integrity bug. |
| M13 | Leaderboard | `leaderboardService.ts:43-47` | All-time/month tab: unbounded full-profiles-table select on every tab switch. |
| M14 | Leaderboard | `leaderboardService.ts:16,88` + `LeaderboardScreen.tsx:81` | Own rank invisible outside top 50/100 — no fallback own-row fetch; sticky "You" footer disappears exactly when needed. |
| M15 | Leaderboard | `LeaderboardScreen.tsx:21,113` | With 1-2 entries, Podium returns null and list data is `entries.slice(3)` (empty) → real entries render nowhere → "No data yet" during first launch week. |
| M16 | Leaderboard | `leaderboardService.ts:7` | Global/National/Local scope pills all return identical global data (`_scope` ignored). |
| M17 | Social | `useFeed.ts:37-51` + `feedService.ts:32-41` | Failed feed refresh silently blanks the whole feed (error ignored → `posts: []` replaces list, `hasMore=false`). |
| M18 | Social | `CommentSheet.tsx:63-71, 37-44` + `feedService.ts:88-94` | Failed comments look posted (no rollback, count increments); getComments has no catch → eternal spinner. |
| M19 | Social | `useFeed.ts:113-119` | toggleFollow optimistic flip with no rollback; service discards error → silent desync. |
| M20 | Profile | migration `20260518000067:48` | `get_profile_stats` sums `runs.distance_meters` but column is `distance_m` → RPC errors every call → period selector (week/month/year) silently does nothing. |
| M21 | Gear | `gearService.ts:53-72` | Shoe photos upload to nonexistent `user-media` bucket with RN-unreliable Blob body → never uploads, silently dropped. |
| M22 | Nutrition | `nutritionService.ts:106-136` | Local numeric ids vs remote uuids; deleteEntry deletes both stores by same id → "deleted" entries resurrect from server. |
| M23 | Coach | `useCoachChat.ts:36-63` + `coachService.ts:47-57` | No timeout on any `ai-coach` invoke → hung function pins typing indicator forever, input locked. |
| M24 | Clubs | `useLobbyChat.ts:32-48` + `lobbyChatService.ts` | Input cleared before insert; insert error ignored → failed sends silently discard message text. Fetch/subscribe race can drop or duplicate messages. |
| M25 | Clubs | `lobbyChatService.ts:19-25` | Messages ordered ascending with limit 60 → rooms >60 messages show only the oldest 60, no pagination. |
| M26 | Clubs | `clubService.ts:33-45` | `member_count` only updated by the unused accept RPC; no trigger → counts drift permanently after every join/leave. |
| M27 | Web/Admin | `apps/web/app/admin/page.tsx:7-9,971-982` + migration `20260301000042:11-12` | 'admin' tier impossible under CHECK `('free','premium')`; web has no login UI; `events` has no UPDATE/DELETE policy; `promotions` table exists in no migration. Every admin tab non-functional; writes silently no-op (optimistic UI hides failures). Not an auth hole — reads public by design, writes RLS-blocked. |
| M28 | Web | `apps/web/package.json:16,18-19` | react@19.2 + next@14.2.20 is an invalid peer combination (`npm ls` reports invalid) — root cause of H1's hoisting split. Upgrade to Next 15 or pin react 18 for web. |
| M29 | Web | `apps/web/instrumentation-client.ts:1` | File only auto-loaded by Next ≥15.3; on 14.x client Sentry never initializes → all browser errors (incl. entire admin page) unreported; `global-error.tsx` captureException no-ops. |
| M30 | Mobile | `App.tsx:53-59` | `ErrorUtils.setGlobalHandler` doesn't chain to previous handler → fatal JS errors leave app frozen in undefined state instead of crash/restart; with DSN unset, error vanishes entirely. |
| M31 | Auth | `settingsService.ts:23` + `SettingsContext.tsx:36` | signOut error ignored (supabase v2 keeps local session on network failure) → offline sign-out silently does nothing after resetAnalytics already ran. |
| M32 | Auth | `App.tsx:78-103,142-144` | Sign-in transition: one frame of stale Main flash, then NavigationContainer unmounts to a bare background with no spinner/timeout until onboarding check resolves; hangs indefinitely if query hangs. |
| M33 | Auth | `useSignUp.ts:57-59` | No handling for email-confirmation-required (`session === null`, no error) → if prod dashboard enables Confirm Email, signup silently does nothing. **Verify prod dashboard setting.** |

---

## LOW

| # | Area | File | Issue |
|---|------|------|-------|
| L1 | Backend | `process-run-territory/index.ts:169` | `subscriptionTier === 'premium'` never matches (valid tiers: free/runner-plus/territory-lord/empire-builder) → paying subscribers get the FREE PACE cap. |
| L2 | Backend | `device-webhook/index.ts:198`, `rc-webhook` | Signature verification skipped entirely if secret env unset; `===` compare is timing-unsafe. **Ensure GARMIN_WEBHOOK_SECRET / RC_WEBHOOK_SECRET set in prod.** |
| L3 | Backend | `store.ts:469-491` | Pending-action queue (claim/fortify offline queue) is dead code — nothing enqueues or drains it in production. |
| L4 | Backend | `ai-coach/index.ts` (9×), `foot-scan/index.ts:45` | Model id `claude-sonnet-4-6` — verify against current Anthropic model list; if invalid every AI Coach / foot-scan request 500s. |
| L5 | Run | `useActiveRun.ts:148-255` | No re-entrancy guard on startRun — double-tap creates two GPS watchers, leaks timer/subscription, duplicates points. |
| L6 | Run | `sync.ts:851` | `navigator.onLine` undefined in RN → `!navigator.onLine` always true → every sync failure reported as 'offline', masking real server errors. |
| L7 | Run | `useRunSetup.ts:46-56` | Watcher assigned after await; unmount during permission prompt leaks the GPS subscription. |
| L8 | Auth | `supabase.native.ts:21-32` | No AppState-driven `startAutoRefresh`/`stopAutoRefresh` → 401 flashes on foreground after >1 h backgrounded. |
| L9 | Auth | `App.tsx:78-103` | Onboarding-check effect lacks stale-response guard → rapid account switch can apply the wrong user's onboarding state. |
| L10 | Auth | `useAuth.ts:14-18` | `getSession().then()` with no `.catch` → rejection leaves `loading=true` forever (stuck splash). |
| L11 | Territory | `claimEngine.ts:186-190` | Convex hull sort lacks collinearity tie-breaking → possible self-intersecting hull ring. |
| L12 | Territory | `claimEngine.ts:142-171` | Corridor construction doesn't handle >90° turns / self-crossings → bow-tie rings, shoelace undercount, fill artifacts. |
| L13 | Territory | `sync.ts:483` | pullTerritories: up to 2000 global rows with full coords every sync; own rows beyond cap never sync down. |
| L14 | Social | `useFeed.ts:92-111` | toggleKudos has no in-flight guard — tap-spam causes out-of-order stale state (self-corrects on refresh). |
| L15 | Clubs | `lobbyChatService.ts:39-61` | `lobby_message_reactions` table exists in no migration — reaction picker UI persists nothing. |
| L16 | Clubs | `lobbyService.ts:8-25` | Lobby room list downloads every message row created today to count client-side. |
| L17 | Events | `eventService.ts:62` + `EventForm.tsx:36-39` | Free-text date/time parsed with `new Date()` → raw "Invalid time value" errors; Hermes parsing inconsistent. |
| L18 | Config | `apps/mobile/app.config.ts:25-40` | `ITSAppUsesNonExemptEncryption` missing from canonical config (only in stray root app.json) → TestFlight export-compliance friction. |
| L19 | Config | root `package.json:17,30-33` | Lint/lint-staged target nonexistent `apps/web/src` (code is in `apps/web/app`) → web code has no pre-commit safety net (likely how H1 landed). |
| L20 | Repo | `scripts/reports/test-results.json`, `scripts/reports/report.md` | Test artifacts tracked in git. Cosmetic — verified no secrets/keys tracked anywhere. |
| L21 | Deps | `apps/mobile/package.json` | `react-native-get-random-values@2.0.0` (expected ~1.11.0, major jump) and `expo-av@16` (not in SDK 55 bundled list, deprecated). Core deps (RN 0.83.2, react 19.2, reanimated 4.2.1, sentry 7.11) exactly match SDK 55. Run `npx expo-doctor`. |

---

## What's Solid (verified, no action needed)

- **Edge-function auth:** all functions validate the caller's JWT via `getUser()`; no body-supplied user ids trusted (no IDOR). `process-run-territory` rejects mismatched userId; `ai-coach` scopes runId by user_id.
- **PACE token authority:** `apply_pace_adjustment` granted to service_role only; client never pushes balance directly.
- **Recent P0 hardening:** runs GPS PII (076), notification phishing + lobby chat RLS (077), profile money-column protection (075), territories UPDATE WITH CHECK (078) — all in place.
- **Secrets:** nothing committed; `.env.local` gitignored; app.json/eas.json contain placeholders only.
- **Theme system:** exact light/dark token parity (verified programmatically); ThemeContext correct; dark accent fix sound.
- **ErrorBoundary:** theme-safe, reports to Sentry with component stack.
- **Notification deep-links:** defensive — route names verified, unknown URLs no-op, killed-state handled.
- **Feature flags:** CLUBS, EVENTS, GEAR, AI_COACH, NUTRITION, CHAT all **OFF** — shipping surface is Dashboard, Run Tracking, Profile, Social Feed, Missions. Several club/chat criticals are therefore not user-reachable at launch, but must be fixed before flipping flags.

---

## Recommended Fix Order (1-week timeline)

### Day 1–2 — Run integrity (every user hits these in session one)
1. C1 background GPS double-count
2. C2 crash recovery no-op
3. H6 PACE double-credit
4. H7 history summary zeroed
5. C3 + H24 + H25 sign-out cleanup, push unregister, native clearAllLocalData export

### Day 2–3 — Territory/economy server
6. C4 server perpendicular formula (one-line, mirror client fix)
7. C5 weekly PACE reset (pg_cron)
8. C6 persist territory_score (trigger or scheduled job)
9. C7 + H13 single claim path — server owns claims, revoke client INSERT

### Day 3–4 — Build config
10. H3 consolidate app.json/app.config.ts identities + L18
11. H4 fix OTA update URL
12. H5 set EAS production env vars (Supabase + Sentry DSN)
13. H1/H2/M28 fix web build + vercel.json (or defer web entirely — it's only privacy/terms/admin)

### Day 4–5 — Visible polish
14. H10 inverted map bbox (rivals)
15. H14 + M15 leaderboard subset + tiny-leaderboard empty state
16. H20 kudos error handling
17. H22 minimal password-reset page
18. C9 + H21 `follows`→`followers` fixes
19. M2 push notification payload keys

### Post-launch fast-follow
- H26 client-authoritative secondary economy, M1 mission rewards, H11/H12 freshness + territory pull deletions, H15 loop-fill cap, everything else MEDIUM/LOW
- Keep CLUBS/CHAT/EVENTS/GEAR/NUTRITION flags **OFF** until their findings (C8, H16–H19, M21–M26) are fixed

---

*Generated from a six-agent parallel deep-read review. File:line references verified against source at review time.*
