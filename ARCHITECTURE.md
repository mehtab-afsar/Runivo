# Runivo — Architecture Analysis

---

## Part 1: Data Persistence, Map Routes, Profile & Permissions

### Storage Architecture

Runivo is **offline-first**. All data is written to **IndexedDB** immediately (optimistic), then synced to **Supabase** asynchronously. The local DB is named `'runivo'`, schema version 7.

```
User Action
    ↓
IndexedDB (instant, local)
    ↓ (fire-and-forget)
Supabase (cloud, async)
```

---

### How Map Routes Are Saved

**Data Model** (`src/shared/services/store.ts`):

```typescript
interface StoredSavedRoute {
  id: string;                                    // UUID
  name: string;                                  // User-given name
  emoji: string;                                 // Route icon
  distanceM: number;                             // Distance in meters
  durationSec: number | null;                    // Optional duration
  gpsPoints: { lat: number; lng: number }[];     // Raw GPS coordinate array
  isPublic: boolean;                             // Privacy toggle
  sourceRunId: string | null;                    // Run that created this route
  synced: boolean;                               // Cloud sync status flag
  createdAt: number;                             // Unix timestamp
}
```

**Save Flow:**

1. GPS coordinates are collected during an active run via `navigator.geolocation.watchPosition`
2. After finishing, user opens `SaveRouteModal.tsx` and enters a name, emoji, and public/private toggle
3. Route object is built with a new UUID and `synced: false`, saved to IndexedDB immediately
4. `pushSavedRoutes()` is called async — on success the record is updated to `synced: true`

**IndexedDB store:** `savedRoutes` (keyPath: `'id'`)
**Cloud table:** `saved_routes` in Supabase

**During a run**, a saved route can be loaded as a ghost overlay via `location.state.ghostRoute` (React Router state), rendered on the MapLibre GL map.

---

### How Profile Data Is Saved

Profile data is split across two models:

**`PlayerProfile`** — biometrics & preferences (`src/shared/services/profile.ts`):

```typescript
interface PlayerProfile {
  playerId: string;
  age: number;
  gender: 'male' | 'female' | 'other' | '';
  heightCm: number;
  weightKg: number;
  experienceLevel: 'new' | 'casual' | 'regular' | 'competitive';
  weeklyFrequency: number;
  primaryGoal: 'get_fit' | 'lose_weight' | 'run_faster' | 'explore' | 'compete';
  preferredDistance: 'short' | '5k' | '10k' | 'long';
  distanceUnit: 'km' | 'mi';
  notificationsEnabled: boolean;
  weeklyGoalKm: number;
  missionDifficulty: 'easy' | 'mixed' | 'hard';
  onboardingCompletedAt: number;
  playstyle?: 'conqueror' | 'defender' | 'explorer' | 'social';
}
```

**`StoredPlayer`** — live game stats (`src/shared/services/store.ts`):

```typescript
interface StoredPlayer {
  id: string;
  username: string;
  level: number;
  xp: number;
  coins: number;
  diamonds: number;
  energy: number;
  lastEnergyRegen: number;
  totalDistanceKm: number;
  totalRuns: number;
  totalTerritoriesClaimed: number;
  streakDays: number;
  lastRunDate: string | null;
  lastIncomeCollection: number;
  unlockedAchievements: string[];
  createdAt: number;
}
```

**Persistence flow:**

| Layer | Mechanism | When |
|---|---|---|
| Local | IndexedDB `player` + `profile` stores | Every game event (real-time) |
| Cloud | Supabase `profiles` table via `pushProfile()` | After each run, on auth change |
| Boot | `pullProfile()` syncs from cloud | On authenticated app start |
| Onboarding flag | `localStorage: runivo-onboarding-complete = 'true'` | After onboarding wizard |

**Onboarding wizard** (`src/features/onboarding/`) collects all profile data across these steps:
- `BiometricsStep` — age, gender, height, weight
- `ExperienceStep` — running level
- `GoalStep` — primary goal
- `PlaystyleStep` — conqueror / defender / explorer / social
- `PreferencesStep` — distance unit, notifications
- `WeeklyPlanStep` — frequency, weekly km goal

`useGameEngine.ts` is the central hook that reads/writes `StoredPlayer` — all mutations call `savePlayer()` to persist to IndexedDB.

---

### How Permissions Are Requested

#### GPS / Location

Permission is requested **implicitly** by the browser the first time `navigator.geolocation.watchPosition` is called — which happens when the user taps **Start Run** in `ActiveRun.tsx`.

```typescript
// src/features/run/hooks/useActiveRun.ts
watchIdRef.current = navigator.geolocation.watchPosition(
  (position) => { /* process GPS */ },
  (error) => { console.error('GPS Error:', error); },
  {
    enableHighAccuracy: true,   // Forces GPS chip, not network triangulation
    maximumAge: 0,              // Never use cached position
  }
);
```

- **When:** Only when a run starts — not on app load
- **If denied:** Run tracking degrades gracefully (no GPS trail, no territory claims), app does not crash
- **Bad readings filtered:** Accuracy > 50m is rejected; jumps < 2m (jitter) or ≥ 100m (teleport) are ignored

#### Notifications

Browser `Notification` API — requested via `NotificationToast` component when relevant. Not forced on load.

#### Vibration (Haptics)

`navigator.vibrate()` via `src/shared/lib/haptics.ts`. No permission required on most platforms.

#### Contacts

**Not used.** No contact access is requested anywhere in the codebase.

#### Audio

Howler.js handles audio context activation implicitly on first user interaction (browser policy).

---

## Part 2: Game Engine, Coins & Diamonds

### Game Engine Architecture

The game engine is a **real-time, event-driven state machine** implemented as a React hook (`src/shared/hooks/useGameEngine.ts`) coordinating four sub-systems:

```
┌──────────────────────────────────────────────────────────┐
│                    useGameEngine.ts                       │
│                   (Central Orchestrator)                  │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │  ClaimEngine    │  │   Missions   │  │  XP/Level   │ │
│  │  (claimEngine)  │  │  (missions)  │  │  System     │ │
│  │  200m per claim │  │  Daily reset │  │  Levels 1-20│ │
│  └────────┬────────┘  └──────┬───────┘  └──────┬──────┘ │
│           │                  │                  │         │
│           ↓                  ↓                  ↓         │
│  ┌──────────────────────────────────────────────────────┐ │
│  │               IndexedDB (Local Cache)                 │ │
│  │  player · territories · runs · missions · routes     │ │
│  └──────────────────────────────────────────────────────┘ │
│           ↓ async, fire-and-forget                        │
│  ┌──────────────────────────────────────────────────────┐ │
│  │                   Supabase Cloud                      │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

**Key files:**

| File | Role |
|---|---|
| `src/shared/hooks/useGameEngine.ts` | Central hub — energy regen, XP, coins, diamonds, level-ups |
| `src/features/territory/services/claimEngine.ts` | Real-time GPS claim state machine |
| `src/shared/services/config.ts` | All balance constants |
| `src/shared/services/diamonds.ts` | Diamond reward logic |
| `src/shared/services/passiveIncome.ts` | Passive coin income from territory |
| `src/features/missions/services/missions.ts` | 23 mission templates, daily generation |
| `src/features/missions/services/missionStore.ts` | Mission persistence & reward distribution |
| `src/shared/services/store.ts` | IndexedDB schema (v7) & all CRUD |
| `src/shared/services/sync.ts` | Offline-first cloud sync |

---

### Run Event Flow

```
TAP "START RUN"
    ↓
startClaimEngine() → initialise ClaimEngine state machine
    ↓
[GPS loop — every ~5 seconds]
    ↓
updateClaim(lat, lng, speed, accuracy, distanceDelta)
    ↓ (every 200m accumulated)
Claim event emitted → {
  energy cost:  -10
  XP earned:    +25 (COINS_CLAIM_NEUTRAL)
  coins earned: +10 (XP_CLAIM_NEUTRAL)
  territory:    polygon building begins
}
    ↓
[User taps FINISH]
    ↓
endRunSession(runData) → {
  Build GeoJSON territory polygon from GPS trail
  Calculate total XP, coins, diamonds
  Update missions progress & check completions
  Check level-ups & streak milestones
  Save run to IndexedDB (synced: false)
  Push to Supabase async
  Update player stats
}
    ↓
RUN SUMMARY PAGE
    ↓ display all rewards + animated territory map
```

---

### Energy System

| Property | Value |
|---|---|
| Max energy | 100 |
| Passive regen | 10 energy / hour |
| Active regen (during run) | 10 energy / km |
| Cost per territory claim | 10 energy |
| Effect of running out | `energy_blocked` event — claim skipped until energy available |

Energy check interval: every 30 seconds while app is open.

---

### How Coins Are Assigned

Coins come from four sources:

#### 1. Running Distance
```
coins = floor(distanceKm × COINS_PER_KM)
COINS_PER_KM = 5
```
Example: 10 km → **50 coins**

#### 2. Territory Claims (every 200m)
```
coins per claim = COINS_CLAIM_NEUTRAL = 10
```
Example: 10 km run → ~50 claims → **500 coins**

#### 3. Mission Completion

| Difficulty | Coin Range |
|---|---|
| Easy | 15 – 60 coins |
| Medium | 30 – 150 coins |
| Hard | 100 – 150 coins |

3 missions are generated daily, biased toward the player's primary goal.

#### 4. Passive Territory Income
```
coinsEarned = floor(ownedZoneCount × BASE_INCOME_PER_HEX_DAY × daysElapsed)
BASE_INCOME_PER_HEX_DAY = 5
```
- Collected when the player loads the dashboard
- **Only flows if player ran within the last 3 days** (no income for inactive players)
- Scales linearly with territory owned

#### Coin Totals at Run End (`useGameEngine.ts`)
```typescript
const distanceCoins = Math.floor((runData.distanceMeters / 1000) * GAME_CONFIG.COINS_PER_KM);
const claimCoins    = stats.coins;  // accumulated by ClaimEngine during the run
const totalCoins    = distanceCoins + claimCoins;
updatedPlayer.coins = player.coins + totalCoins;
```

---

### How Diamonds Are Assigned

Diamonds are the premium currency. They come from three sources only — never from just running distance.

#### 1. Level-Up Milestones (`src/shared/services/diamonds.ts`)

| Level Reached | Diamonds |
|---|---|
| 5 | 2 |
| 10 | 5 |
| 15 | 10 |
| 20 | 20 |

Only awarded once per level milestone.

#### 2. Streak Milestones (`src/shared/services/diamonds.ts`)

| Streak Days | Diamonds |
|---|---|
| 7 | 3 |
| 30 | 10 |
| 100 | 25 |

Only awarded once per streak milestone crossing.

#### 3. Hard Mission Completion (selected missions only)

| Mission | Requirement | Diamonds |
|---|---|---|
| Endurance Test | 5 km run | 2 |
| Empire Builder | Claim 5 territories | 3 |
| War Machine | Capture 3 enemy zones | 5 |
| Long Haul | 8 km run | 3 |
| Sprint Intervals | 3 km sub-5:30/km pace | 2 |
| Off The Beaten Path | Explore 10 new hexes | 1 |

Most easy/medium missions award **zero** diamonds.

#### Diamond Calculation at Run End (`useGameEngine.ts`)

```typescript
const diamondsEarned = calculateRunDiamonds({
  oldLevel:       preRunLevel,
  newLevel:       updatedLevel,
  oldStreak:      previousStreak,
  newStreak:      currentStreak,
  missionDiamonds // sum from any missions completed this run
});

// calculateRunDiamonds =
//   calculateLevelUpDiamonds(oldLevel, newLevel)
// + calculateStreakDiamonds(oldStreak, newStreak)
// + missionDiamonds
```

#### Diamond Economy Summary

| Source | Rate |
|---|---|
| Level-ups (all 4 milestones) | 37 total, once per account |
| 7-day streak | 3, repeatable each time streak resets & rebuilds |
| 30-day streak | 10 |
| 100-day streak | 25 |
| Hard missions | 1–5 per mission |
| Passive income / distance | **none** |

---

### Level Progression

XP required for each level is defined in `config.ts` (`LEVEL_XP` array):

| Level | Cumulative XP |
|---|---|
| 1 | 0 |
| 2 | 200 |
| 3 | 500 |
| 4 | 900 |
| 5 | 1,400 |
| 6 | 2,000 |
| … | … |
| 20 | 58,000 |

XP sources: distance (XP per km) + territory claims (25 XP each) + missions.

---

### Territory Persistence

| Property | Detail |
|---|---|
| Format | GeoJSON polygon `[lng, lat][]` closed rings |
| Area calculation | Shoelace formula |
| Defense score | Starts at 30, max 100, decays 10/day after 3+ inactive days |
| IndexedDB store | `territories` |
| Cloud table | `territories` in Supabase |
| Boot behaviour | `pullTerritories()` fetches all players' territories on app start for multiplayer visibility |
