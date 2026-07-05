# Runivo — Changes Required (from external audit, verified)

> **What this is:** an actionable, prioritized changes list derived from the external
> product/engineering audit (2026-07-06). Every item below was **independently
> re-verified against the real codebase** — all 18 checked claims held up with exact
> file:line evidence (the audit was accurate). This document is the deliverable; on
> approval it should also be saved into the repo (suggested: `docs/CHANGES.md`).
>
> **Reading the priority tags:** **P0** = security/data-integrity/money defects that
> must be fixed before *any* public launch. **P1** = the core-loop and conversion fixes
> that turn "works" into "converts." **P2** = correctness & code-health. **P3** =
> differentiation, post-launch.
>
> **Note on overlap with prior work:** Some items (dark-mode `MissionRow`) are
> regressions introduced by an earlier `C.black → C.alwaysDark` theming pass in this
> repo's recent history — flagged honestly below. Others (account deletion, PACE-ledger,
> Sentry/PostHog) are already done and are *not* re-listed here.

---

## P0 — Security & money integrity (launch blockers)

All of these are new Supabase migrations or small edge-function edits — days, not weeks.
**Rule:** every RLS fix is a NEW migration file; never edit an applied migration.

### P0-1 — [CRITICAL] Any user can self-grant premium & rewrite XP/coins/leaderboard
- **Verified:** `supabase/migrations/20260301000001_core_schema.sql:116-117` — the
  `profiles` UPDATE policy is `for update using (auth.uid() = id)` with **no
  `WITH CHECK`**, and no later migration or trigger adds column protection (the only
  BEFORE UPDATE trigger on profiles is a timestamp trigger). Migration 028
  (`subscription_rls`) only gates *events* and *territories* — it does **not** touch
  profiles.
- **Impact:** with the public anon key, a user can
  `UPDATE profiles SET subscription_tier='premium', subscription_expires_at='2099-01-01'`
  — and equally rewrite `xp`, `coins`, `level`, `total_distance_km`, `follower_count`,
  corrupting every leaderboard. Voids the entire subscription model + gamification
  integrity.
- **Fix:** new migration that either (a) adds a BEFORE UPDATE trigger raising an
  exception if a non-service-role caller changes `subscription_tier`,
  `subscription_expires_at`, `xp`, `coins`, `level`, `pace_balance`,
  `pace_total_earned`, `follower_count`, etc.; **or** (b) moves the money/economy
  columns to a service-role-only table. Trigger approach is smaller and preserves the
  existing offline-first sync of the *allowed* columns.

### P0-2 — [CRITICAL] Every user's raw GPS traces are world-readable (PII)
- **Verified:** `supabase/migrations/20260301000002_social.sql:27` (`gps_points jsonb`)
  and `:105` (`for select using (true)`). No later migration tightens it.
- **Impact:** any authenticated user can pull anyone's exact routes — home, work, daily
  schedule. Sensitive-location PII with zero owner scoping. This is the kind of finding
  that becomes a news story.
- **Fix:** new migration replacing the `runs` SELECT policy with
  `using (auth.uid() = user_id)`. For anything social that needs *others'* run data
  (feed cards, leaderboard), expose only derived aggregates (distance, pace, territory
  tier — **never** `gps_points`) via a dedicated view or `SECURITY DEFINER` RPC that
  strips coordinates. Audit the feed/leaderboard read paths for direct `runs` selects
  before flipping the policy so nothing breaks.

### P0-3 — [HIGH] Paying users never actually become premium (money broken)
- **Verified:** `stripe-webhook/index.ts:43,51-57` and `rc-webhook/index.ts:33-35,106`
  write `subscription_tier` values `'runner-plus'`/`'territory-lord'`/`'empire-builder'`,
  but `20260301000042_consolidate_tiers.sql:11-12` constrains the column to
  `('free','premium')`. Every webhook UPDATE violates the CHECK constraint → the whole
  UPDATE fails → **no one who pays ever gets premium**. Both webhooks return HTTP 500 on
  the failure (not silent), so Stripe/RevenueCat **retry indefinitely** — a retry storm,
  not just a no-op.
- **Fix:** map both webhooks to write `'premium'` (and drop the stale
  three-tier `validTiers` list in stripe-webhook, or map all paid tiers → `'premium'`).
  Combined with P0-1, note the *only* currently-working path to premium is the free
  bypass — so P0-1 and P0-3 must ship together.

### P0-4 — [HIGH] Anyone can insert notifications to any user (phishing vector)
- **Verified:** `20260301000009_runs.sql:72-73` — policy named "service role can insert"
  actually has `with check (true)`. Notifications render a clickable `action_url`.
- **Impact:** a client can insert a fake "Verify your account" notification with an
  attacker-controlled link to any user.
- **Fix:** new migration scoping the INSERT to `auth.uid() = user_id` OR restricting to
  `service_role` (notifications are created server-side by edge functions, so
  service-role-only is correct).

### P0-5 — [HIGH] Lobby chat is world-readable and postable without membership
- **Verified:** `20260301000006_notifications.sql:53-56` — `lobby_messages` SELECT
  `using(true)`, INSERT checks only sender id, not membership; also in the realtime
  publication (`:62`). `club_messages` (`20260301000012_club_chat.sql:19-36`) already
  does this correctly via an `exists(... club_members ...)` check — copy that pattern.
- **Fix:** new migration scoping both SELECT and INSERT to lobby participants.
- **Note:** CLUBS/lobbies are `FEATURES`-flagged **off** for v1, so this is lower real
  exposure today — but fix before those flags flip on.

### P0-6 — [MED] `send-push-notification` has no caller auth
- **Verified:** `supabase/functions/send-push-notification/index.ts:121-160` — reads
  `{user_id,title,body,action_url}` from the body, never calls `auth.getUser` / checks a
  secret, pushes via service role.
- **Impact:** anyone with the public anon key can push arbitrary push notifications to
  any user.
- **Fix:** require a shared secret header (like `rc-webhook` does) or authenticate the
  caller; this function should only be callable by other edge functions / service role.

### P0-7 — [HIGH] `ai-coach` cross-user run leak (IDOR) + uncapped vision cost
- **Verified:** `supabase/functions/ai-coach/index.ts` — service-role client
  (`:1518-1520`); `handlePostRun` (`:733-737`) fetches a run
  `.eq('id', runId).single()` with **no `.eq('user_id', ...)`** owner filter (the caller
  *is* authenticated at `:1526`, but run ownership isn't verified → IDOR). Separately the
  `food_scan` vision path (`:1534-1565`) runs the Anthropic vision call and returns
  **before** `enforceDailyCap(...)` (`:1568`).
- **Fix:** add `.eq('user_id', user.id)` to the run fetch; move `food_scan` behind the
  daily cap; bound input sizes.

### P0-8 — [MED] `territories` UPDATE lacks WITH CHECK (+ two conflicting policies)
- **Verified:** `20260301000028_subscription_rls.sql:36-42` and
  `20260301000046_territories_rls_hardening.sql:36-38` — two coexisting owner-UPDATE
  policies, **neither** has `WITH CHECK`, so an owner can reassign `owner_id`, or set
  `defense`/`tier` arbitrarily, bypassing the GPS-proof RPC.
- **Fix:** new migration dropping both and creating one owner-UPDATE policy **with** a
  `WITH CHECK` that forbids changing `owner_id` and restricts `defense`/`tier` to the
  RPC/service-role path.

---

## P1 — Core loop & conversion

### P1-1 — [HIGH] Wire the live territory-capture reward (dead `ClaimToast`)
- **Verified:** `ClaimToast.tsx` and `LevelUpOverlay.tsx` are imported **nowhere**
  (grep-confirmed dead). All capture celebration is deferred to `RunSummaryScreen` after
  the user stops (`ActiveRunScreen.tsx`). The dopamine hit that makes a land-grab game
  addictive is absent from the exact moment it should fire.
- **Impact:** this is the single highest-leverage UX change — the differentiator (turf
  capture) has no in-the-moment payoff today.
- **Fix:** render `ClaimToast` + a haptic from `ActiveRunScreen` when a claim/loop-close
  is detected mid-run (the detection already exists via `detectLoopClose` /
  `isNearRivalTerritory` in the live-HUD effects). Decide whether `LevelUpOverlay` is
  revived or deleted (economy is PACE/Rank now, not levels — likely **delete** it as
  stale).

### P1-2 — [HIGH] Make the territory-cap paywall real (currently a stub)
- **Verified:** `apps/mobile/src/features/subscription/hooks/useFeatureGate.ts:55`
  `const territoryLimit = Infinity;`, `:64-67` `canClaimTerritory` always returns
  `true`, `:69-72` `territoryBlockReason` always `null`.
- **Impact:** this is the **game-native paywall no competitor can copy** ("own more
  turf / defend harder") — and it's scaffolded but non-functional. Strava paywalls
  analytics; Adidas is abandoning subscriptions. This is Runivo's on-brand monetization
  and it's currently free-for-all.
- **Fix:** implement a real free-tier territory/claim cap in `useFeatureGate` and gate
  `canClaimTerritory` on `isPremium || ownedCount < FREE_CAP`; surface an upgrade sheet
  on `territoryBlockReason`. Server must enforce it too (a client-only cap is bypassable,
  especially given P0-1).

### P1-3 — [HIGH] Fix dark-mode regressions on the two most-seen surfaces
- **P1-3a — `MissionRow` invisible text in dark mode.** Verified `MissionRow.tsx:39`
  `title { color: C.bg }` on `DashboardScreen.tsx:229` `missionCard {
  backgroundColor: C.alwaysDark }`. `C.bg` is `#0D0D0D` in dark → `#0D0D0D`-on-`#0A0A0A`
  = invisible. **This is a regression from the recent `alwaysDark` theming pass** (the
  card background was tokenized but its child text token wasn't). **Fix:** the mission
  card is a fixed-dark card, so its text must use a *fixed-light* token (add/`use`
  `C.alwaysLight` for the title, not `C.bg`) — mirroring how other fixed-dark cards pair
  `alwaysDark` bg with `alwaysLight`/white text.
- **P1-3b — `BentoCard` quick-actions don't invert.** Verified `BentoCard.tsx:230-232`
  hardcode `#F0EDE8`/`#FFFFFF`/`#0A0A0A` (the file otherwise uses `mkStyles(C)`).
  **Fix:** map those to theme tokens (`C.surface`/`C.white`/`C.t1` as appropriate).
- **P1-3c — Onboarding is hardcoded light.** Verified `OnboardingScreen.tsx:23` defines
  its own palette and never calls `useTheme`. **Fix:** route it through `useTheme()` (or
  intentionally lock it light and *state* that — but broken dark mode on the first-run
  surface is a poor first impression).

### P1-4 — [HIGH] HUD secondary metrics illegible mid-run
- **Verified:** `RunHUD.tsx:61-62` — secondary labels `fontSize: 8` at
  `rgba(255,255,255,0.35)`, values `fontSize: 20`. Fails the sweat/glance test
  one-handed while moving.
- **Fix (low-effort):** value 20 → 28+, label 8 → 11, opacity 0.35 → ~0.55. Primary
  distance (72px) is fine; only the secondary row needs it.

---

## P2 — Correctness & code health

### P2-1 — [MED] Paused-then-backgrounded run leaks distance
- **Verified:** `useActiveRun.ts` — background-buffer drain on foreground-resume
  (`:172-192`, `+= d/1000` at `:179`) and at finish (`:383-397`, `:389`) merge buffered
  GPS points into `totalDistanceRef` with **no `isPausedRef` check**, unlike the live
  callback (`:258-259`). Pausing then backgrounding accumulates distance while paused.
- **Fix:** tag buffered points with paused-state at capture time (in `locationTask`) and
  skip paused points on drain — or drop the buffer while paused. Critical-path file:
  add a warning comment and branch-walk.

### P2-2 — [MED] Consolidate the 3 ad-hoc premium checks (one is dead-wrong)
- **Verified:** `useDashboard.ts:57-60` (`!== 'free'`), `eventService.ts:38,44`
  (`=== 'empire-builder'` — a tier that **no longer exists** post-consolidation, so
  event creation is **always blocked**), `CoachScreen.tsx:75,82` (`=== 'premium'`).
- **Fix:** route all three through `useFeatureGate`/`useSubscription`; delete the
  `'empire-builder'` comparison. Fixing `eventService` also unblocks premium event
  creation once EVENTS is flagged on.

### P2-3 — [MED] CI lints zero files
- **Verified:** root `package.json:17` and `.github/workflows/ci.yml:32` run
  `eslint apps/web/src` — but web code lives in `apps/web/app` (`apps/web/src` does not
  exist), so lint matches **zero files and silently passes**. No mobile/shared lint, no
  build step, only the 3 shared tests run.
- **Fix:** point eslint at `apps/web/app` (+ `apps/web/components`, `apps/web/lib`); add
  mobile + shared lint globs; add a build step (`next build` and/or an EAS/`expo`
  prebuild check) to CI.

### P2-4 — [MED] Zero test coverage on `claimEngine.ts` (the core money path)
- **Verified:** only 3 test files exist, all in `packages/shared/src`
  (`useGameEngine.test.ts`, `store.test.ts`, `sync.test.ts`); `claimEngine.ts` has no
  test. (A richer suite exists only in an abandoned `.claude/worktrees/...` worktree,
  never merged.)
- **Fix:** add `claimEngine.test.ts` covering polygon build, min-points/speed gate,
  loop-close, area cap, `calculateRunPACE` cap/streak logic. This is the code that mints
  currency — it must be tested.

### P2-5 — [MED] Reconcile the two territory models (retire orphaned H3)
- **Verified:** live claims use polygon corridors (`claimEngine.ts:262-295`); the H3
  hex `claim_territory()` RPC + `claimTerritoryRemote` have **zero callers**
  (`sync.ts` region ~561-579). Two territory systems in the schema; only one is wired.
- **Fix:** decide and act — either delete the orphaned H3 claim path (RPC + client
  wrapper + related schema) or wire it. Shipping both is confusing tech debt and the
  audit's "half-real hexagon" critique.

### P2-6 — [LOW] Webhook 500-on-constraint-failure causes retry storms
- Covered functionally by P0-3, but note: once tiers are fixed, keep the error-logging
  but ensure a *bad* payload returns a 4xx (not 5xx) so Stripe/RevenueCat stop retrying.

---

## P3 — Differentiation & post-launch (not blockers)

- **Turn on rival density.** `config/features.ts` has CLUBS/EVENTS/CHAT **off** — the
  features that manufacture the local rivalry a land-grab map needs. A territory game
  with no rivals in view is a worse Strava. Sequence these on *after* P1-1 (live reward)
  so first-session retention has both density and payoff. **This is the biggest
  cold-start risk in the product.**
- **Ship AI Coach** as the premium upsell (direct analog to Strava's paywalled Athlete
  Intelligence) — already `useFeatureGate`-gated, just flagged off.
- **Battery-saver GPS mode.** `useActiveRun.ts` uses `BestForNavigation` + 1–2s
  intervals + keep-awake with no adaptive downgrade — max drain by design; add a
  lower-power mode for long runs.
- **Decide the web story.** `apps/web` is a marketing/legal/admin Next.js site with no
  running experience; `packages/shared` is effectively mobile-only. Either build a web
  running experience or drop the "cross-platform" framing and lean fully mobile.
- **Map polish (P2/P3):** fit-camera to owned zones instead of fixed `zoomLevel={13}`
  (`TerritoryMapScreen.tsx:131`), and add a legend for the freshness/ownership ramp.

---

## Suggested execution order

1. **P0 batch (one PR):** all RLS migrations (P0-1, P0-2, P0-4, P0-5, P0-8) + webhook
   tier fix (P0-3) + push-auth (P0-6) + ai-coach IDOR/cap (P0-7). Ship together — P0-1
   and P0-3 are interlocked. Plus the paused-distance leak (P2-1) since it's data
   correctness.
2. **P1 sprint:** live capture reward (P1-1), dark-mode fixes (P1-3), HUD legibility
   (P1-4), real territory-cap paywall (P1-2, client + server).
3. **P2 cleanup:** consolidate premium checks (P2-2), fix CI (P2-3), `claimEngine` tests
   (P2-4), reconcile territory models (P2-5).
4. **P3:** density flags, AI Coach, battery mode, web decision.

---

## Verification (how to prove each fix)

- **RLS fixes:** with the local anon key (Supabase running at `127.0.0.1:54321`), attempt
  the exploit before/after — e.g. `UPDATE profiles SET subscription_tier='premium'` as a
  normal user should **succeed before, fail after** P0-1; `SELECT gps_points FROM runs
  WHERE user_id != me` should return rows before, none after P0-2. Do this in the
  Supabase SQL editor authenticated as a test user (not service role).
- **Webhook tiers (P0-3):** fire a test Stripe/RevenueCat event locally (edge runtime
  must be up — it had crashed and was restarted earlier) and confirm
  `profiles.subscription_tier` becomes `'premium'` with no 500.
- **Live reward / dark mode / HUD (P1):** on-device visual check — real-device test on
  the simulator + a physical phone; toggle dark mode on Dashboard and the Run HUD.
- **Every code change:** `npx tsc --noEmit` on all three tsconfigs must stay at 0 errors;
  `npx vitest run` must stay green (and grow, once P2-4 lands).
- **CI (P2-3):** after fixing the lint glob, `npm run lint` must actually report a
  non-zero file count.
