# Runivo — Complete Feature Inventory

**Generated:** 2026-08-03 · **Method:** three parallel exhaustive code sweeps across all 18 mobile feature directories, 9 edge functions, `packages/shared`, and `apps/web`. Every entry was verified by reading the code and tracing reachability — not inferred from names.

**Legend**
`ON` user-reachable today · `OFF` feature-flagged or unreachable · `PARTIAL` partially wired
`✅` complete · `⚠️` logic issue · `🚧` midway/stub · `💀` dead code (zero importers)

**Feature flags** (`apps/mobile/src/config/features.ts`):
ON — `DASHBOARD`, `RUN_TRACKING`, `PROFILE`, `SOCIAL_FEED`, `CLUBS`, `DAILY_MISSIONS`
OFF — `EVENTS`, `GEAR_TRACKING`, `AI_COACH`, `NUTRITION_TRACKER`, `CHAT`

---

## 1. AUTH & ONBOARDING (32 files)

| # | Feature | Status | Verdict |
|---|---|---|---|
| 1 | Landing screen + CTAs | ON | ✅ |
| 2 | Sign up (email + password) | ON | ✅ |
| 3 | Sign-up validation + password strength meter | ON | ⚠️ red "over limit" style fires at 17 chars, limit is 20 |
| 4 | "Email already registered" → sign-in link | ON | ✅ brittle — matches on Supabase error copy |
| 5 | Sign-up rate limit + countdown | ON | ✅ |
| 6 | Email-confirmation-pending state | ON | ✅ |
| 7 | Sign in | ON | ✅ |
| 8 | Show/hide password | ON | ✅ |
| 9 | Forgot password (send reset email) | ON | ✅ links to web `/reset-password` |
| 10 | Reset password **in-app** | OFF | 🚧 no in-app screen; mobile users leave the app |
| 11 | Sign in with Google | ON | ✅ fragile — assumes implicit OAuth flow |
| 12 | Sign in with Apple | ON | ⚠️ uses generic web OAuth, **not** native Sign in with Apple (App Store risk) |
| 13 | Session persistence | ON | ✅ AsyncStorage + AppState auto-refresh |
| 14 | Auth-gated navigation split | ON | ✅ |
| 15 | Onboarding gate + failed-push retry | ON | ✅ |
| 16 | Onboarding 1 — goal selection | ON | ✅ |
| 17 | Onboarding 2 — age/gender/height/weight/experience | ON | ✅ only gender required |
| 18 | Onboarding 3 — weekly target + day picker | ON | ✅ |
| 19 | Onboarding 4 — city map + location permission | ON | ✅ falls back to London |
| 20 | Onboarding 5 — first mission teaser | ON | ✅ cosmetic only |
| 21 | Onboarding 6 — notification permission | ON | ✅ |
| 22 | Onboarding 7 — launch/submit | ON | ✅ reuses existing player (no data wipe) |
| 23 | Progress bar + back nav + slide transitions | ON | ✅ |
| 24 | **Dead:** `PlanSelectionStep` (full RevenueCat paywall), `AvatarStep`, `UsernameStep`, `NotificationsStep`, `ReadyStep`, `LandingFeatures` | — | 💀 ~900 lines |

## 2. RUN TRACKING (45 files — largest area)

| # | Feature | Status | Verdict |
|---|---|---|---|
| 1 | Run setup screen | ON | ✅ |
| 2 | GPS pre-lock strength indicator | ON | ✅ thresholds (20/50m) disagree with in-run 30m |
| 3 | Activity type selection (18 types) | ON | ⚠️ two disagreeing tables — 12 types silently display as "Run" |
| 4 | Route selection (saved routes) | ON | ✅ |
| 5 | Find nearby public routes | ON | ✅ PostGIS 5km |
| 6 | Clear selected route | ON | ✅ |
| 7 | Territory intel counters | ON | ✅ |
| 8 | Draggable setup sheet | ON | ⚠️ reads private RN Animated `_value` |
| 9 | Map style switching (pre-run) | PARTIAL | ⚠️ 2 of 5 styles are duplicate URLs |
| 10 | Start run | ON | ✅ double-tap guard |
| 11 | Pause / 12. Resume | ON | ✅ |
| 13 | **Auto-pause** | OFF | 🚧 setting defaults ON, **wired to nothing** |
| 14 | Elapsed time (pause-aware) | ON | ✅ |
| 15 | GPS accuracy filtering | ON | ✅ |
| 16 | GPS lock (3-fix requirement) | ON | ✅ |
| 17 | Teleport rejection | ON | ⚠️ rule duplicated in 4 places |
| 18 | Live distance / 19. pace / 20. elevation | ON | ✅ |
| 21 | Kilometre haptic | ON | ⚠️ ref reset after watcher starts → spurious tick possible |
| 22 | Background GPS (screen off) | ON | ✅ double-count + stale-run-id fixes in place |
| 23 | Background buffer drain | ON | ✅ pause-guarded |
| 24 | Orphaned task cleanup | ON | ✅ |
| 25 | Keep-awake | ON | ✅ |
| 26 | Crash checkpoints (30s) | ON | ✅ |
| 27 | Crash recovery prompt | ON | ⚠️ shows fabricated distance (`points × 3m`) |
| 28 | Crash recovery — restore run | ON | 🚧 **bypasses game engine — no territory, no PACE, no missions** |
| 29 | Discard interrupted run / 30. Cancel run | ON | ✅ |
| 31 | Live map + Kalman smoothing | ON | ✅ basemap picked once at module load |
| 32 | Ghost route following | ON | ✅ O(n) rescan per fix |
| 33 | Off-route warning / 34. near-end encouragement | ON | ✅ |
| 35 | Live territory area estimate | ON | ✅ |
| 36 | Loop-close detection | ON | ✅ |
| 37 | "Territory Claimed!" toast | ON | ⚠️ fires on *detection*, before any actual claim |
| 38 | Speed-cheat warning | ON | ⚠️ flat 5.5 m/s regardless of activity — permanent banner when cycling |
| 39 | Rival proximity alert | ON | ✅ |
| 40 | Banner precedence | ON | ⚠️ up to 3 banners can stack |
| 41 | Beat Pacer metronome | ON | ✅ degrades gracefully |
| 42 | Finish confirmation sheet | ON | ⚠️ hardcodes "0 territories" |
| 43 | Short-run guard | ON | ⚠️ `&&` logic lets a 35s/5m run through |
| 44 | Finish run (teardown + persist) | ON | ✅ |
| 45 | Failed-save retry | ON | ✅ |
| 46 | Post-run location/country refresh | ON | ✅ |
| 47 | Post-run sync | ON | ✅ offline-first |
| 48 | **Auto-post run to social feed** | ON | ⚠️ **unconditional, full GPS route, no opt-out** |
| 49 | Run analytics events | ON | ✅ no GPS in properties |
| 50 | Run summary screen | ON | ✅ |
| 51 | Historical summary (fetch-by-id) | ON | ✅ |
| 52 | Summary hero (map + stats) | ON | ✅ |
| 53 | PACE count-up / 54. breakdown / 55. cap messaging | ON | ✅ |
| 56 | Zero-PACE explanation | ON | ⚠️ says "Walks don't earn PACE" for any zero |
| 57 | Territory captured card | ON | ✅ |
| 58 | Loop-fill "park capture" indicator | ON | ✅ |
| 59 | Runner rank + progress | ON | ✅ |
| 60 | Rank-up celebration | ON | ✅ |
| 61 | Award unlock sheet | ON | ⚠️ read via untyped double-cast |
| 62 | Kilometre splits | ON | ✅ real timestamps + legacy fallback |
| 63 | Calorie estimate | ON | ⚠️ **3 different formulas across app** |
| 64 | Refuel / log calories CTA | OFF | 🚧 leads to `ComingSoon` |
| 65 | HealthKit write | ON | ✅ |
| 66 | Shoe assignment | PARTIAL | 🚧 gear flagged off → no way to create a shoe |
| 67 | Post-run AI insights | PARTIAL | ⚠️ **calls edge fn on every run despite `AI_COACH: false`** |
| 68 | Share run as story card | ON | ⚠️ **generates SVG — rejected by Instagram/WhatsApp/iMessage** |
| 69 | "Save" run card | ON | ⚠️ doesn't save; duplicate share sheet |
| 70 | Save route from run | ON | ✅ |
| 71 | Route visibility toggle | ON | ✅ **defaults to public** |
| 72 | Route icon picker | ON | ✅ |
| 73 | Run replay | ON | ⚠️ `NaN`/`Infinity` km when pace = 0; unguarded array index |
| 74 | Replay controls (play/scrub/speed) | ON | ✅ |
| 75 | Run HUD / 76. stat grid | ON | ✅ |
| 77 | **Dead:** `runSetupService` (whole file), `saveRunToSupabase`, `computeRunStats`, 7 components | — | 💀 |

## 3. TERRITORY (8 files)

| # | Feature | Status | Verdict |
|---|---|---|---|
| 1 | Territory map screen | ON | ✅ |
| 2 | Own polygons + freshness decay | ON | ✅ |
| 3 | Rival polygons (PostGIS viewport) | ON | ✅ |
| 4 | Viewport-driven loading (debounced) | ON | ✅ debounce not cleared on unmount |
| 5 | Realtime own-territory subscription | ON | ✅ |
| 6 | Filters (All/Mine/Rivals/Stale) | ON | ✅ |
| 7 | Stale count badge | ON | ✅ |
| 8 | Freshness-coloured rendering | ON | ✅ hardcoded hex — no dark mode |
| 9 | Polygon tap → detail sheet | ON | ✅ |
| 10 | Selected highlight | ON | ✅ |
| 11 | "Defend this zone" CTA | PARTIAL | 🚧 carries no zone id — becomes an ordinary run |
| 12 | Territory stats bar | ON | ✅ |
| 13 | Map style cycling (5 real styles) | ON | ✅ |
| 14 | Empty state | ON | ✅ |
| 15 | Default camera centre | ON | ⚠️ averages first vertex only; falls back to Null Island |

## 4. DASHBOARD (16 files)

| # | Feature | Status | Verdict |
|---|---|---|---|
| 1 | Dashboard screen | ON | ✅ |
| 2 | Time-of-day greeting | ON | ✅ |
| 3 | Streak badge | ON | ✅ |
| 4 | Territory Score + count-up | ON | ⚠️ one-shot ref → can show stale TS |
| 5 | Notification bell + unread | ON | ✅ |
| 6 | Sync-failure chip + retry | ON | ✅ |
| 7 | Stale-territory alert strip | ON | ⚠️ hardcoded `40` instead of config constant |
| 8 | PACE Store banner | ON | ⚠️ **`weeklyCap` hardcoded to 100 — premium users mis-measured** |
| 9 | Bento weekly ring | ON | ⚠️ rolling 7×24h window, not calendar week |
| 10 | Bento nutrition tile | OFF | 🚧 live data, leads to `ComingSoon` |
| 11 | Net calories today | PARTIAL | ⚠️ computed, passed, never rendered; 3rd calorie formula |
| 12 | Quick actions (Events/Clubs/Leaderboard) | PARTIAL | Events → `ComingSoon`; **only entry point to Leaderboard** |
| 13 | Mini territory map | ON | ✅ max 7 rivals |
| 14 | Territory cap paywall banner | ON | ✅ |
| 15 | Daily missions preview | ON | ✅ |
| 16 | Daily login bonus toast | ON | ⚠️ awards **coins** — legacy currency with no balance/spend surface |
| 17 | Recent runs + See all | ON | ✅ |
| 18 | First-run empty state | ON | ✅ |
| 19 | Pull-to-refresh | PARTIAL | 🚧 `refresh` exists, **no `refreshControl` on the ScrollView** |
| 20 | City rank | OFF | 🚧 **RPC fires every load, value never rendered** |
| 21 | Subscription tier detection | PARTIAL | 🚧 result unused |
| 22 | **Dead:** `DashboardPills`, `RunCTACard`, `TerritoryScoreBlock` + 5 unused hook outputs | — | 💀 |

## 5. HISTORY (6 files)

| # | Feature | Status | Verdict |
|---|---|---|---|
| 1 | Run history list | ON | ✅ pull-then-read |
| 2 | Cross-device sync | ON | ✅ |
| 3 | Pull-to-refresh | ON | ✅ |
| 4 | Activity filter chips (9) | ON | ⚠️ `'trail_run'` vs `'trail'` mismatch — filter never matches; 11 of 20 types unfilterable |
| 5 | Filter-aware stats | ON | ✅ |
| 6 | Run row | ON | ✅ |
| 7 | Tap → summary | ON | ✅ |
| 8 | Empty states | ON | ✅ |

## 6. LEADERBOARD (8 files)

| # | Feature | Status | Verdict |
|---|---|---|---|
| 1 | Leaderboard screen | ON | ✅ **only entry point is a dashboard tile** |
| 2 | Metric tabs (Territory/Distance/PACE) | ON | ⚠️ "PACE" tab = lifetime PACE for month/all-time |
| 3 | Timeframe tabs | ON | ⚠️ "This Month" is a rolling 30 days |
| 4 | Scope (Global/National) | ON | ⚠️ **distance national filter applied client-side after global top-100** |
| 5 | Weekly fetch | ON | ✅ |
| 6 | Month/all-time fetch | ON | ⚠️ **timeframe ignored for Territory & PACE — month == all-time** |
| 7 | Distance fetch (RPC) | ON | ✅ |
| 8 | Own-rank fallback | ON | ⚠️ **computed globally even in National scope**; rank collision → dup keys |
| 9 | Podium (top 3) | ON | ✅ **not tappable** — can't open #1's profile |
| 10 | Entry rows / 11. "You" highlight / 12. sticky footer | ON | ✅ |
| 13 | Tap → user profile | ON | ✅ list only |
| 14 | Loading & empty states | ON | ✅ |
| 15 | **Dead:** `RankBadge`, `currentUserId` round-trip | — | 💀 |

## 7. PROFILE (26 files)

| # | Feature | Status | Verdict |
|---|---|---|---|
| 1 | View own profile | ON | ✅ |
| 2 | Runner-rank progress bar | ON | ✅ |
| 3 | Edit profile | ON | ✅ |
| 4 | Change avatar photo | ON | ✅ |
| 5 | Avatar colour swatches | ON | ✅ constant duplicated |
| 6 | Profile tabs | PARTIAL | Intelligence hidden (AI_COACH off) |
| 7 | Overview hero card / 8. status pills / 9. awards strip / 10. recent runs | ON | ✅ |
| 11 | Pinned run | PARTIAL | ⚠️ **`pinned_run_id` never read back; no "Pin" UI exists** |
| 12 | Activity heatmap / 13. run list + SVG route | ON | ✅ |
| 14 | Territory tab / 15. Awards tab | ON | ✅ |
| 16 | Award detail modal | PARTIAL | 🚧 **registered route, zero callers** |
| 17 | Intelligence tab | OFF | ✅ built, flagged off |
| 18 | Followers list / 19. Following list / 20. search | ON | ✅ |
| 21 | View another user's profile | ON | ✅ |
| 22 | Follow/unfollow | ON | ✅ **different write path than the feed's RPC** |
| 23 | Message a user | OFF | 🚧 permanently disabled button |
| 24 | Settings entry | ON | ✅ |
| 25 | Notifications entry from profile | OFF | ⚠️ prop passed, never rendered |
| 26 | Followers/following counters | ON | ✅ |
| 27 | **Dead:** `StatsTab` (307 lines + live RPC), `GearTab`, `NutritionTab`, `RunsTab`, `StatRow`, 3 service fns | — | 💀 |

## 8. SOCIAL FEED (14 files)

| # | Feature | Status | Verdict |
|---|---|---|---|
| 1 | Following tab / 2. Discover tab | ON | ✅ |
| 3 | Infinite scroll / 4. pull-to-refresh | ON | ✅ |
| 5 | Kudos | ON | ✅ in-flight dedupe + rollback |
| 6 | Read comments / 7. post comment | ON | ✅ |
| 8 | Suggested runners | ON | ⚠️ labelled "near you" — **no geo predicate**, it's global top-8 |
| 9 | Follow from strip | ON | ✅ |
| 10 | Feed search | ON | ⚠️ **only filters already-loaded posts** |
| 11 | Feed post card + route hero | ON | ✅ |
| 12 | Empty states | ON | ✅ |
| 13 | Story reel (view) | ON | ✅ |
| 14 | **Create/post a story** | OFF | 🚧 **no insert path exists anywhere — reel is permanently empty** |
| 15 | Story viewer | ON | ⚠️ dead param; long-press always advances; timestamp never renders |
| 16 | **Dead:** `fetchUserStory` | — | 💀 |

## 9. MISSIONS (7 files)

| # | Feature | Status | Verdict |
|---|---|---|---|
| 1 | Browse mission templates | ON | ✅ |
| 2 | Select up to 3 | ON | ✅ |
| 3 | Save daily missions | ON | ✅ |
| 4 | Daily Blueprint (auto-generated) | ON | ✅ |
| 5 | Apply Blueprint | ON | ⚠️ **bypasses the 3-mission cap** |
| 6 | Restore selection on open | ON | ✅ title-keyed (brittle) |
| 7 | Sticky save bar | ON | ✅ |
| 8 | **Mission progress + claim reward** | OFF | 🚧 **`useMissions` + `MissionCard` have zero importers — the claim journey has no screen** |
| 9 | "Explore" goal missions | — | ⚠️ **`explorer` category has zero templates** (found by new tests) |

## 10. NOTIFICATIONS (7 files)

| # | Feature | Status | Verdict |
|---|---|---|---|
| 1 | Notification list | ON | ✅ |
| 2 | Unread badge | ON | ✅ |
| 3 | Mark one read / 4. mark all read | ON | ⚠️ errors swallowed; UI flips regardless |
| 5 | Pull-to-refresh | ON | ✅ |
| 6 | Type styling (15 types) | ON | ⚠️ hardcoded light-mode hex — no dark mode |
| 7 | Push tap → deep link | ON | ⚠️ `/run/summary/:id` discards id; `/feed` doesn't open Feed; `/events` → stub |
| 8 | Cold-start from notification | ON | ⚠️ 500ms timing assumption; can double-process |
| 9 | In-app notification routing | ON | ⚠️ same as 7 |
| 10 | Push token subscribe/unsubscribe | ON | ✅ |

## 11. SETTINGS (9 files)

| # | Feature | Status | Verdict |
|---|---|---|---|
| 1 | Edit profile link | ON | ✅ opens tab, not the edit sheet |
| 2 | Profile visibility | PARTIAL | 🚧 **`privacy` read by nothing** |
| 3 | Change password | ON | ✅ |
| 4 | Distance unit / 5. dark mode / 6. map style | ON | ✅ |
| 7 | Push master toggle | ON | ✅ |
| 8–11 | Run reminders, territory alerts, achievements, weekly summary | PARTIAL | 🚧 local-only flags, no consumers |
| 12 | Sound effects / 13. haptics | ON | ✅ |
| 14 | Auto-pause toggle | PARTIAL | 🚧 wired to nothing (see Run #13) |
| 15 | GPS accuracy / 16. countdown | ON | ✅ |
| 17 | Legal/help links | ON | ✅ |
| 18 | App version | ON | ⚠️ hardcoded `v1.0.0` twice |
| 19 | Premium upsell | ON | ⚠️ hardcoded price |
| 20 | Sign out | ON | ✅ careful ordering |
| 21 | Delete account | ON | ✅ two confirms → edge fn → cascade |
| 22 | Connected Devices — Apple Health | PARTIAL | 🚧 **no in-app link; deep-link only** |
| 23 | Connected Devices — Garmin/COROS/Polar OAuth | PARTIAL | 🚧 same; **callback URL 404s** |
| 24 | OAuth disconnect | PARTIAL | ✅ |
| 25 | OAuth manual sync | OFF | 🚧 **empty no-op handler** |
| 26 | **Dead:** `clearHistory`, `cycleDifficulty`, `cycleBeatPacerPace` (implemented, no UI) | — | 💀 |

## 12. PACE STORE (7 files)

| # | Feature | Status | Verdict |
|---|---|---|---|
| 1 | Open store | ON | ✅ |
| 2 | Balance + rank badge | ON | ✅ |
| 3 | Weekly cap progress | ON | ⚠️ always free-tier cap |
| 4 | Browse catalogue | PARTIAL | ⚠️ **only renders `rewards[0]` — all other DB rewards invisible** |
| 5 | Hardcoded reward data | ON | ⚠️ single entry shipped in binary |
| 6 | Reward detail screen | ON | ⚠️ **looks up hardcoded list only → DB rewards open a blank page** |
| 7 | Claim/redeem | OFF | 🚧 "Coming Soon" alert |
| 8 | Redeem modal | OFF | 💀 fully built, zero importers |
| 9 | "How do I earn PACE?" | ON | ⚠️ hardcoded rates can drift from config |
| 10 | Reward card | ON | ✅ |

## 13. SUBSCRIPTION (9 files)

| # | Feature | Status | Verdict |
|---|---|---|---|
| 1 | Paywall screen | ON | ✅ |
| 2 | RevenueCat configuration | ON | ✅ no-ops without keys |
| 3 | Plan selector | ON | ⚠️ **3 inconsistent hardcoded prices** |
| 4 | Live price fetch | ON | ✅ |
| 5 | Purchase / 6. restore | ON | ✅ |
| 7 | Tier detection | ON | ⚠️ **`refreshTier` defaults to `runner-plus` on failure → grants premium client-side** |
| 8 | Feature comparison lists | ON | ⚠️ **sells AI Coach / Events / Nutrition — all flagged off** |
| 9 | `useFeatureGate` | PARTIAL | 🚧 only `canClaimTerritory` used; `canUse` has zero callers |

## 14. CLUBS (17 files — flag recently ON)

| # | Feature | Status | Verdict |
|---|---|---|---|
| 1 | My clubs tab | ON | ✅ |
| 2 | Rankings tab | ON | ⚠️ search mode renders rank `0`; scope pills change only the heading |
| 3 | **Join a club** | PARTIAL | ⚠️ **`RankingRow` ignores `onJoin`; `ClubCard` (only join UI) has zero importers → cannot join from the Clubs screen** |
| 4 | Request to join (invite-only) | PARTIAL | ✅ service works, no button |
| 5 | Leave club | PARTIAL | ✅ service works, no button |
| 6 | Create club | ON | ✅ |
| 7 | Search / 8. pull-to-refresh | ON | ✅ |
| 9 | Club detail + tabs | ON | ✅ |
| 10 | Club chat (realtime) | ON | ✅ well-hardened |
| 11 | Send message / 12. chat bubbles | ON | ✅ |
| 13 | Members list / 14. club leaderboard | ON | ✅ |
| 15 | Club activity feed | PARTIAL | 🚧 **nothing writes `club_activity`** |
| 16 | Admin — edit description | ON | ⚠️ no success/failure feedback |
| 17 | Admin — change badge | ON | ⚠️ header doesn't update; two different emoji lists |
| 18 | Admin — approve / 19. reject / 20. list requests | ON | ✅ |
| 21 | Lobby room list | PARTIAL | ⚠️ **string ids vs UUIDs → counts always 0** |
| 22 | Lobby chat | PARTIAL | ⚠️ **every room opens "Global Runners"** (id mismatch) |
| 23 | Guidelines banner | ON | 🚧 static, no reporting |
| 24 | **Dead:** `ClubCard`, `LobbyRoom` type | — | 💀 |

## 15. EVENTS (9 files — flag OFF)

| # | Feature | Status | Verdict |
|---|---|---|---|
| 1 | Browse events | OFF | ⚠️ **Past tab permanently empty** (`new Date()` on a formatted string) |
| 2 | Event detail sheet | OFF | ✅ |
| 3 | Join/leave event | OFF | ⚠️ non-atomic count write; join button never rendered on cards |
| 4 | Territory-war guard | OFF | 🚧 blocks a type that isn't creatable |
| 5 | Bookmark | OFF | 🚧 local state only, never persisted |
| 6 | Share | OFF | 🚧 empty handler |
| 7 | Create event | OFF | ⚠️ unvalidated date → `RangeError`; `ends_at` hardcoded +2h |
| 8 | Permission to create | OFF | ⚠️ **checks `'empire-builder'` — a tier that no longer exists → nobody can ever create** |
| 9 | Event type picker | OFF | ✅ |
| 10 | Organizer display | OFF | 🚧 never populated |

## 16. AI COACH (22 files — flag OFF)

| # | Feature | Status | Verdict |
|---|---|---|---|
| 1 | Coach hub screen | OFF | ✅ fetches quick prompts then discards them |
| 2 | Coach chat | OFF | ✅ optimistic + rollback + retry |
| 3 | Edge-function client | PARTIAL | ✅ `requestPaceIntelligence` also used by the ON profile path |
| 4 | Training plan screen | OFF | ✅ |
| 5 | Plan state machine | OFF | ⚠️ bare `catch {}` hides all failures; duplicated consistency math |
| 6 | Consistency score | OFF | ✅ pure |
| 7 | Insight builder | OFF | ⚠️ **duplicates `computeFreshness` without `Math.floor`** → disagrees with the map |
| 8 | Weekly brief | OFF | 💀 zero callers **and** missing `{data}` unwrap |
| 9 | **Dead:** `CoachCapabilityCard`, `TrainingPlanAccordion`, `QuickPrompts` | — | 💀 |

## 17. NUTRITION (21 files — flag OFF)

| # | Feature | Status | Verdict |
|---|---|---|---|
| 1 | Calorie tracker screen | OFF | ✅ |
| 2 | Tracker state | OFF | ⚠️ **macros include run entries while kcal excludes them** |
| 3 | Setup form | OFF | ⚠️ **duplicates `computeNutritionTargets` byte-for-byte** |
| 4 | Welcome flow (6 steps) | OFF | ✅ |
| 5 | Nutrition service | OFF | ⚠️ documented SQLite fallback never runs; deleted entries can resurrect |
| 6 | Setup service | OFF | ✅ 3-tier fallback |
| 7 | Barcode + AI photo scan | OFF | ⚠️ `??`/`?:` precedence — correct only by accident |
| 8 | AI nutrition insights | OFF | ⚠️ **missing `{data}` unwrap → cards never render** |
| 9 | Rule-based nutrition context | OFF | ✅ |

## 18. GEAR / SHOE TRACKING (13 files — flag OFF)

| # | Feature | Status | Verdict |
|---|---|---|---|
| 1 | Shoe list + mileage | OFF | ⚠️ `setDefaultShoe` writes every shoe sequentially; partial failure → two defaults |
| 2 | Add shoe | OFF | 🚧 **web `fetch(fileUri).blob()` upload pattern — likely broken on device** |
| 3 | Foot scan (AI arch analysis) | OFF | ⚠️ **missing `{data}` unwrap → screen renders nothing after a billed vision call** |
| 4 | **Dead:** `ColorSwatch`, `fetchRunsForShoe` | — | 💀 |

## 19. BACKEND — Edge Functions (9)

| Function | Auth | Verdict |
|---|---|---|
| `ai-coach` (1,649 lines, 11 features) | JWT-validated | ✅ real spend caps ($0.12/day, $0.08 chat) |
| `process-run-territory` | JWT + userId match | ⚠️ **server does corridor only — no loop-fill/RDP → client and server disagree on area**; `Math.random() < 0.5` push A/B shipping |
| `send-push-notification` | service-role key only | ✅ non-constant-time compare |
| `stripe-webhook` | Stripe signature | ✅ |
| `rc-webhook` | constant-time secret | ✅ fails closed |
| `foot-scan` | JWT-validated | ⚠️ **no spend cap** (unlike ai-coach) |
| `delete-account` | JWT-validated | ✅ storage cleanup before delete |
| `device-oauth` | JWT-validated | ⚠️ **OAuth tokens stored plaintext**; **callback URL 404s** |
| `device-webhook` | HMAC (Garmin), 501 others | ⚠️ **all activities assigned to `connections[0].user_id` — cross-user corruption** |

## 20. WEB APP (`apps/web`, Next.js)

| Route | Status | Verdict |
|---|---|---|
| `/` marketing | ON | ✅ |
| `/admin` (events, promotions, store CRUD) | ON | ✅ gated on `subscription_tier === 'admin'` |
| `/privacy` · `/terms` · `/support` | ON | ✅ |
| `/reset-password` | ON | ✅ completes the Supabase recovery flow |
| `/settings/devices/callback` | **MISSING** | ⚠️ referenced by `device-oauth` — 404 |

---

## Top 15 most consequential defects

1. **Story card shares as SVG** — rejected by Instagram/WhatsApp/iMessage. Share is likely broken end-to-end.
2. **Crash-recovered runs claim no territory and earn no PACE** — game engine bypassed on the path meant to prevent loss.
3. **`device-webhook` assigns all activities to the first connected user** — cross-user data corruption with ≥2 Garmin users.
4. **OAuth tokens stored in plaintext** in `device_connections.metadata`.
5. **Cannot join a club** — the only component with a Join button has zero importers (and CLUBS is now ON).
6. **Every lobby room opens "Global Runners"** — string-id vs UUID mismatch.
7. **Premium PACE cap hardcoded to 100** on the dashboard banner.
8. **Every run auto-posts the full GPS route to the social feed**, no opt-out.
9. **Client/server territory geometry diverge** — client does loop-fill + RDP, server does corridor only.
10. **Three `{data}`-envelope unwrap bugs**: foot-scan, nutrition insights, weekly brief — all render nothing after successful (billed) AI calls.
11. **National leaderboard ranks computed globally**; national distance board near-empty by construction.
12. **"This Month" == "All Time"** for Territory and PACE tabs.
13. **Mission claim UI is dead code** — the reward journey has no screen, despite server-side crediting now working.
14. **PACE Store shows exactly one reward**; DB-sourced rewards open a blank detail page.
15. **Events can never be created** — permission checks a tier that no longer exists.

Plus: `foot-scan` has no spend cap; `useSubscription` grants premium on a read failure; auto-pause is a defaulted-ON toggle wired to nothing; ~1,700+ lines of verified dead code.

---

## Test coverage status

See `vitest.config.ts` and the suites under `packages/shared/src/`. Current: **161 tests passing**.

| Area | Coverage |
|---|---|
| `claimEngine.ts` (PACE + territory math) | ✅ 92 tests, mutation-verified |
| `missions.ts` | ✅ 30 tests |
| `passiveIncome.ts` | ✅ 10 tests |
| `store.ts` / `sync.ts` / `useGameEngine.ts` | ✅ pre-existing, 29 tests |
| `store.native.ts` / `missionStore.native.ts` | ❌ **untested — and these are what run on phones** |
| 34 mobile services | ❌ untested |
| 38 hooks, all components | ❌ out of scope (no renderer dependency) |
| Device behaviour (GPS, camera, push, IAP, maps) | ❌ not unit-testable |
