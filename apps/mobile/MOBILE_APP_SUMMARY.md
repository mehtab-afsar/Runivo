# Runivo Mobile App — Feature Summary

> Platform: React Native (Expo SDK 55) · Language: TypeScript · Navigation: React Navigation v6

---

## Architecture

```
apps/mobile/
├── src/
│   ├── features/          # Feature-sliced modules
│   ├── navigation/        # AppNavigator (tabs + stack)
│   ├── shared/            # Audio, components shared across features
│   └── index.ts           # Entry point + polyfills
├── App.tsx
└── app.json
```

Shared business logic lives in `packages/shared/src/` and is aliased as `@shared/*` in both mobile and web apps.

---

## Navigation Structure

### Bottom Tab Bar (5 tabs)
| Tab | Screen | Description |
|-----|---------|-------------|
| Home | `DashboardScreen` | Bento-grid home with stats, missions, leaderboard |
| Map | `TerritoryMapScreen` | Live MapLibre territory map |
| Run | `RunScreen` | Run setup sheet |
| Coach | `CoachScreen` | AI running coach chat |
| Profile | `ProfileScreen` | User profile + stats |

### Stack Screens (navigated from tabs)
`ActiveRun`, `RunSummary`, `Missions`, `Events`, `CreateEvent`, `Club`, `Lobby`, `LobbyChat`, `Leaderboard`, `CalorieTracker`, `NutritionSetup`, `History`, `Settings`, `ConnectedDevices`, `Gear`, `GearAdd`, `FootScan`, `Notifications`, `Subscription`, `StoryViewer`

---

## Features

### Authentication
**Screens:** `LandingScreen`, `LoginScreen`, `SignUpScreen`, `OnboardingScreen`

- Landing page with brand intro
- Email/password login and sign-up via Supabase Auth
- 6-step onboarding flow:
  1. **Welcome** — experience level selection (Beginner / Intermediate / Advanced / Elite)
  2. **Avatar** — gender, age, height, weight with drum pickers
  3. **Goal** — 5 goal cards (Lose weight / Build endurance / Run faster / Run a race / Stay active)
  4. **Target** — weekly schedule (day chips) + distance chips; summary shows days × km/week
  5. **Notifications** — enable push notifications toggle
  6. **Ready** — check-ring animation + summary cards → "Start running"

---

### Dashboard (Home)
**Screen:** `DashboardScreen`

Bento-grid layout:
- **Header**: Greeting + username (Playfair italic) · Bell icon (red dot if unread) · Avatar with XP ring
- **Currency bar**: Total XP + level title (e.g. "2,450 XP · Ranger"); energy pill shown only when < 5
- **Bento grid**:
  - Leaderboard card (user rank, weekly XP, 7-bar activity chart)
  - Events card
  - Clubs card
  - Feed card (social activity preview)
  - Start Run button (full width, black bg, red play circle)
- **Empire card**: Zones owned / Enemy zones / Avg defense / XP earned · "View map →" link
- **Missions card**: "+Up to 300 XP today" · 3 mission preview slots · "Choose missions →"
- **Recent runs**: Last 3 runs with activity type, date, distance, duration

---

### Territory Map
**Screen:** `TerritoryMapScreen`

- Full-screen MapLibre GL map (via `@maplibre/maplibre-react-native`)
- Hexagonal territory cells rendered as GeoJSON polygons
- Color coding: owned (green), enemy (red), free (grey)
- Stats bar overlay: owned count / enemy count / free count
- Tap cell → claim/attack action sheet with XP reward preview
- Territory stats synced to Supabase in real time

---

### Run Tracking
**Screens:** `RunScreen`, `ActiveRunScreen`, `RunSummaryScreen`

**RunScreen (setup sheet)**
- Route type selector: outdoor GPS / indoor treadmill / trail
- Distance goal chips (5k / 10k / half / custom)
- Beat Pacer toggle with BPM display
- Shoe selector (default shoe shown)
- Start Run button

**ActiveRunScreen (live run)**
- Large elapsed time display
- Live stats: pace, distance, heart rate
- Beat Pacer chip: BPM display + mute toggle + pulse dot (25ms metronome, expo-av click.wav)
- Map overlay with GPS trace
- Pause / Stop controls

**RunSummaryScreen (post-run)**
- Route map replay
- Stats card: distance, time, avg pace, elevation
- Rewards card: XP earned
- Recovery card (when distance > 1 km): estimated kcal burned · "Log post-run meal →"
- Shoe worn badge (km increment applied to default shoe)

---

### Beat Pacer
**Hook:** `useBeatPacer` · **File:** `features/run/hooks/useBeatPacer.ts`

Metronome system that plays a click sound at a BPM matched to target pace:

| Pace (min/km) | BPM |
|--------------|-----|
| 3:30 | 185 |
| 4:00 | 180 |
| 4:30 | 176 |
| 5:00 | 172 |
| 5:30 | 167 |
| 6:00 | 163 |
| 6:30 | 159 |
| 7:00 | 155 |

- 25ms scheduler loop with 100ms lookahead
- expo-av for click.wav playback
- AppState listener: pauses on background, resumes on foreground
- Persisted settings: `beatPacerEnabled`, `beatPacerPace`

---

### AI Coach
**Screen:** `CoachScreen`

- Chat interface with Claude (Anthropic API)
- Persistent conversation history per user
- Context-aware: knows user's recent runs, XP level, goals
- Suggested prompts for common questions (pacing, nutrition, training plans)
- "Ask Coach for deeper insights →" CTA from CalorieTracker

---

### Missions
**Screen:** `MissionsScreen`

- Daily mission pool with varying XP rewards (up to 300 XP/day)
- Mission types: distance goals, pace goals, zone claims, social actions
- Pick 3 missions per day
- Progress tracked in real time during run
- Completion triggers XP award + sound effect

---

### Leaderboard
**Screen:** `LeaderboardScreen`

- Weekly XP leaderboard (global + friends)
- User rank card pinned at top
- 7-bar weekly activity chart per user
- Friends-only filter toggle

---

### Calorie Tracker
**Screens:** `CalorieTrackerScreen`, `NutritionSetupScreen`

**Today tab**
- Circular progress ring: consumed kcal vs daily goal
- Run burn chip: "+X kcal burned today" (from today's run distance × MET formula)
- Meals accordion: Breakfast / Lunch / Dinner / Snacks
- Add food modal: name, kcal, protein, carbs, fat, meal selector
- Context banner: smart message when protein is low or run happened today

**Insights tab**
- Weekly 7-bar calorie chart with goal line overlay
  - Green = under goal · Orange = over goal · Red = today
  - Day labels (Mo–Su), average kcal badge
- Macro summary card: Protein / Carbs / Fat with progress bars
- Weekly stats card: avg kcal/day · days logged · vs goal (±)
- "Ask Coach for deeper insights →" button

**Setup**: weight, height, age, activity level → auto-calculates TDEE and macro split

---

### Gear / Shoe Tracker
**Screens:** `GearScreen`, `GearAddScreen`, `FootScanScreen`

**GearScreen**
- Active shoes list with `ShoeCard` components
- "RETIRED" section label separating retired shoes
- Retirement toast: "[Nike Pegasus 40] · 847km · Well run."
- Pull-to-refresh
- FootScan button (🦶) in header → FootScanScreen

**ShoeCard**
- Brand, model, nickname
- Category chip (Road / Trail / Track)
- Mileage progress bar: green (0–60%) · amber (60–85%) · red >85% with WORN badge · >100% REPLACE badge
- X km / Y km max · Last used date
- Default ✓ badge
- Actions: Set Default · Retire · Delete

**GearAddScreen**
- Form: brand, model, nickname, category, max km
- Color picker for shoe dot

**FootScanScreen**
- 4-step foot type assessment (flat / neutral / high arch)
- Result stored to `profile.foot_type` via `saveProfile()`

---

### Social Feed
**Screen:** `FeedScreen`, `StoryViewerScreen`

- Activity feed: run posts from followed users
- Story rings at top (friends' recent runs)
- StoryViewer: full-screen route map + stats overlay
- Like + comment on runs
- Accessible via Dashboard → Feed card

---

### Events
**Screens:** `EventsScreen`, `CreateEventScreen`

- Browse upcoming community running events
- Filter by distance / date / location
- Create event: title, date, location, distance, description
- RSVP with participant count
- Event posts appear in Feed

---

### Clubs
**Screens:** `ClubScreen`, `LobbyScreen`, `LobbyChatScreen`

- Running clubs with member leaderboards
- Lobby: club activity wall + member list
- LobbyChat: real-time club group chat (Supabase Realtime)
- Join / leave club
- Club XP pool (sum of member weekly XP)

---

### Profile
**Screen:** `ProfileScreen`

- Avatar + username + level badge
- Total XP · Current streak · Total km
- XP progress bar to next level
- Stats grid: runs, total time, zones owned
- Recent activity timeline
- Links to History, Gear, Settings

---

### History
**Screen:** `HistoryScreen`

- Full run log with filters (this week / this month / all time)
- Calendar heatmap of run frequency
- Each run entry: date, distance, pace, duration, route thumbnail
- Tap run → expanded stats (elevation, heart rate, splits)

---

### Notifications
**Screen:** `NotificationsScreen`

- In-app notification centre
- Types: XP earned, zone attacked, mission completed, friend activity, event reminders
- Red dot on bell icon in Dashboard header when unread

---

### Settings
**Screen:** `SettingsScreen`, `ConnectedDevicesScreen`

**SettingsScreen**
- Profile edit (display name, avatar)
- Units: km / mi toggle
- Sound on/off + volume
- Beat Pacer: default pace selector
- Notifications preferences
- Links: Connected Devices, Subscription, Privacy Policy, Sign Out

**ConnectedDevicesScreen**
- Apple Health (HealthKit) connect/disconnect · last sync time
- Garmin Connect OAuth flow
- COROS OAuth flow
- Polar OAuth flow
- Enriched run data from wearables: avg HR, cadence, elevation

---

### Subscription
**Screen:** `SubscriptionScreen`

- Free vs Pro tier comparison
- Pro features: unlimited zone claims, advanced coach, wearable sync, no ads
- In-app purchase via RevenueCat (or Stripe web)

---

## Game Engine (Gamification)

**Hook:** `useGameEngine` · **Config:** `packages/shared/src/services/config.ts`

| Mechanic | Value |
|----------|-------|
| XP per km | 10 |
| XP per zone claim | 25 |
| XP per mission | 50–150 |
| Energy max | 10 |
| Energy cost (zone claim) | 1 |
| Energy regen | 1/hr + 1/km |
| Level thresholds | 500 XP steps |

Level titles: Recruit → Runner → Pacer → Ranger → Strider → Racer → Elite → Champion → Legend → Conqueror

---

## Sound System

**File:** `apps/mobile/src/shared/audio/sounds.native.ts`

Lazy-loaded expo-av sounds:

| Event | Sound file |
|-------|-----------|
| Run started | `start_run.mp3` |
| Run finished | `finish_run.mp3` |
| Zone claimed | `claim.mp3` |
| Level up | `level_up.mp3` |
| Mission complete | `mission_complete.mp3` |
| Notification | `notification.mp3` |
| UI tap | `tap.mp3` |
| Own zone (map) | `own_zone.mp3` |
| Enemy zone (map) | `enemy_zone.mp3` |
| Error | `error.mp3` |
| Beat Pacer click | `click.wav` |

Sounds unload when app goes to background (AppState listener). Volume + enabled state persisted in AsyncStorage.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native via Expo SDK 55 |
| Language | TypeScript 5 |
| Navigation | React Navigation v6 (native stack + bottom tabs) |
| State | React hooks + context (no Redux) |
| Backend | Supabase (Postgres + Auth + Realtime + Edge Functions) |
| Maps | MapLibre GL via `@maplibre/maplibre-react-native` |
| Audio | expo-av |
| Fonts | Playfair Display (Italic) + Barlow (300/400/500/600) |
| Icons | lucide-react-native |
| Storage | expo-sqlite (local) + Supabase (remote) |
| AI | Anthropic Claude API (Coach feature) |
| Wearables | react-native-healthkit (Apple) · Garmin/COROS/Polar via OAuth |
| Polyfills | react-native-get-random-values, react-native-url-polyfill, text-encoding, buffer |

---

## Design System

```
Background:  #F8F6F3 / #EDEAE5
Black:       #0A0A0A
Red:         #D93518    (primary CTA, active states)
Red light:   #FEF0EE
Text mid:    #6B6B6B
Text light:  #ADADAD
Border:      #DDD9D4
Divider:     #E8E4DF
Green:       #1A6B40    (success, under-goal)
Amber:       #9E6800    (warning, near-limit)
Green bg:    #EDF7F2
Amber bg:    #FDF6E8

Typography
  Hero / titles:   Playfair Display 400 Italic
  Body / UI:       Barlow 300 Light / 400 Regular / 500 Medium / 600 SemiBold

Cards:   borderRadius 12–16px · border 0.5px #DDD9D4 · no drop shadows
Buttons: borderRadius 4px · uppercase · letterSpacing 0.08em
Inputs:  underline only (borderBottomWidth: 1) · label 8px uppercase above
```
