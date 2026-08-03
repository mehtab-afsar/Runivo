# Runivo — Codebase Quality & Architecture Audit

**Date:** 2026-08-03 · **Scope:** maintainability, structure, duplication, scalability. Security and UI/UX are covered separately.
**Status:** read-and-report only. **Nothing has been refactored.**

**Repo size:** 45,979 LOC · 314 mobile source files · 45 shared · 31 web · 9 edge functions · 89 migrations.

---

## SECTION 1 — DUPLICATE & DEAD CODE

### 1.1 The design system exists and is essentially unused — highest-impact finding

Import counts across all 314 mobile files:

| Component | Files importing it |
|---|---|
| `CardContainer` | **0** |
| `PACEPill` | **0** |
| `TierBadge` | **0** |
| `BottomSheet` | **0** |
| `FilterChip` | **0** |
| `RunStatRow` | **0** |
| `SectionHeader` | 1 |
| `RunnerRankBadge` | 1 |
| `PrimaryButton` | 2 |
| `Avatar` | 2 |

Total adoption: **6 imports for a 10-component library**. Worse, `SectionHeader` is *reimplemented locally* in two files with incompatible prop shapes — [OverviewTab.tsx:26](../apps/mobile/src/features/profile/components/OverviewTab.tsx#L26) takes `{title, action, onAction}`, [StatsTab.tsx:50](../apps/mobile/src/features/profile/components/StatsTab.tsx#L50) takes `{label}`, and the shared one at [shared/components/SectionHeader.tsx:18](../apps/mobile/src/shared/components/SectionHeader.tsx#L18) takes `{title, icon, action, style}`.

**Why it matters:** this is the mechanical cause of the styling inconsistency flagged in `DESIGN.md` (984 hardcoded color literals, 989 raw `fontSize` literals). The tokens and components were built; adoption never happened.

**Recommendation:** do not write new shared components. Pick the 3 highest-traffic screens (Dashboard, RunSummary, Profile) and convert their hand-rolled equivalents to the existing library, then add an ESLint `no-restricted-syntax` rule banning raw `fontSize`/hex literals in `features/**`. Measure adoption again after.

### 1.2 Utility duplication — with a shared module that already exists

`apps/mobile/src/shared/lib/formatters.ts` already exports `fmtDist`, `fmtDuration`, `fmtPace`, `fmtRelativeTime`, `fmtShortDate`. Despite that:

| Function | Local reimplementations | Locations |
|---|---|---|
| `timeAgo` | **5** | `ClubDetailScreen.tsx:96`, `CommentSheet.tsx:11`, `FeedPostCard.tsx:11`, `StoryOverlay.tsx:7`, `TerritoryTab.tsx:8` |
| `fmtTime` | **4** | `FeedPostCard.tsx:21`, `IntelligenceTab.tsx:31`, `StatsTab.tsx:32`, `ActiveRunScreen.tsx:45` |
| `relativeDate` | **3** | `RecentRunRow.tsx:13`, `OverviewTab.tsx:41`, `ActivityFeedTab.tsx:126` |
| `isoWeekStart` | **3** | `IntelligenceTab.tsx:11`, `StatsTab.tsx:12`, `useIntelligence.ts:10` |

15 copies of 4 functions. These are not identical — `fmtPace` in the shared module uses `Math.round` on the seconds remainder and can emit `"5:60"`, while `packages/shared/src/lib/paceFormat.ts:11` uses the correct `Math.floor`. **The duplicates have already drifted into producing different output.**

**Recommendation:** consolidate into `shared/lib/formatters.ts`, fix `fmtPace` to `Math.floor`, delete the 15 local copies. This is mechanical and safe — pure functions, no behaviour to preserve beyond the bug fix.

### 1.3 `WeeklyChart` written three times

Three independent bar-chart implementations with three different prop contracts:
- [IntelligenceTab.tsx:57](../apps/mobile/src/features/profile/components/IntelligenceTab.tsx#L57) — `{weeklyKm, C}`
- [StatsTab.tsx:56](../apps/mobile/src/features/profile/components/StatsTab.tsx#L56) — `{runs}`
- [CalorieTrackerScreen.tsx:25](../apps/mobile/src/features/nutrition/screens/CalorieTrackerScreen.tsx#L25) — `{weekKcals, weekAvg, goal, weekDates, C}`

**Recommendation:** one `<BarChart data={number[]} labels={string[]} goal?={number} />` in `shared/components/`. All three call sites reduce to a data transform.

### 1.4 A v1/v2 pair where v1 was never deleted

`StatsTab.tsx` (307 lines, **zero importers**) and `IntelligenceTab.tsx` (353 lines, live but behind `AI_COACH: false`) share five identical helpers: `isoWeekStart`, `fmtTime`, `riegelPredict`, `parsePaceSec`, `WeeklyChart`. `StatsTab` still carries a live Supabase RPC (`get_profile_stats`) and is the sole consumer of `StatRow.tsx`.

**Recommendation:** delete `StatsTab.tsx` + `StatRow.tsx`, and the now-orphaned `statsData`/`statsPeriod` state in `useProfile`. Verify `get_profile_stats` has no other caller before considering the RPC dead too.

### 1.5 Dead code inventory (verified zero importers)

Roughly **1,700+ lines**. Full per-feature list in [FEATURE_INVENTORY.md](FEATURE_INVENTORY.md). Highlights: 6 auth components including a complete RevenueCat paywall (`PlanSelectionStep`, ~230 lines), 7 run components, the entire `runSetupService.ts`, 3 dashboard components, `ClubCard` (the only component with a working Join button), `RedeemModal`, `useMissions` + `MissionCard`, `useWeeklyBrief`, 3 coach components, `ColorSwatch`, `RankBadge`, and 5 unused barrel files.

### 1.6 Genuine strengths — stated fairly

- **Essentially zero commented-out code** across 45,979 LOC. A grep for commented code patterns returns 2 hits, both real explanatory comments. This is unusually clean.
- **The `mkStyles(C)` theming convention is applied consistently in 143 files.** Where a convention exists, it is followed.
- **No secrets or build artifacts committed** — only `.env.example` / `.env.local.example`, plus an empty `.expo/devices.json` that should be gitignored.
- Non-obvious fixes carry long explanatory comments documenting the failure mode they prevent. This is better than most production codebases.

---

## SECTION 2 — FILE / COMPONENT BLOAT

### 2.1 22 direct Supabase calls inside `screens/` and `components/`

A service layer exists and most features use it — but **11 files bypass it entirely**. Worst offenders:

- **[ConnectedDevicesScreen.tsx:82-166](../apps/mobile/src/features/settings/screens/ConnectedDevicesScreen.tsx#L82)** — **85 lines of an entire OAuth/device API client inside a screen**: `getOAuthAuthUrl`, `completeOAuthCallback`, `disconnectOAuth`, `getAppleHealthConnection`, `saveAppleHealthConnection`, with hand-rolled `fetch()` and manual `Authorization: Bearer` construction. `features/settings/services/settingsService.ts` exists.
- **Follow/unfollow written three times** with three different shapes — `FollowersScreen.tsx:84-85`, `FollowingScreen.tsx:74`, `UserProfileScreen.tsx:75-76` — while `feedService` does the same operation via a `toggle_follow` RPC. Four implementations of one action.
- 11 of the 22 calls are just `supabase.auth.getSession()`/`getUser()` — a single `useCurrentUserId()` hook deletes half the problem.

**The tell:** `features/clubs` has a complete, correct service layer *and* `ClubDetailScreen.tsx:168-178` calls supabase directly anyway. **The architecture isn't missing — it's unenforced.**

### 2.2 Per-file responsibility breakdown

| File | Lines | What's mixed in |
|---|---|---|
| `NutritionWelcomeFlow.tsx` | 678 | **6 screen components + 5 `mkStyles` factories in one file.** ~215 lines styles, ~140 lines option tables. Six files pretending to be one. |
| `ConnectedDevicesScreen.tsx` | 635 | **7 responsibilities** — auth, HTTP client, DB writes, deep-link URL parsing, `Linking` subscription lifecycle, HealthKit orchestration, bespoke toast. Only 3 top-level decls are components. |
| `ClubScreen.tsx` | 581 | 3 style factories (~477 lines from first onward), a **158-line create-club modal** inline, a 22-entry hardcoded badge table. `RankingRow` declares `onJoin`/`onLeave` and destructures neither — the cause of the "can't join a club" bug. |
| `ClubDetailScreen.tsx` | 555 | **371-line single component, 16 `useState`s** hand-rolling 5 tabs of loading state. 4 near-identical `load*` callbacks. `loadMembers` and `loadLeaderboard` fetch **the same data twice**. |
| `RunSummaryScreen.tsx` | 524 | Best-decomposed of the large screens, but does file I/O + native share inline in JSX callbacks (390-408, 424-430) and holds rank-progression rules (`rankProgress`, `RANK_ORDER`). |
| `useActiveRun.ts` | 476 | A god-hook: permissions, wake-lock, GPS subscription, background-task bridge, AppState, 30s checkpointing, distance math, analytics, session lifecycle. Plus 2 exported persistence functions unrelated to the hook. |
| `MissionsScreen.tsx` | 465 | 303-line body. **A private 12-key theme dialect** (`T = {pageBg: C.stone, stone: C.surface, surface: C.bg…}`) existing nowhere else, plus a duplicate `TTokens` type. Recommendation algorithm inline. |
| `ActiveRunScreen.tsx` | 437 | **`doFinish` (156-227) is a 71-line post-run pipeline with 8 concerns** — the single most business-critical path in the app, living in a component. **6 `eslint-disable react-hooks/exhaustive-deps`** in one file. |
| `IntelligenceTab.tsx` | 353 | 18 top-level decls, **6 StyleSheet factories** (~265 lines). Contains `riegelPredict` — a race-prediction formula — in a profile tab. |

### 2.3 Switch chains — not a problem

Stated fairly: all 9 `switch` statements are 2-5 branches and appropriate. No god-switches. Ternary ladders reach 9 in `PrimaryButton.tsx` and `RunSummaryScreen.tsx` — worth a lookup table, not urgent.

### 2.4 The two real dumping grounds

- **`store.ts` — 749 lines, 45 exports, 8 unrelated domains**: player, runs, territories, settings, routes, **nutrition**, **shoes**, plus `matchOrCreateRun` business logic. Nutrition and gear have their own feature dirs; their persistence has no business here.
- **`sync.ts` — 972 lines, 26 exports**: includes **feed posts, likes, leaderboard, and mission progress** — all of which have their own `features/*/services/`. This is a parallel, competing data layer.

---

## SECTION 3 — ARCHITECTURE & SEPARATION OF CONCERNS

### 3.0 The pattern in use

**Feature-sliced on the surface, two god-modules underneath.** 17 of 18 feature dirs conform to `components/ hooks/ screens/ services/ types.ts` — genuinely consistent. `features/store` is the sole outlier (no barrel, no service layer, root-level `rewards.ts`).

But **feature folders own their UI, not their data**: nutrition persistence lives in `store.ts:513-619`, gear in `store.ts:620-667`, feed/leaderboard/missions remote calls in `sync.ts:853-971`. "Feature-based" is true for rendering and false for state.

### 3.1 No repository layer — `profiles` is queried from 13 different files

Table access counts across the app: `profiles` **23 call sites / 13 files**, `followers` 12, `device_connections` 11, `stories` 7, `club_members` 6, `runs` 5.

The 13 files touching `profiles` split three ways:
- **7 via a service** (`profileService`, `leaderboardService`, `feedService`, `settingsService`, `eventService`, `nutritionSetupService`, `lobbyChatService`) — the intended pattern
- **4 from hooks** (`useDashboard`, `useSubscription`, `usePlanScreen`) — bypassing services
- **2 directly from screens** ([CoachScreen.tsx](../apps/mobile/src/features/coach/screens/CoachScreen.tsx), [UserProfileScreen.tsx](../apps/mobile/src/features/profile/screens/UserProfileScreen.tsx)) — bypassing everything

This is why the same logical operation has divergent implementations — e.g. follow/unfollow is a `toggle_follow` RPC in `feedService` but a raw table insert/delete in `UserProfileScreen` and `FollowersScreen`. Two write paths for one action, already confirmed in the feature inventory.

**Recommendation:** one `profileRepository` owning every `profiles` read/write, with the follow/unfollow contradiction resolved to the RPC. Add an ESLint rule forbidding `supabase.from(` outside `**/services/**` and `packages/shared/**` — that single rule prevents regression better than any refactor.

### 3.2 No caching/query layer at all — ~20 hand-rolled fetch state machines

Verified: **no React Query, SWR, Zustand, Redux, or Apollo** in any `package.json`. Every one of the 20 hooks with a `loading` state hand-rolls `useState` + `useEffect` + `setLoading(true/false)` + `catch {}`. That is ~20 independent implementations of one state machine, and it's *why* `ClubDetailScreen` needs 16 `useState`s and fetches the same data twice.

### 3.3 State management — four mechanisms, no coordination

4 React contexts, local `useState` as the default for server state, **13 module-level mutable singletons**, plus a hand-rolled observable (`sync.ts:26 onSyncStatusChange`) used by nothing else. Most singletons are legitimate lazy-init caches.

One real inconsistency: `CoachNavContext` defaults to a silent no-op when the provider is missing; `SettingsContext` defaults to `null` and presumably throws. Two contexts, two incompatible missing-provider policies.

### 3.4 Circular dependencies — clean, and worth protecting

**No cycles.** `packages/shared` imports from `apps/mobile` **zero** times. Only 2 cross-feature edges (dashboard→notifications, dashboard→subscription), both acyclic. This is the strongest part of the architecture — add a lint rule before it rots.

**Naming hazard:** `@shared/*` → `packages/shared/src`, `@mobile/shared/*` → `apps/mobile/src/shared`. **Two directories both called "shared."** Consequence: three separate files named `pushNotificationService.ts` across the two trees, and `ConnectedDevicesScreen.tsx:22` already gave up and used a relative path.

### 3.5 Dependency injection — none, and it's why testing is blocked

`supabase` is a hardcoded singleton imported directly in **56 files**. No factory, no provider, no interface.

Measured consequence: **6 test files for 314 source files**, all confined to `packages/shared/services`. Zero component, hook, screen, or feature-service tests. The 11 screens importing supabase inline cannot be tested at all without a module-level mock that doesn't apply to them.

Also: **`packages/ui/` is an empty directory** not listed in the root `workspaces` array. Dead scaffolding.

**8 `.native.ts` twins, ~1,000 duplicated lines** — `store` (749/585), `appleHealthService`, `pushNotificationService`, `missionStore`, `haptics`, `profile`, `supabase`, `analytics`. In `store`, the *business logic* is duplicated alongside the storage driver, and **only the web variant has a test** while the native one is what ships.

### 3.6 Error handling — four uncoordinated strategies

1. **`Alert.alert`** — 40 call sites across 19 files.
2. **A toast system almost nobody uses.** `ToastProvider` (122 lines) is wired into `App.tsx` and consumed by **exactly one screen**. Meanwhile `ConnectedDevicesScreen` and `GearScreen` each define their **own local `showToast`**. Three toast implementations, one of them global and unused.
3. **Silent swallows — 53 of 216 catch blocks (25%).** Dominant idiom `catch { /* offline */ }` (17×) conflates network-down, server-rejected, and TypeError. `ClubDetailScreen.tsx:196,205,214,223` — four tabs that render empty indistinguishably from failure.
4. **45 raw `console.*` calls**, only sporadically `__DEV__`-gated, running alongside a configured Sentry.

**One `ErrorBoundary` for the whole app** — any render error blanks everything rather than one screen.

### 3.7 Cross-cutting concerns

Analytics is a clean, non-throwing abstraction — but **only 8 `track()` call sites exist**, and 3 fire from inside a JSX component rather than the service owning the event. Feature flags are a genuinely good abstraction, though **four different things in this codebase are called `FEATURES`**.

---

## SECTION 4 — SCALABILITY, WEIGHT & PERFORMANCE

### 4.1 Memoization — the biggest performance finding

**`React.memo` count across the entire mobile app: 0.** Verified. Against 238 `useMemo` and 138 `useCallback` — the codebase memoizes *values* heavily and *components* never. Every list row re-renders on every parent state change.

Unmemoized row components rendered in lists: `RecentRunRow`, `MissionRow`, `EntryRow`, `RunItem`, `FeedPostCard`.

**19 of 21 FlatLists use an inline `renderItem` arrow**, recreating the render function every parent render and defeating FlatList's internal bailout. Worst: [HistoryScreen.tsx:70](../apps/mobile/src/features/history/screens/HistoryScreen.tsx#L70) passes `ItemSeparatorComponent={() => <View/>}` — **a new component *type* every render**, forcing React to unmount and remount every separator.

**FlatList perf props across the app: 0.** No `initialNumToRender`, `windowSize`, `removeClippedSubviews`, or `getItemLayout` anywhere.

`FeedScreen` is the one screen doing it right (`useCallback` renderItem + `keyExtractor`) — and the win is cancelled because `FeedPostCard` isn't memoized, so a keystroke in its search box re-renders every visible post.

Aggregate allocation pressure: **183 inline `onPress={() => …}`** and **220 inline `style={{…}}`** literals.

### 4.2 Virtualization — unbounded `.map()` inside `ScrollView`

24 FlatLists across 16 files, but **43 files use `ScrollView`** and 32 of those pair it with `.map()`.

Genuinely unbounded (grows with user data):

| Screen | Risk |
|---|---|
| **[ActivityFeedTab.tsx:162,178](../apps/mobile/src/features/profile/components/ActivityFeedTab.tsx#L162)** | **Worst offender.** "Show more" renders *every run the user has ever logged*, each mounting an SVG polyline of that run's GPS. A 500-run user mounts 500 SVGs synchronously. |
| `DashboardScreen.tsx:195` | `recentRuns` is set unsliced from the service — no limit in the hook |
| `SplitsList.tsx:41` | one row per km — an ultra is 100+ |
| `CoachScreen.tsx:199-220` | unbounded chat history in a ScrollView, while `PaceChatModal` uses a FlatList for the same content |
| `MealSection.tsx:41`, `AwardsTab.tsx:69`, `StoryReel.tsx:24`, `CalorieTrackerScreen.tsx:305` | all user- or catalogue-driven |

### 4.3 Code splitting

**`React.lazy` count: 0.** All ~50 screens are statically imported into `AppNavigator.tsx`. The 8 `import()` calls that exist are optional-native-module guards, not splitting. Mostly acceptable for RN (Metro has no runtime chunking) — but `MapLibreGL` is the heaviest JS dependency and is statically imported at 9 sites; deferring map screens would measurably cut time-to-interactive.

### 4.4 Magic numbers outside `GAME_CONFIG`

`GAME_CONFIG` is well-built. The gaps are outside it:

- **10 hardcoded query limits** with no shared constant — `.limit(60)`, `.limit(50)`×2, `.limit(30)`, `.limit(8)`, `.limit(100)`, `.limit(2000)`. These are page sizes and belong beside `MAX_GPS_SAMPLE_POINTS`.
- **Retry backoff inline** — `sync.ts:48` `setTimeout(r, 1000 * Math.pow(2, i))`. The offline-sync backoff, buried at line 48 of a 972-line file, not tunable.
- **5 map tile URLs across 4 files** — three different basemap styles for one product, chosen per-file. A CDN outage means editing 3+ files.
- **7 hardcoded `https://runivo.app/…` URLs.** No `WEB_BASE_URL` constant; a domain change is a 7-file grep.

### 4.5 SDK abstraction — 3 of 5 clean

| SDK | Direct sites | Verdict |
|---|---|---|
| Sentry | 1 | ✅ clean wrapper |
| PostHog | 2 (the platform pair) | ✅ no consumer imports posthog |
| RevenueCat | 1, lazy | ✅ clean facade |
| **MapLibre** | **9 files** | ❌ no wrapper — and **two different aliases for the same import** (`ML` in 3 files, `MapLibreGL` in 6) |
| **Supabase** | **56 files** | ❌ hardcoded singleton, no injection point (see §3.5) |

### 4.6 Dependency weight

Verified by grep:

| Dependency | Usages | Verdict |
|---|---|---|
| `lucide-react-native` | **0** | Remove — `phosphor-react-native` (94) is the real one. Two icon libraries shipped. |
| `expo-secure-store` | **0** | Remove — auth deliberately uses AsyncStorage. |
| `react-native-web`, `@expo/metro-runtime`, `metro-runtime` | **0 / 0 / 0** | Remove the whole web-support trio. |
| `h3-js` + `text-encoding` + `shims/h3-js.js` | comment only | Remove — `text-encoding` exists *solely* to polyfill h3-js; the shim is still wired in `metro.config.js:78-80`. |
| `idb` + `store.ts` (749 lines) | web-only | Maintained for a consumer that doesn't exist — `apps/web` never imports `@runivo/shared`. |

**Phantom dependencies:** `packages/shared` declares 4 deps but imports **10 undeclared packages** (`expo-sqlite`, `expo-notifications`, `posthog-js`, `react-native`, …), resolving only via workspace hoisting. Meanwhile the one heavy dep it *does* declare — `h3-js` — has zero imports.

**Version drift:** `@supabase/supabase-js` is `^2.99.3` in mobile vs `^2.38.0` in web — ~60 minor versions apart in one lockfile.

**Duplicated modules with a dead twin:** `haptics` (theme version live at 171 sites; `packages/shared/lib/haptics*` has 0 importers), `pushNotificationService` (mobile copy has 0 importers), `Avatar` (two live copies at two paths), `sentryScrub` (near-identical in mobile and web, neither in `packages/shared`).

**Two parallel sound systems:** `theme/sounds.ts` is live; `shared/audio/sounds.native.ts` (123 lines) + `generate-sounds.js` have **zero importers**, and of its 13 `.wav` files only `click.wav` is reachable — **12 orphaned audio files, 188 KB, shipping in the bundle.**

---

## SECTION 5 — HYGIENE

### 5.1 A stale full copy of the repo is committed

```
160000 ef05db51... 0   .claude/worktrees/funny-agnesi-e6456d
```

Mode `160000` is a **gitlink (submodule pointer)** — and **there is no `.gitmodules` file**. Confirmed. It's a dangling entry committed on 2026-05-07 in a commit titled `chanhes`. On disk it's a complete ~3-month-stale duplicate of the entire monorepo, including files that no longer exist upstream (`vite.config.ts`, `playwright.config.ts`).

Consequences: `git clone` produces a broken empty directory; every repo-wide grep returns doubled results; stale code reads as current. It's already excluded from both ESLint and vitest configs — evidence someone tripped over it and worked around it rather than removing it.

**Fix:** `git rm --cached .claude/worktrees/funny-agnesi-e6456d`, gitignore the path, delete the directory.

### 5.2 CI IS NOT ENFORCING WHAT IT APPEARS TO

Two independent breaks in [.github/workflows/ci.yml](../.github/workflows/ci.yml):

**1. The lint step matches zero files.**
```yaml
run: npx eslint apps/web/src --ext .ts,.tsx --max-warnings 0
```
`apps/web/src` **does not exist** — web code lives in `apps/web/app`, `components/`, `lib/`. The root `package.json` lint script was fixed to the correct paths; **CI was never updated**. Mobile and shared are not linted in CI at all.

**2. Tests never run.**
```yaml
if grep -q '"test"' packages/shared/package.json; then npm test ...; else echo "skipping"; fi
```
`packages/shared/package.json` has `"scripts": {}` — **no test script exists**. The guard always fails, CI prints "skipping", and the job passes green. **The 161 tests currently in the repo have never run in CI and will not until this is fixed.**

**Recommendation (do this first — it is ~5 lines and protects every other fix):**
```yaml
- run: npx vitest run                      # root config already globs both workspaces
- run: npm run lint                        # the root script has the correct paths
```
Plus add `"test": "vitest run"` to `packages/shared/package.json` or drop the guard entirely.

---

### 5.3 Naming, TODOs, comments — genuinely good

- **Zero** `.tsx` files not PascalCase; **zero** `.ts` files that are PascalCase or snake_case. The 237 `snake_case` identifiers are all Supabase column names — correct, they're the DB contract.
- **Zero TODO / FIXME / HACK / XXX comments** in the entire codebase. Nothing to age-date.
- Comment quality is above average: `config.ts:9-15` explains *why* two GPS thresholds deliberately differ; `index.ts` explains all four polyfills and their ordering constraints.
- 2 `console.log` remaining, 29 `as any`, 54 suppressions — the suppressions are overwhelmingly one pattern (`exhaustive-deps` on mount-once animation effects, ~13 in auth components), which argues for a shared `useMountAnimation` hook rather than indicating rot.

### 5.4 Async patterns — modern-first, two real problems

465 `await` vs 41 `.then(` — healthy. `.then()` is concentrated in one recognisable idiom: kicking a promise off from a synchronous `useEffect`.

**Problem 1 — a silently discarded write.** [usePlanScreen.ts:154](../apps/mobile/src/features/coach/hooks/usePlanScreen.ts#L154):
```ts
}, { onConflict: 'user_id,week_start' })).then(() => {}).catch(() => {});
```
A training-plan **save** whose failure is thrown away — no toast, no Sentry. The user believes it saved.

**Problem 2 — 8 duplicate auth round-trips on cold start.** `supabase.auth.getUser()`/`getSession()` is called independently from 8 different hooks/screens. A single `useCurrentUserId()` hook collapses all eight — a real startup-latency win, not just tidiness.

`@typescript-eslint/no-floating-promises` is **not enabled** (it needs type-aware linting, which the config doesn't set up), so Problem 1 cannot be caught mechanically today.

### 5.5 Documentation

**No root `README.md`.** The only README is Expo-generated. A new engineer cloning this has no setup steps and no way to discover that `npx vitest` is the only way to run the tests.

`docs/` holds 4 files; three are ~4 weeks stale. Deep/inline documentation is strong; entry-level documentation is absent.

### 5.6 Orphaned assets

Two Android icons are bundled but never referenced — `android-icon-background.png` (config sets `backgroundColor`, never `backgroundImage`) and `android-icon-monochrome.png` (themed icons never enabled). Plus the 12 orphaned `.wav` files in §4.6.

---

---

## CURRENT ARCHITECTURE — in one paragraph

Runivo is a feature-sliced React Native app with a genuinely clean dependency graph — no circular imports, a strict one-way `apps → packages` flow, and 17 of 18 feature directories following an identical `screens/hooks/services/components` shape. Underneath that surface, though, the data layer never got built: there is no repository abstraction, no query/caching library, and no dependency injection, so `supabase` is a hardcoded singleton imported directly in 56 files and ~20 hooks each hand-roll the same loading/error state machine. Two god-modules — `store.ts` (749 lines, 8 unrelated domains) and `sync.ts` (972 lines, including feed/leaderboard/mission logic that duplicates the feature services) — hold the state that the feature folders appear to own. The result is an architecture that is *present but unenforced*: `features/auth` and `features/clubs` are textbook screen→hook→service splits, while eleven screens bypass their own working service layer to call Supabase inline, four different code paths implement follow/unfollow, and a complete ten-component design system sits at six total imports. The codebase is not messy in the usual sense — there's almost no commented-out code, conventions are followed where they exist, and the hard parts (GPS geometry, offline sync, anti-cheat) are carefully written and well-commented. It's under-*enforced* rather than under-*designed*, which is a much cheaper problem to fix.

---

## DUPLICATION & BLOAT SCORE

| Metric | Value |
|---|---|
| Verified dead code | **~1,700 lines ≈ 3.7% of the codebase** |
| Components with a near-duplicate elsewhere | **~10%** (`WeeklyChart` ×3, `SectionHeader` ×3, toast ×3, `StatsTab`/`IntelligenceTab`, `RunsTab`/`ActivityFeedTab`, `NotificationsStep`/`NotificationPermissionStep`, `ClubCard`/`RankingRow`) |
| Duplicated utility implementations | **15 copies of 4 functions** — with a shared module that already exports them |
| Files >300 lines | **26 of 400** (6.5%); 9 mobile screens >400 lines |
| `.native.ts` platform twins | 8 pairs, **~1,000 lines**, business logic duplicated alongside the storage driver |
| Design-system adoption | **6 imports across 10 components** |
| Test coverage | **6 test files / 314 source files** |
| Silent `catch` blocks | **53 of 216 (25%)** |

Headline: **roughly 12–15% of this codebase is duplicate or dead.** That is high, but it is concentrated — four fixes (delete dead code, consolidate formatters, adopt the design system, split the two god-modules) would recover most of it.

---

## THE 5 HIGHEST-LEVERAGE CLEANUPS, RANKED

**1. Fix CI — ~15 minutes, and it protects every other item on this list.**
Add `"test": "vitest run"` to root `package.json`, make the test step unconditional, and point the lint step at `npm run lint` (the root script already has correct paths). Right now 161 tests never run and the lint step targets a directory that doesn't exist. *Everything else you fix is currently unprotected.*

**2. Memoize the list layer — ~1 day, biggest user-visible win.**
Zero `React.memo`, 19 inline `renderItem`s, zero FlatList perf props. Wrap the 5 row components, hoist the renderItems into `useCallback`, make `ItemSeparatorComponent` a module constant, add `windowSize`/`removeClippedSubviews` to feed, leaderboard and history. Fix `ActivityFeedTab` first — it renders every run a user has ever logged, each as an SVG polyline, inside a ScrollView.

**3. Close the service-layer bypass + one ESLint rule — ~1 day, and it stops the bleeding permanently.**
Move the 22 screen-level Supabase calls into the feature services that already exist, add `useCurrentUserId()` (deletes 11 of them and 8 duplicate cold-start auth round-trips), and ban `supabase` imports outside `**/services/**`. This is the rule that prevents the four-implementations-of-follow/unfollow class of bug from recurring.

**4. Delete the dead weight — ~half a day, near-zero risk.**
The committed stale repo copy (`.claude/worktrees/`), 6 unused dependencies, 12 orphaned `.wav` files, 2 orphaned icons, `StatsTab.tsx`, the dead `haptics`/`pushNotificationService`/`sounds.native` twins, and the empty `packages/ui`. All verified by grep. ~1,700 lines plus ~190 KB of bundle.

**5. Make Supabase injectable — the unlock for everything else.**
6 test files for 314 source files is not a discipline problem, it's a structural one: a hardcoded singleton in 56 files with no injection point makes the 11 screens that import it inline *untestable by construction*. A context + `useDb()` shipped feature-by-feature (start with `clubs`, which has the cleanest service layer) is what lets the test suite grow past `packages/shared`.

**Deliberately not in the top 5:** splitting the god-files (`NutritionWelcomeFlow`, `ClubDetailScreen`) and adding a query library. Both are correct and worth doing — but they're large, they touch working code, and they should come *after* CI is enforcing and tests can actually run. Refactoring on autopilot before the safety net works is how working features break.
