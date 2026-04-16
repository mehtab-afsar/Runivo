# Runivo — Complete Technical Documentation

> Last updated: 2026-04-06  
> Platforms: Web (React/Vite) · Mobile (Expo/React Native)  
> Backend: Supabase (Postgres, Auth, Realtime, Storage, Edge Functions)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Tech Stack](#2-tech-stack)
3. [Onboarding & Authentication](#3-onboarding--authentication)
4. [Dashboard](#4-dashboard)
5. [Active Run](#5-active-run)
6. [Run Summary](#6-run-summary)
7. [History](#7-history)
8. [Social Feed](#8-social-feed)
9. [Stories](#9-stories)
10. [Clubs & Lobby Chat](#10-clubs--lobby-chat)
11. [Leaderboard](#11-leaderboard)
12. [Territory Map](#12-territory-map)
13. [Profile & Stats](#13-profile--stats)
14. [AI Coach](#14-ai-coach)
15. [Calorie Tracker](#15-calorie-tracker)
16. [Gear / Shoe Tracker](#16-gear--shoe-tracker)
17. [Settings](#17-settings)
18. [Game Mechanics Reference](#18-game-mechanics-reference)
19. [Shared Services & Data Layer](#19-shared-services--data-layer)
20. [Supabase Schema Reference](#20-supabase-schema-reference)
21. [Edge Functions](#21-edge-functions)
22. [Mobile-Only Features](#22-mobile-only-features)
23. [Web-Only Features](#23-web-only-features)

---

## 1. Architecture Overview

Runivo is a **gamified running app** where players run real streets to claim hexagonal territory zones, earn XP, level up, and compete on a leaderboard. It ships as a web app and a React Native mobile app sharing a common `packages/shared` layer.

```
Runivo/
├── apps/web/            React 19 + Vite + TailwindCSS + MapLibre GL
├── apps/mobile/         Expo 55 + React Native 0.83 + MapLibre RN 10
└── packages/shared/     Cross-platform services, hooks, types
    ├── services/        store, sync, claimEngine, supabase, config …
    └── hooks/           useGameEngine, useAuth, usePlayerStats …

Backend:
    Supabase (Postgres + RLS + Realtime + Storage + Edge Functions)
    Anthropic Claude API (via ai-coach Edge Function)
    RevenueCat (in-app subscriptions)
    Stripe (web subscriptions)
```

**Monorepo tooling:** npm workspaces. All packages share the same `node_modules`.

**Offline-first:** Every write goes to IndexedDB (web) / SQLite (mobile) first, then synced to Supabase when online. Local state is authoritative while offline.

---

## 2. Tech Stack

### Web — `apps/web`

| Category | Library | Version |
|---|---|---|
| UI framework | React | 19.2 |
| Build tool | Vite | 4.5 |
| Routing | React Router DOM | 6.20 |
| Styling | TailwindCSS | 3.3 |
| Animation | Framer Motion | 12.23 |
| Map | MapLibre GL | 5.8 |
| Icons | Lucide React | 0.544 |
| Audio | Howler.js | 2.2 |
| Screenshot | html-to-image | 1.11 |
| Backend | Supabase JS | 2.98 |
| Hexagons | H3-JS | 4.4 |
| Local DB | IDB (IndexedDB) | 8.0 |

### Mobile — `apps/mobile`

| Category | Library | Version |
|---|---|---|
| Framework | Expo | 55.0 |
| React Native | React Native | 0.83 |
| Navigation | React Navigation | 7.1 |
| Map | @maplibre/maplibre-react-native | 10.4 |
| GPS | expo-location | 55.1 |
| Audio | expo-av | 16.0 |
| Haptics | expo-haptics | 55.0 |
| Notifications | expo-notifications | 55.0 |
| Health | @kingstinct/react-native-healthkit | 13.3 |
| Local DB | expo-sqlite | 55.0 |
| Secure store | expo-secure-store | 55.0 |
| Animations | react-native-reanimated | 4.2 |
| Backend | Supabase JS | 2.99 |
| Subscriptions | RevenueCat | — |
| Fonts | Barlow + Playfair Display (Google Fonts) | — |

### Shared — `packages/shared`

H3-JS, IDB, Supabase JS, React hooks. No React Native or DOM dependencies — isomorphic.

---

## 3. Onboarding & Authentication

### 3.1 Auth

**Backend:** Supabase Auth (email + password). No social OAuth in production.

**Web files:**
- `apps/web/src/features/landing/pages/LoginPage.tsx`
- `apps/web/src/features/landing/pages/SignUpPage.tsx`

**Mobile files:**
- `apps/mobile/src/features/auth/screens/LoginScreen.tsx`
- `apps/mobile/src/features/auth/screens/SignUpScreen.tsx`
- `apps/mobile/src/features/auth/hooks/useLogin.ts`
- `apps/mobile/src/features/auth/hooks/useSignUp.ts`

**Sign-up validation:**
- Username: 3–20 characters
- Email: regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- Password: minimum 8 chars (web shows 3-level strength bar: red <6, orange <10, green ≥10)

**On successful sign-up:**
1. Supabase creates auth user
2. DB trigger auto-creates `profiles` row
3. App navigates to Onboarding if `runivo-onboarding-complete` flag is absent
4. On completion, calls `initializePlayer()` → `pushProfile()` → redirects to Home

**Session management:**
- Storage key: `runivo-auth`
- `persistSession: true`, `autoRefreshToken: true`
- `supabase.auth.onAuthStateChange()` drives navigation on all platforms

---

### 3.2 Onboarding

**Web:** `apps/web/src/features/onboarding/pages/OnboardingFlow.tsx`  
**Mobile:** `apps/mobile/src/features/auth/screens/OnboardingScreen.tsx`  
**Hook:** `useOnboarding.ts`  
**Service:** `onboardingService.ts`

**Steps (both platforms):**

| # | Step | Data Collected |
|---|---|---|
| 1 | Experience | "Just starting" / "Casual" / "Regular" / "Competitive" |
| 2 | Avatar / Biometrics | Gender, height (cm), weight (kg), age |
| 3 | Primary Goal | get_fit / lose_weight / run_faster / explore / compete |
| 4 | Target | Weekly run days (1–7), preferred distance (short/5K/10K/long), weekly goal km |
| 5 | Notifications | Push notifications toggle |
| 6 | Ready Screen | Summary + confirmation |

**Web-only step:** `BiometricsStep.tsx` also collects DOB.

**On completion:**
- `saveProfile()` — writes to IndexedDB + Supabase `profiles`
- `saveSettings()` — writes preferences
- `initializePlayer()` — seeds player game state
- `seedTerritoryData()` — creates starter territory hexes around user location
- `computeWeeklyGoal()` — calculates target km from profile
- `pushProfile()` — syncs to server

---

## 4. Dashboard

### Web — `apps/web/src/features/dashboard/pages/Dashboard.tsx`

**Sections rendered:**
- Greeting header with level badge + XP ring
- **Hero carousel** — weekly goal card + calorie summary card (swipeable)
- Quick stats: distance this week, territories owned, streak
- "Start Run" primary CTA
- Daily missions row (today's 3 missions)
- Leaderboard preview (top 3)
- Territory map mini-card
- Recent activity feed (last 5 runs)
- AI weekly brief card (from Coach)

**Data hooks:**
- `usePlayerStats()` — level, XP, streaks
- `useWeeklyBrief()` — AI coaching summary
- `getRuns()` + `getAllTerritories()` + `getSettings()` from shared store

---

### Mobile — `apps/mobile/src/features/dashboard/screens/DashboardScreen.tsx`

**Sections rendered:**
- `DashboardPills` — compact stat row
- **HeroCarousel** — paged horizontal `ScrollView` with 2 cards:
  1. Weekly goal: km progress bar + % complete
  2. Calorie tracker: consumed/goal + tap → CalorieTracker screen
- `BentoCard` — quick action grid (Territory Map, Leaderboard, Clubs, Coach)
- `WeeklyRing` — animated ring for weekly distance goal
- `DailyBonusCard` — login streak + coin reward
- Mission cards
- Recent runs row

**Key difference:** Mobile uses native `ScrollView` + paging for carousel vs Framer Motion swipe on web.

---

## 5. Active Run

This is the core feature of the app. It tracks a live GPS run, powers the territory claiming engine, and provides a HUD with real-time stats.

### 5.1 GPS Tracking

**Web:** `navigator.geolocation.watchPosition()`  
**Mobile:** `expo-location` → `Location.watchPositionAsync()`

**GPS settings (mobile):**
- Accuracy: `BestForNavigation`
- Time interval: 1000ms
- Distance interval: 3m minimum

**GPS point structure:**
```typescript
interface GPSPoint {
  lat: number;
  lng: number;
  timestamp: number;   // epoch ms
  speed: number;       // m/s
  accuracy: number;    // metres
}
```

**Noise filtering:**
- Rejects jumps >100m (teleport artifact)
- Rejects points with accuracy >30m (configurable)
- Minimum 1m delta to count toward distance

**Background tracking (mobile only):**
- `expo-task-manager` registers `LOCATION_TASK_NAME`
- Points written to SQLite `bg_gps_buffer` table while screen is off
- On foreground: `drainBgGpsBuffer()` merges buffered points into run state

**Screen-on:**
- Web: `navigator.wakeLock.request('screen')`
- Mobile: `expo-keep-awake` → `activateKeepAwakeAsync()`

---

### 5.2 Live Map

**Web:** MapLibre GL with CartoDB Positron, 45° pitch, bearing-locked to direction  
**Mobile:** `@maplibre/maplibre-react-native` component — `ActiveRunMapView.tsx`

**Trail rendering (both platforms):**
- Colour: `#E8391C` (orange-red)
- Main line: 3px solid, 0.9 opacity
- Glow layer: 6px, 0.25 opacity
- Camera: auto-follows latest GPS point (800ms flyTo on mobile)
- Map style: CartoDB Dark Matter (dark during run for contrast)

---

### 5.3 HUD (Heads-Up Display)

**Component:** `RunHUD.tsx`

| Stat | Calculation | Format |
|---|---|---|
| Distance | Haversine sum of valid GPS deltas | `5.32 km` |
| Pace | `1 / (km/sec)` → min:sec/km | `5:07 /km` |
| Elapsed | `(Date.now() - startTime - pausedMs) / 1000` | `27:14` |
| Energy | Fetched from server on start, decremented per claim | `7 / 10` |
| Claim % | Hex dwell progress | `68%` |

---

### 5.4 Controls

**Components:** `RunControls.tsx`, `FinishConfirmSheet.tsx`

- **Start:** Large red play button (72×72px, shadow glow)
- **Pause / Resume:** Toggle during run
- **Stop:** Opens `FinishConfirmSheet` — shows distance, time, territories claimed, confirm/cancel
- **Minimum check:** < 50m or < 30s → shows alert ("You haven't run far enough. End anyway?")

---

### 5.5 Territory Claiming Engine

**Service:** `packages/shared/src/services/claimEngine.ts`  
**Hook:** `packages/shared/src/hooks/useGameEngine.ts`

**Mechanism:**
1. GPS position → H3 cell index at **resolution 9** via `latLngToCell(lat, lng, 9)`
2. Track milliseconds in current hex (`hexDwellMs`)
3. Progress: `min(100, dwellMs / 60_000 * 100)` — 60 seconds = 100%
4. Emits `claim_progress` event every 10 seconds
5. At 100%: checks player has ≥1 energy, then fires `claim_territory` RPC
6. Server validates GPS proof (≥3 points, ≥30sec span, speed ≤12 m/s)
7. Server atomically deducts 1 energy, marks hex as owned
8. Client emits `claimed` event → toast + haptic

**Visual feedback:**
- `ClaimProgressRing` — circular ring bottom-right corner, `#E8391C` text (mobile)
- `ClaimToast` — center-screen pill, red bg, "Territory Claimed! +25 XP", fades after 3s
- `claimProgress` fill bar at top of run screen (web + mobile)

**Energy blocked:**
- Banner: "Energy depleted — run to regenerate"
- Running earns 1 energy/km in real-time
- `energy_blocked` event freezes progress at 100%

---

### 5.6 Beat Pacer (Sound Metronome)

**Component:** `BeatPacerChip.tsx`  
**Hook:** `apps/mobile/src/features/run/hooks/useBeatPacer.ts`  
**Audio file:** `click.wav` (loaded via `expo-av`)

**How it works:**
- BPM derived from target pace string (e.g. `"5:00"` → 172 BPM)
- Scheduler: `setInterval` every 25ms, looks ahead 100ms for upcoming beats
- `Audio.Sound.createAsync(require('click.wav'))` loaded once on mount
- `setPositionAsync(0)` + `playAsync()` fires on each beat tick
- Pauses on app background (`AppState` listener)
- Pulse animation: `Animated.loop` scales the dot 1→1.5 at BPM rate

**BPM lookup table:**

| Pace | BPM |
|---|---|
| 3:30 /km | 185 |
| 4:00 /km | 180 |
| 5:00 /km | 172 |
| 6:00 /km | 163 |
| 7:00 /km | 155 |

Persisted in settings: `beatPacerEnabled`, `beatPacerPace`, `beatPacerSound` (click/woodblock/hihat).

**HUD chip:** Shows BPM number + red pulse dot + 🔊/🔇 mute toggle. Appears top-right of screen while running.

---

### 5.7 Post-Run Data Flow

```
finishRun()
  │
  ├─ useGameEngine.endRunSession()
  │    ├─ Downsample GPS to max 200 pts
  │    ├─ bufferPath() → 40m-wide corridor polygon (20m each side)
  │    ├─ polygonAreaM2() → area in m² via shoelace formula
  │    ├─ XP = (km × 30) + territory XP (25 neutral / 60 enemy)
  │    ├─ Calculate streak, level, missions, achievements
  │    └─ Return RunResult + StoredTerritory[]
  │
  ├─ saveRun() → IndexedDB (synced: false)
  ├─ saveTerritories() → IndexedDB
  │
  └─ postRunSync()
       ├─ pushUnsyncedRuns() → Supabase `runs` table
       │    └─ GPS compressed via Ramer-Douglas-Peucker (ε ≈ 5m)
       ├─ pushProfile() → Supabase `profiles`
       ├─ DB trigger fires → increments total_runs, total_distance_km
       ├─ pullProfile() → canonical server state
       └─ pullRuns() → refresh history
```

---

## 6. Run Summary

**Web:** `apps/web/src/features/run/pages/RunSummary.tsx`  
**Mobile:** `apps/mobile/src/features/run/screens/RunSummaryScreen.tsx`  
**Hook:** `useRunSummary.ts`

### Sections

| Section | Detail |
|---|---|
| **Heading** | "Run Complete" / "Territory Conquered" / "Territory Defended" / "Territory Fortified" — driven by `actionType` |
| **Route minimap** | Static MapLibre map. Red polyline `#E8435A` 4px + 14px glow. Green start dot, red end dot. Auto-fits bounds. Non-interactive on mobile. |
| **Stat grid** | Distance (km), Time (h:mm:ss), Avg Pace (/km), Territories Claimed |
| **Splits** | Per-km pace breakdown, up to 20 splits, computed from GPS timestamps |
| **Rewards card** | XP earned, coins, territory count. Level-up animation if leveled. |
| **AI Insights** | `PostRunInsightsCard` — calls `ai-coach` with `feature: 'post_run'`. Returns `praise`, `analysis`, `suggestion`, `recovery?`. Falls back to rule-based text while loading. |
| **Shoe chip** | Default shoe name + total km worn. Tap → `ShoeDrawer` to switch. |
| **Fuel card** | "You burned ~X kcal" (estimate: `km × 60 × 0.95`). "+ LOG" navigates to CalorieTracker with `burnKcal` pre-filled. |
| **Level-up overlay** | Full-screen overlay if `leveledUp: true`. Auto-dismisses. |
| **Save Route sheet** | Name input, emoji picker (12 options), public/private toggle. Saved via `saveSavedRoute()` + `pushSavedRoutes()`. |

### Auto Story Upload

1500ms after screen mounts (fire-and-forget):
- **Web:** `html-to-image` captures `storyCardRef` DOM node → PNG data URL
- **Mobile:** `buildStoryDataUrl()` generates SVG card (400×700) with run stats, base64 encoded
- `uploadStory(dataUrl, runId)` → Supabase storage bucket `stories` + row in `stories` table
- Errors silently swallowed

---

## 7. History

**Web:** `apps/web/src/features/history/pages/History.tsx`  
**Mobile:** `apps/mobile/src/features/history/screens/HistoryScreen.tsx`

**Filter chips (both platforms):**
All · Run · Walk · Hike · Trail Run · Cycle · Interval · Tempo · Race

**Run card fields:**
- Activity type icon + label
- Distance (km), duration, avg pace
- Date — relative ("Today", "Yesterday", "3 days ago") or absolute if older
- Territories claimed, XP earned

**Header summary:** Total km (filtered), total runs, avg distance

**Data:** `getRuns()` from IndexedDB, filtered by `activityType` in `useMemo`. Synced from server via `pullRuns(100)` on mount.

---

## 8. Social Feed

**Web:** `apps/web/src/features/social/pages/Feed.tsx`  
**Mobile:** `apps/mobile/src/features/social/screens/FeedScreen.tsx`  
**Hook:** `useFeed.ts`

### Story Reel

Horizontal scrollable strip at top. Each avatar shows a coloured ring if the user has an active story (< 24h old).

- Fetched via `fetchActiveStoriesForUsers(userIds)` from `storiesService`
- Tap → `StoryViewerScreen` / `/story-viewer`
- 24h expiry enforced by Supabase `expires_at` column

### Feed Tabs

**Explore** — all public posts · **Following** — posts from followed users

### Post Card

- Avatar: first letter of username + `avatarColor(username)` (deterministic color from name)
- Username, level badge
- Run stats: distance, time, pace, territories, XP
- Badges: PR 🏆, zones ⚡, streak 🔥, level-up 🎉
- Inline route minimap (if route data available)
- **Reactions:** ❤️ Kudos · 🔥 Fire · 👑 Crown · 💪 Muscle — tap to toggle
- Comment count, relative timestamp

**Reaction storage:** `kudos` table — `{ from_id, to_id, run_id, emoji }`

### Post Detail Sheet (Mobile)

Tap or long-press post → bottom sheet:
- Full stat breakdown
- All 4 reaction buttons with counts
- Share button

---

## 9. Stories

**Web viewer:** `apps/web/src/features/story/pages/StoryViewer.tsx`  
**Mobile viewer:** `apps/mobile/src/features/social/screens/StoryViewerScreen.tsx`

**Story format:** PNG/SVG image, 400×700px, 24h expiry, optionally linked to `run_id`.

**Auto-generated story card:**
- "RUNIVO" brand label (top)
- Italic run heading
- Large distance + time
- Avg pace in accent colour
- "+XP" coloured pill
- "tracked on runivo" footer

**Accent colours by run type:**
- Attack: `#E8391C` · Defend: `#1A6B40` · Fortify: `#F59E0B` · Training: `#0A0A0A`

**Viewer behaviour:** auto-advances after 5s · tap left/right to navigate · progress bar per story · swipe down to dismiss

---

## 10. Clubs & Lobby Chat

### Clubs

**Web:** `apps/web/src/features/club/pages/Club.tsx`  
**Mobile:** `apps/mobile/src/features/clubs/screens/ClubScreen.tsx`

**Tabs:** My Clubs | Rankings

**Club card:** emoji badge, name, member count, total territory km, join/leave button  
**Join policies:** `open` (instant) · `request` (approval needed) · `invite` (invitation only)  
**Create club:** name, description, emoji (30+ options), join policy

**Club detail:** member list with levels, club leaderboard, realtime chat

---

### Lobby Chat

**Web:** `apps/web/src/features/lobby/pages/LobbyChat.tsx`  
**Mobile:** `apps/mobile/src/features/clubs/screens/LobbyChatScreen.tsx`  
**Service:** `lobbyChatService.ts` · **Hook:** `useLobbyChat.ts`

**Predefined rooms:** 🌍 Global Runners · 🏃 Training Talk · 🏆 Race Reports · ⚡ Speed & Intervals · 🌙 Night Runners

**Message bubble:**
- Others: avatar left, name + level badge + timestamp
- Own messages: right-aligned, red background `#D93518`, white text

**Realtime:** Supabase channel `lobby-{lobbyId}` subscribes to `lobby_messages` INSERT events — messages appear instantly.

**Reactions (mobile):**
- Long-press bubble → emoji picker modal: ❤️ 🔥 💪 👏 🤣 😮
- `reactToMessage(messageId, emoji, userId)` → upserts/deletes `lobby_message_reactions`
- Toggle logic: same emoji again = remove reaction
- Reaction badges rendered below bubble with count

---

## 11. Leaderboard

**Web:** `apps/web/src/features/leaderboard/pages/Leaderboard.tsx`  
**Mobile:** `apps/mobile/src/features/leaderboard/screens/LeaderboardScreen.tsx`  
**Hook:** `useLeaderboard.ts` · **Service:** `leaderboardService.ts`

### Filters

| Filter | Options |
|---|---|
| Metric | Distance (km) · XP · Zones |
| Timeframe | This Week · This Month · All Time |
| Scope | 🌍 Global · 🏳 National · 📍 Local |

**Data source:**
- Week: `leaderboard_weekly` table (precomputed — username, level, weekly_xp, weekly_km, weekly_territories, rank)
- Month / All-time: live aggregation of `runs` + `profiles`
- National/Local: filters `profiles` by `country` column

### Podium

Top 3 shown as a visual podium:
- Order: [🥈 2nd left] [🥇 1st centre + tallest] [🥉 3rd right]
- Block heights: 50 / 70 / 36px · Avatar sizes: 36 / 44 / 30px
- Colours: silver `#9E9E9E` / gold `#D4A200` / bronze `#A0522D`

Rank 4+ shown as `EntryRow` list below. Player's own row highlighted; sticky at bottom if rank > 3.

---

## 12. Territory Map

**Web:** `apps/web/src/features/territory/pages/TerritoryMap.tsx`  
**Mobile:** `apps/mobile/src/features/territory/screens/TerritoryMapScreen.tsx`  
**Hook:** `useTerritoryMap.ts` · **Layer util:** `territoryLayer.ts` (web)

### Map Styles (both platforms)

| Style | Tile source |
|---|---|
| Standard | CartoDB Positron |
| Dark | CartoDB Dark Matter |
| Light | CartoDB Voyager |
| Terrain | OpenTopoMap |
| Satellite | ArcGIS World Imagery |

### Territory Rendering

MapLibre `FillLayer` + `LineLayer` from GeoJSON polygon features.

| Status | Fill colour | Opacity | Border |
|---|---|---|---|
| Owned by player | `#E8391C` | 20% | 1.5px red |
| Enemy | `#DC2626` | 20% | 1.5px dark-red |
| Neutral | `#9CA3AF` | 20% | 1px gray |

Newly claimed territory fades out over 2.25s.

### Filter Chips

All · Mine · Enemy · Weak (defense < 40) · Neutral  
Stats bar shows counts per filter.

### Territory Detail (tap)

Bottom sheet shows: H3 hex index, owner, defense (0–100, colour-coded), tier, actions.

**Fortify action:**
- RPC: `fortify_territory(h3_index, user_id)`
- Cost: 30 energy · Gain: +20 defense (max 100) · Reward: +10 XP
- Resets `last_fortified_at` (stops decay)

### Defense Decay

```
Rate:   10 points/day (~0.42/hour)
Starts: 3 days after last fortification
Floor:  0 (hex becomes claimable again)
```

---

## 13. Profile & Stats

**Web:** `apps/web/src/features/profile/pages/Profile.tsx`  
**Mobile:** `apps/mobile/src/features/profile/screens/ProfileScreen.tsx`

### Header

- Circular avatar (upload or auto-generated: initial + `avatarColor(username)`)
- Display name, bio, location, Strava/Instagram links
- Level badge with XP progress ring
- Privacy toggle (public / followers / private)

### Tabs

| Tab | Content |
|---|---|
| **Overview** | Weekly brief AI card, recent runs, weekly goal ring |
| **Stats** | Personal records (fastest pace, longest run, most zones), all-time totals |
| **Awards** | Unlocked achievement badges |
| **Nutrition** | Weekly calorie summary, macro breakdown, logging streak |
| **Gear** | Active + retired shoes with km wear bars |

### Personal Records

Computed by `calculatePersonalRecords()` from `packages/shared`:
fastest km pace · longest single run · most territories in one run · highest XP in one run · best streak

### Level Titles

| Level | Title | XP |
|---|---|---|
| 1 | Scout | 0 |
| 2 | Pathfinder | 300 |
| 3 | Trailblazer | 800 |
| 4 | Ranger | 1,800 |
| 5 | Explorer | 3,500 |
| 6 | Captain | 6,000 |
| 7 | Vanguard | 10,000 |
| 8 | Commander | 16,000 |
| 9 | Warlord | 25,000 |
| 10 | Legend | 38,000 |

---

## 14. AI Coach

**Web:** `apps/web/src/features/intelligence/pages/CoachScreen.tsx`  
**Mobile:** `apps/mobile/src/features/coach/screens/CoachScreen.tsx`  
**Edge function:** `supabase/functions/ai-coach/index.ts`  
**Model:** Anthropic Claude (via Supabase Edge Function)

### User Context Passed to Claude

Every call includes: 90-day run history (distance, pace, HR, cadence, elevation) · weekly/monthly km trend · pace zones · personal records · territory stats · nutrition profile + 30-day log · shoe wear · race time predictions.

### Feature: Weekly Brief

```typescript
feature: 'weekly_brief'
// Returns:
{ headline: string; insights: string[]; tip: string; nutrition?: { summary, connection, priority } }
```

Called once on mount, cached. Shown on Profile Overview tab and Dashboard.

### Feature: Post-Run Insights

```typescript
feature: 'post_run', runId: string
// Returns:
{ praise: string; analysis: string; suggestion: string; recovery?: string }
```

Shown in `PostRunInsightsCard` on RunSummaryScreen. Rule-based fallback while loading.

### Feature: Coach Chat

```typescript
feature: 'coach_chat', message: string
```

Conversational interface with typing indicator. Pre-set quick prompts:
- "How can I improve my pace?"
- "Build me a 5K training plan"
- "How should I warm up before a run?"
- "Tips for running in the heat?"

### Feature: Training Plan

```typescript
feature: 'training_plan', goal: string
// Returns: { weeks: [{ week, focus, sessions: [{ day, type, description }] }] }
```

Rendered as collapsible accordion per week.

### Feature: Nutrition Insights

```typescript
feature: 'nutrition_insights'
// Returns: { cards: [{ icon, title, body }], generatedAt }
```

Cards shown in CalorieTracker Insights tab.

### Cost Protection

- Daily cap: **$0.12 USD** total / **$0.08 USD** chat only
- Pricing: $3/M input tokens · $15/M output tokens
- All usage logged to `ai_usage_log` (user_id, feature, tokens, cost_usd)

---

## 15. Calorie Tracker

**Web:** `apps/web/src/features/nutrition/pages/CalorieTracker.tsx`  
**Mobile:** `apps/mobile/src/features/nutrition/screens/CalorieTrackerScreen.tsx`

### Setup

`NutritionSetupScreen.tsx` collects: goal (lose/maintain/gain) · activity level · diet type · weight/height/age/sex.  
Auto-calculates `dailyGoalKcal`, `proteinGoalG`, `carbsGoalG`, `fatGoalG` via Harris-Benedict.

### Today Tab

- **Calorie ring:** progress circle — red (<80%), amber (80–100%), orange (over)
- **Meal sections:** Breakfast · Lunch · Dinner · Snacks
  - Food list with kcal + macros, "+" add button, swipe-to-delete
- **Macro summary:** P / C / F grams + %
- **Run burn offset:** calories from today's runs subtracted from remaining

**Run → Calorie deep link:** `RunSummaryScreen` navigates to `CalorieTracker` with `{ burnKcal }` param → auto-opens add modal.

### Weekly Chart

7-bar chart: green = under goal, orange = over, red = today.

### Insights Tab

AI cards via `useNutritionInsights()`: hydration · macro balance · meal timing · "Ask Coach" CTA.

### Food Logging

`FoodSearch` component: ~5,000 foods, serving size input, meal category selector.  
Source field: `'search'` | `'run'` | `'manual'`.  
XP rewarded via `calcNutritionXP(kcal)` on each log.

---

## 16. Gear / Shoe Tracker

**Web:** `apps/web/src/features/gear/pages/ShoeList.tsx`  
**Mobile:** `apps/mobile/src/features/gear/screens/GearScreen.tsx`

### Shoe Card

- Brand + model, nickname, category
- Mileage progress bar: green <60% · amber 60–85% · red ≥85%
- Status: Default / Active / Worn / Replace / Retired
- `X km used / Y km max`

**Actions:** Set as default · Retire · Delete

### Add Shoe

Fields: brand, model, nickname, category (road/trail/track/casual), max km (default 1,000), colour hex, notes, purchase date.

### Wear Tracking

- `getDefaultShoe()` identifies shoe for each run
- `getRuns(500)` → filter by `shoeId` → sum `distanceMeters / 1000`
- `ShoeChip` on RunSummaryScreen shows accumulated km

### Foot Scan (mobile)

`FootScanScreen.tsx` → `expo-camera` captures foot → `foot-scan` edge function → pronation profile → shoe recommendations.

---

## 17. Settings

**Web:** `apps/web/src/features/settings/pages/Settings.tsx`  
**Mobile:** `apps/mobile/src/features/settings/screens/SettingsScreen.tsx`  
**Storage:** `getSettings()` / `saveSettings()` — key `'settings'` in IndexedDB

### All Settings

| Category | Setting | Type | Default |
|---|---|---|---|
| Display | Distance unit | km / mi | km |
| Display | Dark mode | boolean | false |
| Display | Map style | Standard/Dark/Light/Terrain/Satellite | Standard |
| Notifications | Push notifications | boolean | true |
| Notifications | Weekly summary | boolean | true |
| Notifications | Mission alerts | boolean | true |
| Notifications | Territory alerts | boolean | true |
| Run | Countdown seconds | 0 / 3 / 5 | 3 |
| Run | Mission difficulty | easy / mixed / hard | mixed |
| Run | Auto-pause | boolean | false |
| Run | GPS accuracy | standard / high | standard |
| Beat Pacer | Enabled | boolean | false |
| Beat Pacer | Pace | mm:ss string | "5:00" |
| Beat Pacer | Sound | click / woodblock / hihat | click |
| Beat Pacer | Accent beat | boolean | true |
| Privacy | Profile visibility | public / followers / private | public |
| Account | Sign out | action | — |
| Account | Delete account | destructive | — |

**Connected devices (mobile):** Apple Health (HealthKit) · Google Health Connect · Strava OAuth · Garmin/Polar/COROS via device-webhook

---

## 18. Game Mechanics Reference

### Energy System

Scale 0–10. Server-enforced via `sync_energy` RPC (clock manipulation prevention).

| Source | Effect |
|---|---|
| Time passing | +1 per hour |
| Running | +1 per km |
| Claim territory | −1 |
| Shield territory | −3 |
| Boost | −2 |
| Scan | −1 |

### Territory System

**H3 resolution 9** hexes (~0.1 km² each).  
**Claim:** 60 continuous seconds in same hex.  
**Display polygon:** GPS trace buffered 20m each side via `bufferPath()`.

| Event | Defense change |
|---|---|
| Claim (new) | = 30 |
| Fortify | +20 (max 100) |
| Adjacent owned hex | +3 bonus |
| Decay (after 3 days) | −10/day |

**Tier system:** bronze → silver → gold → crown

**Territory caps by subscription:**

| Plan | Territories |
|---|---|
| free | 50 |
| runner-plus | 100 |
| territory-lord | 500 |
| empire-builder | unlimited |

### XP Awards

| Action | XP |
|---|---|
| 1 km run | 30 |
| Claim neutral hex | 25 |
| Claim enemy hex | 60 |
| Fortify | 10 |
| Speed bonus (avg > 3.5 m/s) | ×1.4 multiplier |

### Daily Missions

Generated by `generateDailyMissions()` in `packages/shared/src/services/missions.ts`. 18 templates across 8 types. Expire at midnight. Difficulty: easy / mixed / hard.

| Type | Example |
|---|---|
| run_distance | "Run 5 km today" |
| claim_territories | "Claim 3 territories" |
| fortify_territories | "Fortify 2 territories" |
| capture_enemy | "Claim 1 enemy zone" |
| explore_new_hexes | "Explore 5 new hexagons" |
| speed_run | "Complete a km under 5:30/km" |
| run_streak | "Run 3 days in a row" |
| run_in_enemy_zone | "Run 1 km through enemy territory" |

### Achievements

| Key | Label | Requirement |
|---|---|---|
| first_run | First Steps | 1 run |
| 5k_club | 5K Club | Single run ≥ 5 km |
| 10k_warrior | 10K Warrior | Single run ≥ 10 km |
| 50k | 50K Explorer | Total ≥ 50 km |
| streak_3 | On Fire 🔥 | 3-day streak |
| streak_7 | Week Warrior | 7-day streak |
| streak_30 | Monthly Grind | 30-day streak |
| first_zone | Zone Claimer | 1 territory |
| zones_10 | Map Maker | 10 territories |
| zones_50 | Conqueror | 50 territories |
| level_5 | Rising Star | Level 5 |
| level_10 | Veteran | Level 10 |

---

## 19. Shared Services & Data Layer

**Location:** `packages/shared/src/`

### store.ts — IndexedDB (DB version 10)

| Type | Purpose | Key fields |
|---|---|---|
| `StoredPlayer` | Game state | level, xp, energy, streakDays, totalDistanceKm, unlockedAchievements |
| `StoredRun` | Run history | distanceMeters, durationSec, avgPace, gpsPoints[], territoriesClaimed[], synced |
| `StoredTerritory` | Map polygon | polygon[lng,lat][], ownerId, defense, tier, claimedAt |
| `StoredSettings` | Preferences | All settings fields |
| `StoredSavedRoute` | Saved GPS routes | name, emoji, gpsPoints[], isPublic |
| `StoredShoe` | Gear | brand, model, maxKm, isDefault, isRetired |
| `NutritionProfile` | Macro goals | dailyGoalKcal, proteinGoalG, carbsGoalG, fatGoalG |
| `NutritionEntry` | Food log | date, meal, kcal, macros, synced |
| `PendingAction` | Offline queue | type (claim/fortify), territoryId, gpsProof[] |

### sync.ts — Cloud Sync

```
pushProfile()          → UPDATE profiles
pullProfile()          → GET canonical server state
pushUnsyncedRuns()     → INSERT runs  (GPS via Ramer-Douglas-Peucker ε≈5m, 95% compression)
pullRuns(limit)        → GET run history
pushNutritionLogs()    → INSERT nutrition_logs
pushSavedRoutes()      → INSERT saved_routes
claimTerritoryRemote() → RPC claim_territory (with GPS proof)
findRoutesNearby()     → PostGIS spatial query
subscribeLobbyMessages() → Realtime subscription
```

Sync status: `idle | syncing | error | offline`

### claimEngine.ts

H3 hex dwell tracker — single instance per run session.

```typescript
update(lat, lng, speedMps, accuracy, canClaim): ClaimState
onEvent(listener)    // 'claim_progress' | 'claimed' | 'energy_blocked'
getSessionStats()    // { claimed: number, xp: number }
reset()
```

### config.ts — Game Constants

```
CLAIM_TIME_IN_HEX_SEC:    60
HEX_RESOLUTION:           9
CORRIDOR_BUFFER_M:        20
MIN_CLAIM_DISTANCE_M:     200
XP_PER_KM:                30
XP_CLAIM_NEUTRAL:         25
XP_CLAIM_ENEMY:           60
TERRITORY_DECAY_PER_DAY:  10
MAX_ENERGY:               10
LEVEL_XP:                 [0,300,800,1800,3500,6000,10000,16000,25000,38000]
```

---

## 20. Supabase Schema Reference

### Core Tables

**`profiles`**
```sql
id uuid PK, username text, level int, xp int, coins int, energy int,
total_distance_km numeric, total_runs int, total_territories_claimed int,
streak_days int, last_run_date date, subscription_tier text,
age int, gender text, height_cm int, weight_kg int,
country text, city text, avatar_url text, avatar_color text,
bio text, location text, strava_url text, instagram text
```

**`runs`**
```sql
id uuid PK, user_id uuid FK, activity_type text,
started_at timestamptz, finished_at timestamptz,
distance_m numeric, duration_sec int, avg_pace text,
gps_points jsonb, territories_claimed text[],
xp_earned int, coins_earned int, pre_run_level int,
avg_hr int, calories_kcal int, shoe_id uuid
```

**`territories`** (H3 hex-keyed)
```sql
h3_index text PK, owner_id uuid FK, owner_name text,
defense int CHECK (0-100), tier text CHECK (bronze|silver|gold|crown),
captured_at timestamptz, last_fortified_at timestamptz
```

**`nutrition_logs`**
```sql
id int PK, user_id uuid FK, log_date date, meal text,
name text, kcal int, protein_g numeric, carbs_g numeric, fat_g numeric,
source text, xp_awarded bool, logged_at timestamptz
```

**`stories`**
```sql
id uuid PK, user_id uuid FK, run_id uuid,
image_url text, created_at timestamptz,
expires_at timestamptz DEFAULT (NOW() + INTERVAL '24 hours')
```

**`shoes`**
```sql
id uuid PK, user_id uuid FK, brand text, model text, nickname text,
category text, max_km numeric, is_retired bool, is_default bool,
color text, created_at timestamptz
```

**`kudos`**
```sql
id uuid PK, from_id uuid FK, to_id uuid FK, run_id uuid FK,
emoji text, created_at timestamptz
```

**`lobby_messages`**
```sql
id uuid PK, room_id text, user_id uuid, username text,
content text, created_at timestamptz
```

**`leaderboard_weekly`** (precomputed)
```sql
id uuid, username text, level int,
weekly_xp int, weekly_km numeric, weekly_territories int, rank int
```

### Key RPCs

**`claim_territory(h3_index, owner_id, owner_name, gps_proof)`**  
Validates: energy ≥1, tier cap, GPS proof (≥3 pts, ≥30s span, speed ≤12 m/s). Atomically deducts energy, upserts territory.

**`sync_energy(user_id)`**  
Returns current energy (0–10) after applying hourly regen since last sync.

**`fortify_territory(h3_index, user_id)`**  
Checks ownership. Deducts 30 energy. Adds +20 defense (max 100). Awards +10 XP.

**`find_routes_nearby(lng, lat, radius_m)`**  
PostGIS `ST_DWithin` query on `saved_routes`.

### Storage Buckets

| Bucket | Max size | Public | Notes |
|---|---|---|---|
| `stories` | 5 MB | Yes | PNG/JPEG/WebP, 24h TTL |
| `avatars` | — | Read-public | Per-user folder |
| `run-photos` | — | Read-public | Run photo attachments |

---

## 21. Edge Functions

**Location:** `supabase/functions/`

### `ai-coach`
Anthropic Claude integration. Features: `weekly_brief`, `post_run`, `training_plan`, `coach_chat`, `nutrition_insights`. Rich user context fetched from Supabase before each call. Daily cost cap $0.12/user. Usage logged to `ai_usage_log`.

### `send-push-notification`
Multi-channel: VAPID web push (`push_subscriptions`) + Expo push (`expo_push_tokens`). Auto-removes expired/invalid tokens.

### `device-oauth`
OAuth device flow for Garmin, Strava, COROS, Polar.

### `device-webhook`
Receives incoming workout data from connected platforms.

### `stripe-webhook`
Handles Stripe subscription lifecycle (created/renewed/cancelled).

### `rc-webhook`
Handles RevenueCat IAP events for mobile subscriptions.

### `foot-scan`
Processes foot scan images. Returns pronation profile for shoe recommendations.

---

## 22. Mobile-Only Features

| Feature | Implementation |
|---|---|
| Background GPS | SQLite `bg_gps_buffer` via `expo-task-manager` |
| Beat Pacer audio | `expo-av` · click.wav · 25ms scheduler |
| Apple HealthKit | `@kingstinct/react-native-healthkit` — reads workouts, writes runs + HR |
| Haptic feedback | `expo-haptics` — success/warning/light on claim/energy events |
| Push notifications | `expo-notifications` · FCM token → `expo_push_tokens` table |
| Screen-on lock | `expo-keep-awake` during active run |
| Foot scan camera | `expo-camera` → `foot-scan` edge function |
| Deep links | `runivo://` + HTTPS universal links |
| RevenueCat | In-app subscription management |

---

## 23. Web-Only Features

| Feature | Implementation |
|---|---|
| Service worker | `/public/sw.js` — VAPID web push + offline cache |
| Story card capture | `html-to-image` — DOM element → PNG data URL |
| Page transitions | Framer Motion `AnimatePresence` on route change |
| QR code sharing | `qrcode` library for shareable run cards |
| Audio (UI sounds) | Howler.js (vs `expo-av` on mobile) |
| Screen wake lock | `navigator.wakeLock.request('screen')` |
| Design system | `/design-system` route — component library reference page |
| Device settings | `/settings/devices` — Strava/Garmin/Apple Health connect UI |
