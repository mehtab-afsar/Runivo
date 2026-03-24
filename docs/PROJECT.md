# Runivo — Project Documentation

> Last updated: March 24, 2026

---

## Table of Contents

1. [What is Runivo?](#1-what-is-runivo)
2. [Monorepo Structure](#2-monorepo-structure)
3. [Shared Package](#3-shared-package)
4. [Web App](#4-web-app)
5. [Mobile App](#5-mobile-app)
6. [Supabase Backend](#6-supabase-backend)
7. [Edge Functions](#7-edge-functions)
8. [Database Schema](#8-database-schema)
9. [Feature Status](#9-feature-status)
10. [Tech Stack](#10-tech-stack)
11. [Subscription System](#11-subscription-system)
12. [AI Integration](#12-ai-integration)
13. [Device Integration](#13-device-integration)
14. [How to Run](#14-how-to-run)

---

## 1. What is Runivo?

Runivo is a **territory-capture running app** — a gamified fitness tracker where runners physically claim hexagonal zones on a map by running through them. Every run earns XP, coins, and territory. Runners compete on leaderboards, complete missions, join clubs, chat in lobbies, and get AI-powered coaching from Claude.

**Core loop:** Run → Claim territory → Earn XP/coins → Level up → Compete on leaderboards → Get AI insights

**Platforms:** Web app (PWA-capable) + iOS/Android native mobile app

---

## 2. Monorepo Structure

```
Runivo/
├── apps/
│   ├── web/                    # React web app (Vite + TypeScript)
│   └── mobile/                 # React Native / Expo mobile app
├── packages/
│   └── shared/                 # Cross-platform shared code
│       └── src/
│           ├── services/       # Business logic (auth, store, sync, game)
│           ├── hooks/          # Shared hooks (useAuth, useGameEngine)
│           ├── types/          # Shared TypeScript types
│           └── lib/            # Utilities (haptics, avatarUtils)
├── supabase/
│   ├── migrations/             # 50 ordered SQL migration files
│   └── functions/              # 7 Deno edge functions
└── docs/                       # Project documentation
```

### Workspace Setup

The monorepo uses **npm workspaces**. The three workspace packages are:

| Package | Alias | Role |
|---|---|---|
| `packages/shared` | `@shared/*` | Core business logic shared by both apps |
| `apps/web` | — | Browser app |
| `apps/mobile` | — | Native iOS/Android app |

### Root Scripts

```bash
npm run web        # Start web dev server
npm run mobile     # Start Expo Metro bundler
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
```

---

## 3. Shared Package

> **`packages/shared/src/`** — the single source of truth for business logic. Both apps import from here via the `@shared/*` alias.

### Services

| File | Platform | Purpose |
|---|---|---|
| `supabase.ts` / `supabase.native.ts` | Both | Supabase client initialisation |
| `store.ts` / `store.native.ts` | Both | Local persistence (IndexedDB on web, SQLite on mobile) |
| `sync.ts` | Both | Offline sync: local → Supabase with conflict resolution and retry |
| `auth.ts` | Both | Auth helpers (sign in, sign up, password reset) |
| `config.ts` | Both | Environment config management |
| `claimEngine.ts` | Both | Territory claiming logic — validates GPS point, computes H3 hex, awards XP/coins |
| `missions.ts` | Both | Mission template generation (daily/weekly) |
| `missionStore.ts` / `missionStore.native.ts` | Both | Mission persistence and completion tracking |
| `passiveIncome.ts` | Both | Passive coin/energy accumulation while offline |
| `personalRecords.ts` | Both | Personal record computation from run history |
| `profile.ts` / `profile.native.ts` | Both | Profile load/save helpers |
| `storiesService.ts` | Both | 24-hour ephemeral story CRUD |
| `appleHealthService.ts` / `.native.ts` | Mobile | HealthKit read/write (steps, workouts, HR) |
| `pushNotificationService.ts` / `.native.ts` | Both | Web Push + Expo Push subscription management |
| `seedData.ts` | Dev | Demo data generation for testing |

### Hooks

| File | Purpose |
|---|---|
| `useAuth.ts` | Auth state (session, user, loading) |
| `useGameEngine.ts` | Central game state — XP, level, coins, energy, missions |

### Types

| File | Key types |
|---|---|
| `types/game.ts` | `MissionType`, game event shapes |
| `types/index.ts` | `Location`, `Route`, `WeatherData`, `RunStats`, `TerritoryStats`, `RunnerProfile`, `LiveRunData`, `MetricCardProps` |

### Store — Key Interfaces

The `store.ts` file defines the local database schema. Key interfaces:

```typescript
StoredRun        // A completed run (distanceMeters, duration, gpsPoints, shoeId, etc.)
StoredShoe       // A running shoe (brand, model, maxKm, isDefault, isRetired)
StoredSettings   // App preferences (units, weeklyGoal, beat pacer config)
NutritionProfile // Daily macro goals (kcal, protein, carbs, fat)
NutritionEntry   // A single food log entry
StoredSavedRoute // A named saved route
```

---

## 4. Web App

> **`apps/web/`** — React 19 + Vite + TypeScript + Tailwind CSS

### Tech Stack

| Dependency | Version | Purpose |
|---|---|---|
| React | 19.2.0 | UI |
| React Router | 6.20.1 | Client-side routing |
| Vite | 4.5.0 | Build tool |
| Framer Motion | 12.23.22 | Animations & page transitions |
| Tailwind CSS | 3.3.5 | Utility styling |
| MapLibre GL | 5.8.0 | Interactive map rendering |
| Lucide React | 0.544.0 | Icon set |
| Supabase JS | 2.98.0 | Backend client |
| h3-js | 4.4.0 | H3 hexagonal geospatial indexing |
| Howler | 2.2.4 | Audio playback (run sounds) |
| html-to-image | 1.11.11 | Run summary card screenshot |

### Path Aliases

```
@shared/*   →  packages/shared/src/*
@features/* →  apps/web/src/features/*
@/          →  apps/web/src/
```

### Routing (App.tsx)

All routes are lazy-loaded. The layout wraps pages in `FeatureErrorBoundary` for graceful error handling.

#### Fullscreen Routes (no bottom nav)

| Route | Component | Description |
|---|---|---|
| `/story-viewer` | `StoryViewer` | Full-screen story viewing |
| `/active-run` | `ActiveRun` | Live run tracking screen |
| `/run-summary/:id` | `RunSummary` | Post-run results |
| `/missions` | `Missions` | Daily & weekly missions |
| `/events/create` | `CreateEvent` | Event creation form |
| `/subscription` | `Subscription` | Subscription plan selector |
| `/settings` | `Settings` | App settings |
| `/settings/devices` | `ConnectedDevices` | Garmin / Coros / Polar OAuth |
| `/settings/devices/callback` | `ConnectedDevices` | OAuth redirect handler |

#### Map Route (fullscreen with floating nav)

| Route | Component | Description |
|---|---|---|
| `/territory-map` | `TerritoryMap` | Live territory claiming map |

#### Standard Routes (with bottom navigation)

| Route | Component | Description |
|---|---|---|
| `/home` | `Dashboard` | Home / hero dashboard |
| `/feed` | `Feed` | Social feed + stories |
| `/run` | `RunScreen` | Pre-run setup & activity picker |
| `/profile` | `Profile` | User profile (4 tabs) |
| `/leaderboard` | `Leaderboard` | Rankings |
| `/events` | `Events` | Event discovery & RSVP |
| `/history` | `History` | Past run logs |
| `/calories` | `CalorieTracker` | Nutrition tracker (Today / Insights tabs) |
| `/calories/setup` | `NutritionSetup` | Macro goal setup |
| `/club` | `Club` | Club management |
| `/lobby` | `Lobby` | Club lobbies |
| `/lobby/:id` | `LobbyChat` | Real-time club chat |
| `/notifications` | `Notifications` | Notification inbox |
| `/coach` | `CoachScreen` | AI Coach chat + training plans |
| `/gear` | `ShoeList` | Shoe inventory & mileage tracking |
| `/gear/add` | `AddShoe` | Add/edit a shoe |
| `/gear/scan` | `FootScan` | AI foot arch type scan |
| `/design-system` | `DesignSystem` | Internal design system page |

### Feature Directory Structure

```
apps/web/src/features/
├── club/
│   ├── pages/Club.tsx
│   └── services/clubService.ts
├── dashboard/
│   └── pages/Dashboard.tsx
├── events/
│   ├── pages/Events.tsx, CreateEvent.tsx
│   └── services/eventService.ts
├── gear/
│   └── pages/ShoeList.tsx, AddShoe.tsx, FootScan.tsx
├── history/
│   └── pages/History.tsx
├── intelligence/
│   ├── hooks/useCoachChat.ts, useNutritionInsights.ts, usePostRunInsights.ts, useWeeklyBrief.ts
│   ├── pages/CoachScreen.tsx
│   └── services/intelligenceService.ts
├── landing/
│   ├── components/AuthForm.tsx, etc.
│   └── pages/Login.tsx, SignUp.tsx
├── leaderboard/
│   └── pages/Leaderboard.tsx
├── lobby/
│   ├── pages/Lobby.tsx, LobbyChat.tsx
│   └── services/lobbyService.ts
├── missions/
│   ├── components/MissionCard.tsx
│   ├── pages/Missions.tsx
│   └── services/missions.ts, missionStore.ts
├── notifications/
│   ├── components/NotificationToast.tsx
│   └── pages/Notifications.tsx
├── nutrition/
│   ├── pages/CalorieTracker.tsx, NutritionSetup.tsx
│   └── services/nutritionService.ts, trackerInsights.ts
├── onboarding/
│   └── components/OnboardingWrapper.tsx, steps/
├── profile/
│   ├── hooks/usePlayerStats.ts
│   └── pages/Profile.tsx
├── run/
│   ├── components/BeatPacerSheet.tsx, ActivityPickerSheet, etc.
│   ├── hooks/useActiveRun.ts
│   ├── pages/RunScreen.tsx, ActiveRun.tsx, RunSummary.tsx
│   └── services/beatService.ts (Web Audio metronome engine)
├── settings/
│   └── pages/Settings.tsx, ConnectedDevices.tsx
├── social/
│   ├── components/StoryCard.tsx, etc.
│   └── pages/Feed.tsx, StoryViewer.tsx
├── subscription/
│   └── pages/Subscription.tsx
└── territory/
    ├── pages/TerritoryMap.tsx
    └── services/territoryLayer.ts, claimEngine.ts
```

### Beat Pacer (Web Audio Metronome)

A cadence-locked running metronome built into the run screen. Uses the **Web Audio API** — no external dependencies or cost.

- **`beatService.ts`** — Look-ahead scheduler (Chris Wilson pattern), OscillatorNode synthesis, 3 sounds: click / woodblock / hi-hat
- **`BeatPacerSheet.tsx`** — Pace selector grid + sound options
- **Pace → BPM table:** 3:30=185, 4:00=180, 4:30=176, 5:00=172, 5:30=167, 6:00=163, 6:30=159, 7:00=155
- **Beat indicator** pulses via CSS `@keyframes beatPulse` (zero React re-renders per beat)
- Beat starts on the START RUN button tap (required for `AudioContext` user gesture)

---

## 5. Mobile App

> **`apps/mobile/`** — React Native 0.83.2 + Expo 55 + TypeScript

### Tech Stack

| Dependency | Version | Purpose |
|---|---|---|
| Expo | 55.0.8 | Build toolchain |
| React Native | 0.83.2 | UI framework |
| React Navigation | 7.1.34 | Stack + tab navigation |
| @maplibre/maplibre-react-native | 10.4.2 | Native map rendering |
| Lucide React Native | 0.577.0 | Icon set |
| expo-av | — | Audio playback (beat pacer, sounds) |
| expo-location | — | GPS tracking |
| expo-sqlite | — | Local database |
| expo-secure-store | — | Encrypted auth token storage |
| expo-task-manager | — | Background GPS location task |
| expo-sharing | — | Native share sheet |
| expo-image-picker | — | Photo upload |
| expo-notifications | — | Push notification handling |
| @kingstinct/react-native-healthkit | — | Apple HealthKit |
| react-native-revenuecat-purchases | — | In-app subscriptions |
| Supabase JS | 2.99.3 | Backend client |

### Path Aliases

```
@shared/*        →  packages/shared/src/*
@features/*      →  apps/mobile/src/features/*
@mobile/shared/* →  apps/mobile/src/shared/*
@navigation/*    →  apps/mobile/src/navigation/*
```

### Navigation Structure (AppNavigator.tsx)

#### Unauthenticated Stack
```
Landing  →  Login  →  SignUp
```

#### Authenticated App (Stack navigator wrapping tabs)

**Bottom Tab Navigator — 5 tabs:**

| Tab | Icon | Screen |
|---|---|---|
| Home | House | `Dashboard` |
| Map | Map | `TerritoryMap` |
| Run | Play circle | `Run` |
| Coach | Sparkles | `Coach` |
| Profile | User | `Profile` |

**Full-screen modal screens (pushed over tabs):**

| Screen | Route Name | Description |
|---|---|---|
| `ActiveRun` | ActiveRun | Live run |
| `RunSummary` | RunSummary | Post-run results |
| `Missions` | Missions | Daily/weekly missions |
| `Events` | Events | Event list |
| `CreateEvent` | CreateEvent | Create event |
| `Club` | Club | Club screen |
| `Lobby` | Lobby | Lobby list |
| `LobbyChat` | LobbyChat | Real-time lobby chat |
| `Leaderboard` | Leaderboard | Rankings |
| `CalorieTracker` | CalorieTracker | Nutrition tracker |
| `NutritionSetup` | NutritionSetup | Macro goal setup |
| `History` | History | Run history |
| `Settings` | Settings | Preferences |
| `ConnectedDevices` | ConnectedDevices | Wearable OAuth |
| `Gear` | Gear | Shoe tracker |
| `GearAdd` | GearAdd | Add shoe |
| `FootScan` | FootScan | AI foot scan |
| `Notifications` | Notifications | Notification inbox |
| `Subscription` | Subscription | Subscription plans |
| `StoryViewer` | StoryViewer | Full-screen stories |
| `Onboarding` | Onboarding | First-run setup flow |

### Feature Directory Structure

```
apps/mobile/src/features/
├── auth/
│   ├── components/   AuthInput, AuthButton, SocialLogin
│   ├── hooks/        useAuth.ts
│   ├── screens/      LoginScreen, SignUpScreen, LandingScreen
│   └── services/     authService.ts
├── clubs/
│   ├── components/   ClubCard, MemberList, InviteModal
│   ├── hooks/        useClub.ts
│   ├── screens/      ClubScreen
│   └── services/     clubService.ts
├── coach/
│   ├── components/   MessageBubble, TrainingPlanAccordion, TypingIndicator
│   ├── hooks/        useCoachChat.ts
│   ├── screens/      CoachScreen
│   └── services/     coachService.ts
├── dashboard/
│   ├── components/   HeroCard, WeeklyGoal, QuickStats, MissionsPreview
│   ├── hooks/        useDashboard.ts
│   ├── screens/      DashboardScreen
│   └── services/     dashboardService.ts
├── events/
│   ├── components/   EventCard, EventDetail
│   ├── hooks/        useEvents.ts
│   ├── screens/      EventsScreen, CreateEventScreen
│   └── services/     eventService.ts
├── gear/
│   ├── components/   ShoeCard, ShoeForm
│   ├── hooks/        useGear.ts
│   ├── screens/      GearScreen, AddShoeScreen, FootScanScreen
│   ├── services/     gearService.ts
│   └── types/        gear.ts
├── history/
│   ├── components/   RunCard, FilterBar
│   ├── hooks/        useHistory.ts
│   ├── screens/      HistoryScreen
│   └── services/     historyService.ts
├── leaderboard/
│   ├── components/   LeaderboardRow, PodiumCard
│   ├── hooks/        useLeaderboard.ts
│   ├── screens/      LeaderboardScreen
│   └── services/     leaderboardService.ts
├── missions/
│   ├── components/   MissionCard, MissionProgress
│   ├── hooks/        useMissions.ts
│   ├── screens/      MissionsScreen
│   └── services/     missionsService.ts
├── notifications/
│   ├── components/   NotificationItem
│   ├── hooks/        useNotifications.ts
│   ├── screens/      NotificationsScreen
│   └── services/     notificationService.ts
├── nutrition/
│   ├── components/   CalorieRing, MacroBars, MealSection, AddFoodModal, TrackerBody
│   ├── hooks/        useCalorieTracker.ts, useNutritionContext.ts, useNutritionSetup.ts
│   ├── screens/      CalorieTrackerScreen (Today/Insights tabs), NutritionSetupScreen
│   ├── services/     nutritionService.ts, nutritionSetupService.ts
│   └── types/        nutrition.ts
├── profile/
│   ├── components/   ProfileHeader, AwardsTab, GearTab, NutritionTab, RunsTab, StatsTab, EditProfileSheet
│   ├── hooks/        useProfile.ts
│   ├── screens/      ProfileScreen (5 tabs: overview / stats / awards / nutrition / gear)
│   └── services/     profileService.ts
├── run/
│   ├── components/   ActiveRunMapView, ActivityModal, ActivitySelector,
│   │                 BeatPacerChip, ClaimProgressRing, ClaimToast, FinishConfirmSheet,
│   │                 GoalSelector, LevelUpOverlay, PostRunInsightsCard, RewardsCard,
│   │                 RouteCard, RouteModal, RunControls, RunHUD, RunMapView,
│   │                 RunSetupSheet, RunStatGrid, ShoeChip, ShoeDrawer,
│   │                 SplitsList, TerritoryChips
│   ├── hooks/        useActiveRun.ts, useBeatPacer.ts, useRunSetup.ts, useRunSummary.ts
│   ├── screens/      RunScreen, ActiveRunScreen, RunSummaryScreen
│   ├── services/     locationTask.ts, runNavigationHelper.ts, runSetupService.ts, runSummaryService.ts
│   └── types/        run.ts
├── settings/
│   ├── components/   SettingsRow, ToggleRow
│   ├── hooks/        useSettings.ts
│   ├── screens/      SettingsScreen, ConnectedDevicesScreen
│   └── services/     settingsService.ts
├── social/
│   ├── components/   FeedCard, StoryRow, KudosBar
│   ├── hooks/        useFeed.ts
│   ├── screens/      FeedScreen, StoryViewerScreen
│   └── services/     feedService.ts
├── subscription/
│   ├── components/   PlanCard, FeatureList
│   ├── hooks/        useSubscription.ts
│   ├── screens/      SubscriptionScreen
│   └── services/     subscriptionService.ts
└── territory/
    ├── components/   TerritoryInfoPanel, ClaimButton
    ├── hooks/        useTerritory.ts
    ├── screens/      TerritoryMapScreen
    └── services/     territoryService.ts
```

### Mobile Shared Modules

```
apps/mobile/src/shared/
├── audio/
│   ├── generate-sounds.js          # Node script: generates all 13 WAV files via PCM synthesis
│   ├── sounds.native.ts            # Sound playback (expo-av)
│   └── files/                      # 13 synthesized WAV files
│       ├── click.wav               # Beat pacer metronome click
│       ├── tick.wav, claim.wav, coin.wav, start_run.wav, finish_run.wav
│       ├── level_up.wav, mission_complete.wav, tap.wav, notification.wav
│       └── own_zone.wav, enemy_zone.wav, error.wav
├── hooks/
│   └── usePlayerStats.ts           # XP, level, energy, streak from Supabase
└── components/
    └── (shared UI primitives)
```

### Beat Pacer (Mobile)

- **`useBeatPacer.ts`** — `expo-av` based metronome. Loads `click.wav` and schedules playback at the selected BPM.
- **`BeatPacerChip.tsx`** — HUD chip showing current BPM, tap to mute
- Same BPM table as web: 3:30→185 … 7:00→155
- Audio files generated by `generate-sounds.js` using pure PCM synthesis (no external assets required)

### Activity Types (18 total)

Both web and mobile support the same 18 activity types:

| ID | Label | Category |
|---|---|---|
| `run` | Run | Running |
| `jog` | Jog | Running |
| `sprint` | Sprint | Running |
| `interval` | Intervals | Running |
| `tempo` | Tempo | Running |
| `fartlek` | Fartlek | Running |
| `race` | Race | Running |
| `walk` | Walk | Outdoor |
| `hike` | Hike | Outdoor |
| `trail_run` | Trail | Outdoor |
| `cycle` | Cycle | Outdoor |
| `cross_country` | XC | Outdoor |
| `stair_climb` | Stairs | Outdoor |
| `hiit` | HIIT | Training |
| `strength` | Strength | Training |
| `swim` | Swim | Training |
| `wheelchair` | Wheelchair | Other |
| `ski` | Ski | Other |

---

## 6. Supabase Backend

### Architecture

```
Client (Web/Mobile)
      │
      ├── Supabase Auth (JWT sessions)
      ├── Supabase Realtime (notifications, lobby chat)
      ├── Supabase Storage (avatars, run photos)
      ├── Supabase DB (PostgreSQL + PostGIS)
      │     └── Row-Level Security on all tables
      └── Edge Functions (Deno)
            ├── ai-coach           (Anthropic Claude)
            ├── foot-scan          (Claude Vision)
            ├── device-oauth       (Garmin/Coros/Polar)
            ├── device-webhook     (incoming activity data)
            ├── send-push-notification
            ├── rc-webhook         (RevenueCat)
            └── stripe-webhook     (Stripe billing)
```

### RLS Policy Pattern

All tables enforce owner-based access:
```sql
CREATE POLICY "owner_all" ON table_name
  FOR ALL USING (auth.uid() = user_id);
```

---

## 7. Edge Functions

### `ai-coach`
**Runtime:** Deno + Anthropic SDK

Handles all AI features. Called with a `feature` field in the body:

| Feature | What it does |
|---|---|
| `coach_chat` | Conversational AI coach with full run history context |
| `post_run` | Analyses a specific run and returns praise, analysis, suggestion, recovery |
| `weekly_brief` | Generates a weekly summary: headline, tip, insights array, nutrition connection |
| `training_plan` | Produces a multi-week training plan JSON given a goal |
| `nutrition_insights` | Analyses logged meals + runs to produce insight cards |

Context passed to every prompt: recent runs, personal records, shoe mileage, nutrition logs, active missions, territory count, current streak.

### `foot-scan`
**Runtime:** Deno + Anthropic Vision

- Accepts `{ imageBase64, mimeType }` POST
- Sends image to Claude with a prompt to detect arch type
- Returns `{ archType: "flat"|"neutral"|"high", confidence: number, explanation: string, shoeRecommendation: string }`
- Result stored in `profiles.foot_type` and `profiles.foot_scan_at`

### `device-oauth`
**Runtime:** Deno

OAuth integration for wearables. Supports **Garmin**, **Coros**, **Polar**.

| Method | Action |
|---|---|
| `GET ?provider=garmin` | Redirect to provider OAuth page |
| `POST` | Exchange auth code → store tokens in `device_connections` |
| `DELETE` | Revoke and delete connection |

### `device-webhook`
**Runtime:** Deno

Receives incoming activity payloads from connected wearables. For each activity:
1. Verifies provider signature
2. Normalises to internal `device_activities` schema
3. Attempts to match with an existing `runs` row (within ±5 min start time)
4. Enriches matched run with HR, cadence, elevation, HRV data

### `send-push-notification`
Delivers push notifications to both:
- **Web**: VAPID Web Push (stored in `push_subscriptions`)
- **Mobile**: Expo Push API (tokens in `expo_push_tokens`)

### `rc-webhook`
RevenueCat subscription lifecycle handler. Maps entitlements to internal tiers:
- `runivo_plus` → `runner-plus`
- Updates `profiles.subscription_tier` on purchase, renewal, cancellation

### `stripe-webhook`
Handles Stripe billing events (charge succeeded/failed, subscription updated/cancelled).

---

## 8. Database Schema

### Core Tables

| Table | Key Columns | Notes |
|---|---|---|
| `profiles` | id, username, level, xp, coins, energy, streak_days, subscription_tier, foot_type, avatar_color, avatar_url | Central user record. Linked to `auth.users`. |
| `runs` | id, user_id, started_at, distance_m, duration_s, avg_pace, shoe_id, activity_type, gps_points | Core activity record. PostGIS geometry for route. |

### Social

| Table | Purpose |
|---|---|
| `feed_posts` | User activity posts (runs, achievements) |
| `feed_post_comments` | Post comments |
| `feed_post_likes` | Emoji reactions on posts |
| `kudos` | Running-specific kudos between runners |
| `followers` | Follow relationships (follower_id → following_id) |
| `stories` | 24-hour ephemeral story posts (auto-expire) |

### Community

| Table | Purpose |
|---|---|
| `clubs` | Running clubs (name, description, creator, type, privacy) |
| `club_members` | Club membership (role: owner/admin/member) |
| `club_messages` | Real-time club chat messages |
| `lobbies` | Named lobby channels inside clubs |

### Territory

| Table | Purpose |
|---|---|
| `territories` | Hex zones (h3_index, owner_id, claimed_at, last_defended_at) |

RPC: `claim_territory(h3_index, lat, lng)` — validates GPS proximity, awards XP/coins, updates ownership.

### Events & Missions

| Table | Purpose |
|---|---|
| `events` | Community events (title, date, location, max_participants) |
| `event_participants` | RSVP tracking |
| `missions` | Mission definitions |
| `mission_progress` | Per-user mission completion state |

### Notifications

| Table | Purpose |
|---|---|
| `notifications` | In-app notifications (type, title, body, is_read, created_at) — Realtime enabled |
| `push_subscriptions` | Web Push VAPID subscriptions |
| `expo_push_tokens` | Mobile Expo push tokens |

### Gear & Health

| Table | Purpose |
|---|---|
| `shoes` | Running shoes (brand, model, max_km, is_retired, color) |
| `biometrics` | Body metrics (height, weight, resting HR, VO2max) |

### Nutrition

| Table | Purpose |
|---|---|
| `nutrition_profiles` | Daily macro goals (kcal, protein, carbs, fat) |
| `nutrition_logs` | Food diary entries (date, meal_type, kcal, macros) |

### AI & Devices

| Table | Purpose |
|---|---|
| `ai_cache` | Cached AI responses (key/value per user) |
| `coach_messages` | AI coach conversation history |
| `ai_usage_log` | Claude API token usage tracking (cost control) |
| `device_connections` | OAuth tokens for Garmin/Coros/Polar (encrypted via Vault) |
| `device_activities` | Raw + normalised activity data from wearables |

### Subscription

| Table | Purpose |
|---|---|
| `profiles.subscription_tier` | Column on profiles: `free | runner-plus | territory-lord | empire-builder` |

---

## 9. Feature Status

### ✅ Fully Built

| Feature | Web | Mobile | Notes |
|---|---|---|---|
| **Dashboard** | ✅ | ✅ | Hero stats, missions preview, weekly goal, recent runs |
| **Territory Map** | ✅ | ✅ | MapLibre GL, H3 hexes, live claiming, colour coding by owner |
| **Active Run** | ✅ | ✅ | Live GPS, pace/distance HUD, territory claiming, Beat Pacer |
| **Run Summary** | ✅ | ✅ | Full stats, splits, AI insights card, shoe chip, share |
| **Profile** | ✅ | ✅ | 4-5 tabs: overview, stats, awards, nutrition, gear |
| **Leaderboard** | ✅ | ✅ | Weekly / all-time, sort by distance / XP / territories |
| **Missions** | ✅ | ✅ | Daily + weekly missions, progress rings, claim rewards |
| **Feed** | ✅ | ✅ | Stories row, activity posts, kudos, explore |
| **Stories** | ✅ | ✅ | 24-hour story viewer, full-screen |
| **AI Coach** | ✅ | ✅ | Chat, training plan generator, quick prompt buttons |
| **Gear / Shoes** | ✅ | ✅ | Shoe inventory, mileage bar, retire/default actions |
| **Foot Scan** | ✅ | ✅ | Camera → Claude Vision → arch type + shoe recommendation |
| **Nutrition Tracker** | ✅ | ✅ | Calorie ring, macros, meals, Today + Insights tabs |
| **History** | ✅ | ✅ | Run log with filters |
| **Notifications** | ✅ | ✅ | Bell inbox, real-time, push |
| **Settings** | ✅ | ✅ | Distance units, weekly goal, notifications, connected devices |
| **Subscription** | ✅ | ✅ | Plan cards, RevenueCat (mobile), Stripe (web) |
| **Onboarding** | ✅ | ✅ | Goal, playstyle, experience setup |
| **Beat Pacer** | ✅ | ✅ | Web Audio API (web), expo-av (mobile) |

### ⚠️ Functional but Partial

| Feature | Gap |
|---|---|
| **Events** | Create & RSVP works; no participant list, no map pin for event location |
| **Club** | Create/join/invite works; no live member count, no admin controls |
| **Lobby Chat** | Real-time messages work; no message reactions, no thread support |
| **Connected Devices** | OAuth flow built; activity enrichment from wearable data needs testing |
| **AI Insights** | `useWeeklyBrief` and `usePostRunInsights` return stubs — edge function exists but hooks not wired to it |
| **Social Feed** | Posts shown; no share-run-to-feed flow after a run |

### ❌ Not Yet Built / Stub

| Feature | Status |
|---|---|
| **Race Predictions** | UI placeholder in Profile stats tab; no actual prediction model |
| **Passive Energy Regen** | Service exists; not surfaced in UI |
| **Route Ghost** | `ghostRoute` passed to ActiveRun but ghost rendering not implemented on mobile |
| **Club Events** | Events are global only; no club-specific events |
| **Social DMs** | No direct messaging |
| **Apple Health auto-sync** | HealthKit service exists; no auto-background sync after runs |

---

## 10. Tech Stack

### Summary Table

| Layer | Web | Mobile |
|---|---|---|
| Language | TypeScript | TypeScript |
| Framework | React 19 | React Native 0.83 / Expo 55 |
| Bundler | Vite 4 | Metro (Expo) |
| Routing | React Router 6 | React Navigation 7 |
| Styling | Tailwind CSS + inline styles | StyleSheet (inline tokens) |
| Animation | Framer Motion | React Native Reanimated |
| Maps | MapLibre GL JS | @maplibre/maplibre-react-native |
| Icons | Lucide React | Lucide React Native |
| Audio | Web Audio API (beatService) | expo-av |
| Database (local) | IndexedDB (store.ts) | SQLite (store.native.ts) |
| Sync | store.ts + sync.ts | store.native.ts + sync.ts |
| Auth | Supabase Auth | Supabase Auth + expo-secure-store |
| Backend | Supabase | Supabase |
| AI | Anthropic Claude (edge fn) | Anthropic Claude (edge fn) |
| Payments | Stripe (web) | RevenueCat (mobile) |
| Health | — | @kingstinct/react-native-healthkit |
| Push | VAPID Web Push | Expo Push Notifications |
| Geo | h3-js + MapLibre | h3-js + MapLibre Native |

### Design Token Conventions

Both apps share the same color and font tokens (not via a file — each uses local constants):

```
Background:  #F8F6F3  (warm off-white)
White:       #FFFFFF
Black:       #0A0A0A
Red:         #D93518  (primary action / run)
Purple:      #5A3A8A  (AI / intelligence)
Green:       #1A6B40  (success / owned territory)
Amber:       #9E6800  (warnings / worn shoes)
Border:      #DDD9D4
Muted text:  #ADADAD

Fonts:
  Barlow_300Light        (body light)
  Barlow_400Regular      (body)
  Barlow_500Medium       (emphasis)
  Barlow_600SemiBold     (labels, buttons)
  PlayfairDisplay_400Regular_Italic  (display / headers)
```

---

## 11. Subscription System

### Tiers

| Tier | ID | Unlock |
|---|---|---|
| Free | `free` | Core running + territory claiming |
| Runner Plus | `runner-plus` | AI Coach, advanced stats, unlimited shoe tracking |
| Territory Lord | `territory-lord` | All Runner Plus + expanded territory radius |
| Empire Builder | `empire-builder` | All + analytics dashboard, priority support |

### Implementation

- **Mobile**: RevenueCat manages purchase flow. `rc-webhook` Supabase edge function updates `profiles.subscription_tier` on entitlement changes.
- **Web**: Stripe checkout. `stripe-webhook` edge function handles lifecycle events.
- **Gating**: Feature-level checks read `profiles.subscription_tier` from Supabase.

---

## 12. AI Integration

All AI features go through the `ai-coach` Supabase edge function using the Anthropic Claude SDK.

### Context Passed to Every Prompt

```
- Last 10 runs (distance, pace, duration, date, activity type)
- Personal records (5K, 10K, half, marathon, longest, fastest)
- Active shoes + mileage % worn
- Current week nutrition summary
- Active missions progress
- Territory count + recent claims
- Current streak days
- Subscription tier
```

### AI Features

| Feature | Trigger | Output |
|---|---|---|
| Weekly Brief | Automatic (Profile > Stats tab) | Headline, tip, 3-5 insights, nutrition connection |
| Post-Run Analysis | After every run (RunSummary) | Praise, analysis, improvement suggestion, recovery advice |
| Training Plan | On demand (Coach screen) | Multi-week plan with daily workouts |
| Coach Chat | On demand (Coach screen) | Conversational coaching with full context |
| Nutrition Insights | On demand (CalorieTracker > Insights) | Pattern analysis cards, macro advice |
| Foot Scan | On demand (Gear > Scan) | Arch type, confidence, shoe recommendation |

### Cost Controls

- All AI responses cached in `ai_cache` table (key = `feature:userId`)
- `ai_usage_log` tracks token usage and estimated cost per call
- Weekly brief is refreshed lazily (only when explicitly triggered)

---

## 13. Device Integration

### Supported Wearables

| Device | Status | Method |
|---|---|---|
| Garmin | ✅ Built | OAuth + Garmin Activity API webhook |
| Coros | ✅ Built | OAuth + webhook |
| Polar | ✅ Built | OAuth + webhook |
| Apple Watch | ⚠️ Partial | HealthKit read (steps, HR, workouts) — no OAuth |
| Google Fit | ❌ Not built | — |

### Data Flow

```
User runs with Garmin watch
→ Garmin pushes activity to device-webhook edge function
→ Webhook normalises payload to internal schema
→ Attempts to match existing run record (±5 min window)
→ Enriches run with: average HR, max HR, cadence, elevation gain, HRV
→ Run Summary shows enriched metrics
```

### Apple HealthKit

- `appleHealthService.native.ts` reads: steps, active calories, resting HR, VO2max, workout records
- Data used in: dashboard stats, AI context, Profile > Stats
- Auto-background sync: service exists, UI integration pending

---

## 14. How to Run

### Prerequisites

```bash
node >= 20
npm >= 9
Supabase CLI (for local dev)
Expo CLI: npx expo
```

### Environment Variables

**`apps/web/.env`**:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_VAPID_PUBLIC_KEY=
VITE_E2E_TEST_MODE=false
```

**`apps/mobile/.env`** (via app.config.ts):
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

**`supabase/functions/.env`** (edge function secrets):
```
ANTHROPIC_API_KEY=
REVENUECAT_WEBHOOK_AUTH=
STRIPE_WEBHOOK_SECRET=
VAPID_PRIVATE_KEY=
VAPID_PUBLIC_KEY=
```

### Development

```bash
# Install all dependencies (root, web, mobile, shared)
npm install

# Run web app
npm run web
# → http://localhost:5173

# Run mobile (Expo Metro bundler)
npm run mobile
# → Scan QR code with Expo Go or run on simulator

# iOS simulator
npm run ios

# Android emulator
npm run android

# Apply local DB migrations (requires Supabase CLI linked project)
supabase db push
```

### Build

```bash
# Web production build
cd apps/web && npm run build
# Output: apps/web/dist/

# Mobile EAS build (requires EAS CLI)
cd apps/mobile
eas build --platform ios
eas build --platform android
```

---

*Generated by exploring the codebase at `/Users/mohammedmehtabafsar/Desktop/Runivo` on March 24, 2026.*
