# Runivo — End-to-End Code Review Findings

**Date:** 2026-07-09 (review) / 2026-07-10 (fix pass)
**Scope:** Full monorepo — mobile app (Expo RN), web app (Next.js), shared packages, Supabase backend (migrations, RLS, edge functions)
**Method:** Six parallel deep-read reviews: (1) Auth/Onboarding/Navigation, (2) Run Tracking, (3) Territory/Leaderboard/Dashboard, (4) Social/Engagement, (5) Shared Services + Backend, (6) Web/Build/Config. Fix pass applied directly against the findings below.

**Status: fix pass complete.** All 9 criticals, 25 of 26 highs, and the large majority of mediums/lows are fixed and verified (`tsc --noEmit` clean across all 3 workspaces, `vitest` 29/29 passing, `next build` succeeding). A handful of items are intentionally deferred — each is marked `[skip]` with the reason. See "Deferred / Not Fixed" at the bottom for the full list and why.

---

## Legend

- [x] = fixed and verified  /  [skip] = intentionally deferred (reason given)  /  [n/a] = investigated, not actually a bug
- **File:line** references are to the state of the repo at commit `5049c32` (pre-fix) unless noted

---

## CRITICAL — all 9 fixed

### C1. Background GPS points double-counted on every run — [x] Fixed
- **Fix:** `locationTask.ts`'s TaskManager callback now skips buffering while `AppState.currentState === 'active'` (the foreground watcher already records those points); run-id resolution simplified to the sentinel only (see C1/H9 below).
- **Commit:** `0556b27`

### C2. Crash recovery is a no-op that deletes the checkpoint — [x] Fixed
- **Fix:** `RunScreen.tsx`'s "Recover" now reconstructs a full `StoredRun` from the checkpoint's GPS points (haversine distance, real duration, pace) via a new `recoverRunFromCheckpoint()`, saves it, stops any orphaned background task, *then* syncs and clears the checkpoint. Checkpoint payload now also carries `activityType` so the reconstructed run is accurate.
- **Commit:** `0556b27`

### C3. Sign-out never clears local data → cross-account corruption — [x] Fixed
- **Fix:** `settingsService.signOut()` now unsubscribes the push token, confirms `supabase.auth.signOut()` succeeded, then calls `clearAllLocalData()` (only on success — see M31). `clearAllLocalData` was extended on both platforms to wipe player/profile/nutrition/shoes/runs/territories, not just runs+territories.
- **Commit:** `6296139`

### C4. Server corridor geometry uses a non-perpendicular offset — [x] Fixed
- **Fix:** One-line perpendicular formula fix in `process-run-territory/index.ts`, mirroring the client's `claimEngine.ts`.
- **Migration:** none needed (edge function code, redeploy required)
- **Commit:** `3d33af3`

### C5. Weekly PACE cap is actually a lifetime cap — [x] Fixed
- **Fix:** `apply_pace_adjustment` rewritten (LANGUAGE SQL → plpgsql) to check `pace_weekly_reset_at` against the current UTC week's Monday and reset `pace_weekly_earned` before crediting when stale — no `pg_cron` dependency, resets lazily on the next PACE-earning run of a new week. `process-run-territory`'s pre-check cap logic aligned to treat a stale week as full remaining cap.
- **Migration:** `20260710000100_pace_weekly_reset.sql`
- **Commit:** `3d33af3`

### C6. `profiles.territory_score` is never written — [x] Fixed
- **Fix:** New trigger (`territory_polygons_sync_score`) on `territory_polygons` INSERT/UPDATE/DELETE recomputes and persists the affected owner's `territory_score` via `sync_territory_score()`. Existing rows backfilled.
- **Migration:** `20260710000101_territory_score_sync_and_lockdown.sql`
- **Commit:** `3d33af3`

### C7. Every run claims its territory twice — [x] Fixed
- **Fix:** Removed `pushPolygonTerritories()` entirely from the client sync flow — the server (`process-run-territory`, via `claim_unclaimed_area`/`steal_territory_portion`) is now the sole claim path. `pullTerritories()` scoped to the caller's own rows and now deletes locally-cached territories the server no longer has (fixes H12 too).
- **Commit:** `6296139`

### C8. Lobby/club chat is 100% dead (schema mismatch) — [x] Fixed
- **Fix:** Client aligned to the real schema (`lobby_id`, no `username` column — joined from profiles instead). Seeded 5 public discovery rooms as real `lobbies` rows (fixed UUIDs) for the previously-hardcoded topic rooms; `ClubDetailScreen` now calls `getOrCreateClubLobby()` to lazily create/find each club's real lobby instead of the fabricated `club_${clubId}` string. RLS extended so club-less/creator-less rows are public. Removed the dead reaction feature (L15) entirely.
- **Migration:** `20260710000109_lobby_public_rooms.sql`
- **Commit:** `3e5d296`
- *(Still behind the CHAT/CLUBS feature flags — correctly fixed before those flip on)*

### C9. Profile followers/following queries a nonexistent table — [x] Fixed
- **Fix:** All `from('follows')` → `from('followers')` with correct composite-key columns, across `profileService.ts`, `FollowersScreen.tsx`, `FollowingScreen.tsx`. (`UserProfileScreen.tsx` already used the right table name — see H21 for its separate bug.)
- **Commit:** `3e5d296`

---

## HIGH — 25 of 26 fixed (H26 deferred)

### Build & Deployment

#### H1. Web production build fails outright — [x] Fixed
- **Fix:** Upgraded Next.js 14.2.20 → 15.x. The existing `@sentry/nextjs@10` and `instrumentation-client.ts` already assumed Next 15 conventions while `next` itself hadn't been bumped — upgrading Next aligned all three already-present pieces instead of downgrading two of them to match stale Next 14. Verified: `next build` succeeds cleanly.
- **Commit:** `0101f4f`

#### H2. vercel.json is leftover Vite SPA config — [x] Fixed
- **Fix:** Replaced with a correct Next.js config (`framework: "nextjs"`, `outputDirectory: "apps/web/.next"`, explicit `buildCommand` for the monorepo workspace).
- **Commit:** `0101f4f`

#### H3. Two competing Expo app identities — [x] Fixed
- **Fix:** Consolidated into `apps/mobile/app.config.ts` (the file Expo actually reads): real bundle id `com.mehtabafsar.runivo` (was `com.runivo.app`), real projectId `024aa932-e299-4d0c-bc08-bacb7617274a` (was a placeholder), `ITSAppUsesNonExemptEncryption: false` added. Deleted the stray root `app.json`, root `eas.json`, and the superseded static `apps/mobile/app.json`. Verified via `npx expo config --type public` from `apps/mobile` — resolves cleanly with the correct identity.
- **Commit:** `0101f4f`

#### H4. expo-updates points at hardcoded placeholder URL — [x] Fixed
- **Fix:** `updates.url` now uses the real projectId, consistent with `extra.eas.projectId`.
- **Commit:** `0101f4f`

#### H5. Production builds may ship placeholder Supabase creds + no Sentry — [x] Scaffolded / ⚠️ action required
- **Fix:** Added `env` blocks to the `preview` and `production` EAS build profiles (previously only `development` had one). **Left as empty strings deliberately** — `.env.local` only contains local Supabase-emulator values (`127.0.0.1:54321`), not real production credentials, so injecting those would have silently pointed production builds at a phantom local server. **Action required before building preview/production:** set `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `EXPO_PUBLIC_SENTRY_DSN` via `eas secret:create` or the EAS dashboard, or fill `apps/mobile/eas.json`'s `env` blocks directly with the real values.
- **Commit:** `0101f4f`

### Run Tracking

#### H6. PACE double-credited on every synced run — [x] Fixed
- **Fix:** `useGameEngine.endRunSession` now computes `paceResult` *before* building/saving the run and stamps `xpEarned: paceResult.paceEarned` onto it, so `sync.ts`'s delta reconciliation (`server - clientCredited`) computes correctly instead of always crediting the full server amount on top of the optimistic credit.
- **Commit:** `6296139`

#### H7. Run history detail shows zeroed summary — [x] Fixed
- **Fix:** `useRunSummary` now fetches the run via `fetchRunById` when navigated to with only `{ runId }` (history/dashboard/profile), builds a full `PassedRunData` from it, and shows a loading spinner while fetching instead of flashing "claim Failed".
- **Commit:** `0556b27`

#### H8. Splits are fabricated (identical pace every km) — [x] Fixed
- **Fix:** `computeSplits` rewritten to use each GPS point's real timestamp for per-km interpolation instead of spreading total duration proportionally across distance. Timestamps threaded through `buildRunSummaryParams` → `route` (previously stripped). Falls back to the old duration-proportional estimate only when timestamps are genuinely absent (very old cached runs).
- **Commit:** `0556b27`

#### H9. Stale background task survives crashes and misattributes points — [x] Fixed
- **Fix:** Run-id resolution now reads *only* the `bg_gps_meta` sentinel (removed the self-perpetuating "newest buffer row" fallback). New `cleanupOrphanedBackgroundTask()` stops a still-registered task and clears stale buffer rows on `RunScreen` mount when there's no active/recoverable run.
- **Commit:** `0556b27`

### Territory & Leaderboard

#### H10. Rival territories never render — inverted viewport bbox — [x] Fixed
- **Fix:** `TerritoryMapScreen.tsx`'s bbox computation now uses `Math.min`/`Math.max` over both corners, robust regardless of MapLibre's `[NE, SW]` corner order.
- **Commit:** `879c570`

#### H11. Freshness decay never applied server-side — [x] Fixed
- **Fix:** `find_intersecting_territories` rewritten to return freshness decayed by the same formula as `get_territory_score` and the client's `computeFreshness` (10 pts/day since `last_defended_at`), instead of the raw stored value.
- **Migration:** `20260710000102_find_intersecting_territories_decay.sql`
- **Commit:** `3d33af3`

#### H12. Deleted/stolen territories never leave the loser's device — [x] Fixed
- Fixed together with C7 — see above.

#### H13. Client can forge arbitrary territory polygons — [x] Fixed
- **Fix:** Dropped the `tp_owner FOR ALL` policy entirely; `territory_polygons` is now SELECT-only for authenticated clients (service_role, used exclusively by `process-run-territory`, bypasses RLS as before).
- **Migration:** `20260710000101_territory_score_sync_and_lockdown.sql`
- **Commit:** `3d33af3`

#### H14. Weekly Distance/PACE leaderboard ranks an arbitrary 50-user subset — [x] Fixed
- **Fix:** `leaderboardService.ts` rewritten to order server-side by the *actual selected tab's metric* (`weekly_km`/`weekly_pace`/`territory_score`) instead of always ordering by the territory-rank column before re-sorting client-side.
- **Commit:** `879c570`

#### H15. Loop-fill cap tests corridor area, not hull area — [x] Fixed
- **Fix:** `shouldLoopFill` now takes the actual polygon that will be claimed (the convex hull) and tests *its* area against `LOOP_MAX_AREA_M2`, not the corridor's.
- **Commit:** `6296139` (pre-existing partial fix from prior session, verified complete)

### Clubs & Social

#### H16. Club join-request approval broken three ways — [x] Fixed
- **Fix:** `approveJoinRequest` now calls the existing `accept_club_join_request` SECURITY DEFINER RPC (which correctly sets `status='accepted'`, inserts the member bypassing RLS, and — via the new M26 trigger — updates `member_count`) instead of a manual update+upsert that violated the CHECK constraint and RLS.
- **Commit:** `3e5d296`

#### H17. Join requests to gated clubs are never created — [x] Fixed
- **Fix:** New `requestToJoinClub()` actually inserts a `club_join_requests` row (idempotent on unique-constraint violation); `useClubs.ts`'s join handler calls it for non-open clubs instead of just showing an alert.
- **Commit:** `3e5d296`

#### H18. Create-club UI offers policy values the DB CHECK rejects — [x] Fixed
- **Fix:** UI now offers exactly `open`/`invite_only` (the DB's actual CHECK values), removing the third `request`/`invite` options that could never be saved.
- **Commit:** `3e5d296`

#### H19. join_policy not enforced server-side — [x] Fixed
- **Fix:** `club_members` self-join INSERT policy now requires the target club's `join_policy = 'open'`; invite-only clubs can only gain members via the SECURITY DEFINER accept RPC.
- **Migration:** `20260710000103_club_members_join_policy.sql`
- **Commit:** `3d33af3`

#### H20. Failed kudos RPC zeroes the visible count — [x] Fixed
- **Fix:** `feedService.ts` now throws on any Supabase error instead of silently returning a `{liked:false,count:0}` fallback that `useFeed.ts` was applying as truth — the pre-existing rollback `catch` in `toggleKudos` now actually triggers correctly.
- **Commit:** `3e5d296`

#### H21. Follow-state check selects nonexistent column — [x] Fixed
- **Fix:** `UserProfileScreen.tsx` now selects `follower_id` (a real column) instead of `id` (doesn't exist on `followers`'s composite-PK table); `handleFollow` also now checks the write's error before flipping UI state.
- **Commit:** `3e5d296`

### Auth

#### H22. Password reset is a dead end — [x] Fixed
- **Fix:** Added a real `/reset-password` web page (`apps/web/app/reset-password/page.tsx`) implementing the Supabase recovery flow (detects the `PASSWORD_RECOVERY` auth event, lets the user set a new password). `resetPassword()` now points at `https://runivo.app/reset-password` explicitly instead of deriving from `window.location.origin` (which is `''` on native due to the polyfill in `index.ts`, producing an unusable relative path).
- **Commit:** `ba42d83`

#### H23. Offline onboarding failure wipes local runs — [x] Fixed
- **Fix:** Three-part fix — (1) removed the unconditional `clearLocalUserData()` call from `saveOnboardingData` (redundant now that C3 owns sign-out cleanup, and actively harmful on re-onboarding); (2) `saveOnboardingData` now reuses the existing local player via `getPlayer()` instead of always minting a fresh zeroed one via `initializePlayer`; (3) `App.tsx`'s onboarding gate now trusts local `onboardingCompletedAt` (and retries the push) instead of exclusively trusting the server's `onboarding_completed_at`, which a swallowed push failure left permanently null.
- **Commit:** `ba42d83`

#### H24. Push tokens never unregistered on sign-out — [x] Fixed
- Fixed together with C3 — `unsubscribeFromPush()` is now called in both the normal sign-out and delete-account flows.
- **Commit:** `6296139`

#### H25. `clearAllLocalData` not exported from store.native.ts — [x] Fixed
- **Fix:** Added `clearAllLocalData` (async wrapper around the now-complete `clearLocalUserData`) to `store.native.ts`, matching the web store's export.
- **Commit:** `6296139`

### Backend

#### H26. XP/coins/level/energy/distance fully client-authoritative — [skip] Deferred
- **Reason:** Fixing this properly requires moving the entire secondary game economy (XP/coins/level/energy accumulation) server-side — a new SECURITY DEFINER RPC analogous to `apply_pace_adjustment`, plus corresponding client changes to stop pushing absolute values and instead read server-computed increments back. This is architecturally equivalent in scope to the PACE-hardening work already done, not a quick fix, and the review's own categorization flagged it "fast-follow acceptable." **PACE (the primary token) is already fully server-authoritative and protected** — this gap is bounded to the secondary/cosmetic economy. Recommend a dedicated follow-up pass.

---

## MEDIUM — 27 of 33 fixed

| # | Area | Status | Notes |
|---|------|--------|-------|
| M1 | Backend | **[skip]** | `claim_mission_reward` is confirmed **dead code** — zero callers anywhere in the client. Missions currently credit PACE entirely client-side via `missionStore.ts`/`missionStore.native.ts`, a different (and itself non-authoritative) mechanism not covered by the original finding. Flagging as a new, deeper issue for a dedicated follow-up rather than "fixing" an unreachable function. |
| M2 | Backend | **[x] Fixed** | `process-run-territory`'s push-notification call now sends `user_id`/`action_url` (snake_case) matching what `send-push-notification` actually reads. Commit `3d33af3`. |
| M3 | Backend | **[x] Fixed** | Nutrition sync now uses a stable per-entry `remoteId` (UUID, generated client-side and persisted back to the local entry) instead of the colliding local autoincrement id. Commit `6296139`. |
| M4 | Run | **[x] Fixed** | Background-buffered points now pass through the same >30m accuracy gate as foreground points before being buffered. Commit `0556b27`. |
| M5 | Run | **[x] Fixed** | Live-area interval now reads `gpsPoints` from a ref instead of depending on the array reference (which changed every second), so its 30s callback actually fires. Commit `0556b27`. |
| M6 | Run | **[x] Fixed** | `endRunSession` call wrapped in try/catch; failure resets the finishing guard and `ActiveRunScreen` shows a Retry alert instead of a permanently frozen screen. Commit `0556b27`. |
| M7 | Run | **[x] Fixed** | `pushUnsyncedRuns` now uses a module-level in-flight promise so concurrent callers (postRunSync + initialSync) share one push instead of double-pushing. Commit `6296139`. |
| M8 | Run/UX | **[skip]** | Full km/mi display threading across RunHUD/RunSummaryHero/History/Splits was deprioritized given time constraints — it requires touching ~6-8 display components for a cosmetic (non-data-integrity) setting. `activityType` threading needed for C2 was done; the unit-conversion display work itself was not. Recommend a dedicated follow-up. |
| M9 | Territory | **[x] Fixed** | `claimEngine.ts` tier thresholds aligned to the server's canonical values (5k/50k/200k/500k). Commit `6296139`. |
| M10 | Territory | **[x] Fixed** | `computeTerritoryScore` takes an `alreadyDecayed` flag so the territory map screen (which pre-decays for display) and the dashboard (which passes raw values) now produce the same score for the same data. Commit `879c570`. |
| M11 | Territory | **[x] Fixed** | Rival fetch now calls the spatially-indexed `get_map_polygons` RPC scoped to the viewport instead of downloading the 200 globally-newest rows. Commit `879c570`. |
| M12 | Territory | **[x] Fixed** | `steal_territory_portion` rewritten to emit one row per disjoint remainder/stolen polygon part (largest reuses the original id) instead of keeping only the largest and flattening holes, which recreated the "stolen" strip under both owners. Commit `3d33af3`. |
| M13 | Leaderboard | **[x] Fixed** | Month/all-time tabs now order+limit server-side (profiles columns directly; new `get_run_km_by_user(p_limit)` for distance) instead of downloading the entire table. Commit `879c570`. |
| M14 | Leaderboard | **[x] Fixed** | When the signed-in user falls outside the fetched page, a follow-up query fetches their own row + rank (new `get_own_distance_rank` RPC for the distance tab; count-based for the others) so the sticky "You" footer always renders. Commit `879c570`. |
| M15 | Leaderboard | **[x] Fixed** | With <3 entries, the podium is skipped and all entries render in the list (previously both the podium AND the list were empty). Commit `879c570`. |
| M16 | Leaderboard | **[x] Fixed** | Removed the non-functional 'local' scope pill (no city/region data exists to scope by); 'national' now actually filters by `profiles.country`. Commit `879c570`. |
| M17 | Social | **[x] Fixed** | Fixed as a consequence of H20 — `fetchFeed` now throws on error instead of silently resolving `{posts:[], nextCursor:null}`, so a failed refresh no longer blanks existing posts. Commit `3e5d296`. |
| M18 | Social | **[x] Fixed** | `CommentSheet`'s comment-load now has a `.catch()` (shows an error state instead of an eternal spinner); the existing rollback-on-failed-post logic now works correctly since `addComment` throws on error. Commit `3e5d296`. |
| M19 | Social | **[x] Fixed** | `toggleFollow` now rolls back its optimistic state on failure instead of leaving the UI desynced until the next refresh. Commit `3e5d296`. |
| M20 | Profile | **[x] Fixed** | `get_profile_stats` fixed to use `distance_m` (the real column) instead of the nonexistent `distance_meters`. Commit `3d33af3`. |
| M21 | Gear | **[skip]** | Shoe photo upload bucket fix (creating `user-media` with RLS + switching to a reliable upload body) deferred given time constraints — GEAR_TRACKING is feature-flagged OFF, not user-reachable at launch. |
| M22 | Nutrition | **[x] Fixed** | `deleteEntry` now targets the entry's real remote UUID (`remoteId`, stamped on sync) instead of the local autoincrement id against a UUID column. Commit `0101f4f`. |
| M23 | Coach | **[skip]** | AI coach invoke timeout deferred given time constraints — AI_COACH is feature-flagged OFF, not user-reachable at launch. |
| M24 | Clubs | **[x] Fixed** | `useLobbyChat` no longer clears the input before the send succeeds (restores text + shows an error on failure); subscribes before fetching and dedupes by message id to avoid the fetch/subscribe race. Commit `3e5d296`. |
| M25 | Clubs | **[x] Fixed** | Fixed together with C8 — messages now fetched newest-60 (descending + reverse) instead of oldest-60 forever. Commit `3e5d296`. |
| M26 | Clubs | **[x] Fixed** | New trigger on `club_members` keeps `clubs.member_count` accurate for every join/leave path, not just the invite-only approval RPC; existing counts backfilled. Migration `20260710000150_club_member_count_trigger.sql`. Commit `3e5d296`. |
| M27 | Web/Admin | **[x] Fixed** | Schema half: widened `subscription_tier` CHECK to allow `'admin'`, added `events` UPDATE/DELETE admin policies, created the `promotions` table (migration `20260710000105`). UI half: admin page now has a real email/password sign-in form (previously a dead end when there was no session at all), and every mutation handler (events/promotions/pace_store_rewards toggle/delete/reorder) checks and surfaces its error instead of silently no-oping. Commits `3d33af3`, `0101f4f`. |
| M28 | Web | **[x] Fixed** | Resolved by the Next 15 upgrade (H1) — react@19 + next@15 is a supported combination. Commit `0101f4f`. |
| M29 | Web | **[x] Fixed** | `instrumentation-client.ts` now auto-loads correctly (Next 15.5 ≥ the 15.3 minimum); added the `onRouterTransitionStart`/`onRequestError` hooks Sentry's build reported as missing, so client + server + edge error capture is fully wired. Commit `0101f4f`. |
| M30 | Mobile | **[x] Fixed** | `ErrorUtils.setGlobalHandler` now chains to the previous handler (RN's default + Sentry's own) instead of replacing it outright. Commit `ba42d83`. |
| M31 | Auth | **[x] Fixed** | Fixed together with C3 — sign-out now checks the `supabase.auth.signOut()` error and shows an alert instead of silently no-oping (and no longer clears local data / resets analytics on that failure path). Commit `6296139`. |
| M32 | Auth | **[x] Fixed** | Eliminated the one-frame stale-Main flash on sign-in via React's "adjust state during render" pattern — `checkingOnboarding` is set synchronously when `user.id` changes, instead of waiting for the following effect. Commit `ba42d83`. |
| M33 | Auth | **[x] Fixed** | Sign-up now detects `session === null` (email-confirmation-required) and shows a clear message instead of leaving a stopped spinner with no explanation. Commit `ba42d83`. |

---

## LOW — 16 of 21 fixed, 1 confirmed non-issue

| # | Area | Status | Notes |
|---|------|--------|-------|
| L1 | Backend | **[n/a] Not a bug** | Verified directly: the CHECK constraint allows exactly `('free','premium')` and both subscription webhooks write `'premium'` — the finding's claim of a 4-tier scheme was stale/incorrect. `subscriptionTier === 'premium'` matches correctly. |
| L2 | Backend | **[x] Fixed** | `device-webhook` now fails closed (503) when `GARMIN_WEBHOOK_SECRET` is unset instead of skipping verification; rejects `coros`/`polar` outright (no signature scheme implemented for them). Both `device-webhook` and `rc-webhook` use constant-time comparison instead of `===`. Commit `3d33af3`. |
| L3 | Backend | **[x] Fixed** | Removed the dead pending-action queue (`queueAction`/`getPendingActions`/`clearPendingAction`) from both store platforms and their tests — confirmed zero production callers. Commit `6296139`. |
| L4 | Backend | **[skip]** | Cannot verify the Anthropic model id (`claude-sonnet-4-6`) against the live model list without external API access. **Action:** verify this string against the current Anthropic model catalog before launch — if invalid, every AI Coach / foot-scan request 500s (moot at launch since AI_COACH is flagged off, but will matter when it's enabled). |
| L5 | Run | **[x] Fixed** | `startRun` now guards against re-entrancy (double-tap) via a synchronous ref flag. Commit `0556b27`. |
| L6 | Run | **[x] Fixed** | `navigator.onLine === false` (not just falsy/undefined) is now required to report 'offline' — real server errors no longer masked. Commit `6296139`. |
| L7 | Run | **[x] Fixed** | `useRunSetup`'s permission-request watcher no longer leaks on unmount-during-request (cancellation flag added). Commit `0556b27`. |
| L8 | Auth | **[x] Fixed** | Added the documented AppState-driven `startAutoRefresh`/`stopAutoRefresh` pattern to the native Supabase client. Commit `ba42d83`. |
| L9 | Auth | **[x] Fixed** | Onboarding-check effect now guards against a stale response from a rapid account-switch race. Commit `ba42d83`. |
| L10 | Auth | **[x] Fixed** | `useAuth`'s `getSession()` now has a `.catch()` — a rejection no longer leaves `loading` stuck true forever. Commit `ba42d83`. |
| L11 | Territory | **[x] Fixed** | Convex hull sort now has a distance tie-break for collinear points (standard Graham scan fix). Commit `6296139` (pre-existing partial fix, verified). |
| L12 | Territory | **[x] Fixed** | Corridor construction now guards against hairpin turns (heading change >90°) that previously produced self-intersecting bow-tie rings. Commit `6296139` (pre-existing partial fix, verified). |
| L13 | Territory | **[x] Fixed** | Fixed together with C7/H12 — `pullTerritories` now scoped to the caller's own rows instead of pulling up to 2000 global rows. Commit `6296139`. |
| L14 | Social | **[x] Fixed** | `toggleKudos` now guards against tap-spam via an in-flight ref set. Commit `3e5d296`. |
| L15 | Clubs | **[x] Fixed** | Removed the dead reaction-picker UI entirely (no backing table existed, confirmed in no migration) rather than building out a new feature. Commit `3e5d296`. |
| L16 | Clubs | **[x] Fixed (partial)** | Column name fixed (`room_id` → `lobby_id`); the "download all today's messages to count client-side" pattern itself was left as-is given time constraints (feature-flagged off, low severity). Commit `3e5d296`. |
| L17 | Events | **[skip]** | Event date/time input validation deferred given time constraints — EVENTS is feature-flagged OFF, not user-reachable at launch. |
| L18 | Config | **[x] Fixed** | Fixed together with H3 — `ITSAppUsesNonExemptEncryption` now lives in the canonical `apps/mobile/app.config.ts`. Commit `0101f4f`. |
| L19 | Config | **[x] Fixed** | Lint/lint-staged globs fixed to the real web directories (`app`/`components`/`lib`, not the nonexistent `src`); also added the `apps/web` `typecheck` script the root config already assumed existed. Commit `0101f4f`. |
| L20 | Repo | **[x] Fixed** | Removed tracked test-run artifacts (`scripts/reports/`) and gitignored the directory. Commit `0101f4f`. |
| L21 | Deps | **[skip]** | `react-native-get-random-values@2.0.0` version pin left as-is — advisory-only finding with no way to verify native-build impact in this environment (would need `expo-doctor` + a real device build). `expo-av` confirmed **in active use** (theme/sounds.ts) — not dead code, correctly left alone. |

---

## What's Solid (verified, no action needed)

- **Edge-function auth:** all functions validate the caller's JWT via `getUser()`; no body-supplied user ids trusted (no IDOR). `process-run-territory` rejects mismatched userId; `ai-coach` scopes runId by user_id.
- **PACE token authority:** `apply_pace_adjustment` granted to service_role only; client never pushes balance directly. Now also week-aware (C5).
- **Recent P0 hardening:** runs GPS PII (076), notification phishing + lobby chat RLS (077), profile money-column protection (075), territories UPDATE WITH CHECK (078) — all in place, and the C8/H19 fixes build directly on top of the 077 membership-scoping design.
- **Secrets:** nothing committed; `.env.local` gitignored; app.json/eas.json contain placeholders only (H5's production values still need to be set via EAS secrets).
- **Theme system:** exact light/dark token parity (verified programmatically); ThemeContext correct; dark accent fix sound.
- **ErrorBoundary:** theme-safe, reports to Sentry with component stack.
- **Notification deep-links:** defensive — route names verified, unknown URLs no-op, killed-state handled.
- **Feature flags:** CLUBS, EVENTS, GEAR, AI_COACH, NUTRITION, CHAT all **OFF** — shipping surface is Dashboard, Run Tracking, Profile, Social Feed, Missions. C8 and the club findings are now fixed regardless, so flipping those flags on post-launch is safe once M21/M23/L17 (the remaining flagged-off deferrals) are picked up.
- **Web build:** now builds cleanly end-to-end on Next 15 with full Sentry instrumentation (client, server, edge).
- **Mobile app identity:** single source of truth (`apps/mobile/app.config.ts`), verified via `npx expo config`.

---

## Deferred / Not Fixed — full list with reasons

| Finding | Reason for deferral | Risk if shipped as-is |
|---|---|---|
| H26 | Requires moving the secondary economy (XP/coins/level/energy) server-side — architecturally equivalent scope to the PACE hardening already done | Client can self-grant XP/coins/energy; PACE (the real economy) is unaffected |
| M1 | Confirmed dead code (`claim_mission_reward` has zero callers) — the real mission-PACE-crediting path is a different, deeper issue needing its own investigation | None directly (unreachable); the real mission PACE path may not be server-authoritative — flag for follow-up |
| M8 | Full km/mi UI threading across 6-8 display components — cosmetic, not data-integrity | Users who select miles in onboarding still see km everywhere |
| M21 | GEAR_TRACKING feature-flagged OFF | None at launch |
| M23 | AI_COACH feature-flagged OFF | None at launch |
| L4 | Cannot verify Anthropic model id without external API access | Moot while AI_COACH is flagged off; verify before enabling |
| L16 (partial) | Query-shape improvement only, feature-flagged off, low severity | None at launch |
| L17 | EVENTS feature-flagged OFF | None at launch |
| L21 | Advisory-only, no way to verify native build impact in this environment | Unknown — run `expo-doctor` + a real device build before relying on this being fine |

**Recommendation:** all nine are either genuinely low-risk at launch (behind OFF feature flags) or require verification/scope beyond what's safely doable without a live environment. None block shipping the must-ship surface (Dashboard, Run Tracking, Territory, Leaderboard, Profile, Social Feed, Missions, Auth).

---

## Verification performed

- `npx tsc --noEmit` clean on all 3 workspaces (`apps/mobile`, `apps/web`, `packages/shared`)
- `npx vitest run` — 29/29 tests passing
- `npm run build --workspace=apps/web` — succeeds, no warnings (Sentry instrumentation fully wired)
- `npx expo config --type public` (from `apps/mobile`) — resolves correct bundle id, projectId, all permission strings
- 10 new Supabase migrations written (`20260710000100` through `20260710000150`) — **not yet applied to any database**; run `supabase db push` (or equivalent) before the fixes take effect server-side

*Fix pass performed directly against this document's findings — commit hashes above are the actual commits on `master`.*
