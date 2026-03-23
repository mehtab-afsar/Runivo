# Runivo Mobile App — Complete Overview

Runivo is a territory-control running game for iOS and Android. Every run you complete physically claims hexagonal zones on a live city map. Other runners can steal your territory. You defend it by fortifying. The app combines GPS run tracking, social features, nutrition logging, AI coaching, and in-app purchases into a single product.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native + Expo SDK 55 |
| Language | TypeScript |
| Navigation | React Navigation 7 (native stack + bottom tabs) |
| Backend | Supabase (Postgres + Realtime + Storage + Edge Functions) |
| Local storage | expo-sqlite (native) / idb IndexedDB (web) |
| Maps | @maplibre/maplibre-react-native |
| Hex grid | h3-js |
| Auth tokens | expo-secure-store |
| Notifications | expo-notifications (Expo Push) |
| Health | react-native-health (iOS) / react-native-health-connect (Android) |
| Purchases | RevenueCat (react-native-purchases) |
| Fonts | Barlow + Playfair Display (expo-google-fonts) |
| Build | EAS Build (development / preview / production profiles) |
| OTA updates | EAS Update |

---

## Architecture

```
runivo/
├── apps/
│   ├── mobile/          ← Expo React Native app (this document)
│   └── web/             ← Vite/React web app (same Supabase backend)
├── packages/
│   └── shared/          ← Business logic shared by both apps
│       ├── services/    ← Supabase, store, sync, auth, missions, config
│       ├── hooks/       ← useAuth, useGameEngine
│       ├── types/       ← TypeScript types for game entities
│       └── lib/         ← avatarUtils, haptics
└── supabase/
    ├── migrations/      ← 46 SQL migrations
    └── functions/       ← 7 edge functions
```

Metro resolves `@shared/*` → `packages/shared/src/`. Platform-specific files use `.native.ts` extension (e.g. `pushNotificationService.native.ts` overrides the web VAPID implementation).

---

## Navigation

### Unauthenticated stack
```
Landing → Login → SignUp
```

### Authenticated
```
Main (Tab Navigator)
├── Dashboard (Home tab)
├── TerritoryMap (Map tab)
├── Run (Run tab)
├── Feed (Feed tab)
└── Profile (Me tab)

Stack screens (pushed over tabs):
ActiveRun, RunSummary, Coach, Missions, Events, CreateEvent,
Club, Lobby, LobbyChat, Leaderboard, CalorieTracker,
NutritionSetup, History, Settings, Gear, GearAdd,
Notifications, Subscription, StoryViewer, Onboarding
```

### Deep links
- Scheme: `runivo://`
- Universal links: `https://runivo.app`
- Used for: Supabase magic-link auth callbacks, push notification tap routing

---

## Screens (28 total)

### Core Run Flow

#### `RunScreen` — Pre-run launch
- Full-screen MapLibre map showing territory ownership
- Territory intel chips: enemy zones / neutral / weak defenses nearby
- Activity type picker: Run · Walk · Jog · Cycle · Hike · Trail Run · Sprint · Interval · Tempo · Fartlek · Race + 7 more
- Saved routes picker with "Nearby routes" via Supabase RPC
- Draggable bottom sheet (PanResponder, collapses to 240px / expands to 420px)
- GPS status pill (searching → ready → active)
- Map style toggle: Standard / Dark / Light
- Tap Start → navigates to ActiveRun

#### `ActiveRunScreen` — Live run tracking
- Real-time GPS via `expo-location` with background task
- Live stats: distance (km/mi), current pace, elapsed time, calories
- Animated claim progress ring — fills as you dwell in a territory
- Territory claim toast notifications
- Pause / Resume / End controls
- Wake lock via `expo-keep-awake`
- Route drawn on map as you move

#### `RunSummaryScreen` — Post-run results
- Distance, average pace, duration, elevation
- Territories claimed count with names
- XP earned, coins earned, bonus coins
- Level-up animation if you ranked up during the run
- Completed missions highlighted
- Per-km splits table
- Shoe mileage auto-incremented
- Writes run to Apple Health / Health Connect
- Enemy territories captured count

### Territory & Map

#### `TerritoryMapScreen` — Territory overview (Map tab)
- Full-screen MapLibre GL map
- GeoJSON `FeatureCollection` with per-feature fill colors:
  - Green = owned by you
  - Red = owned by enemy
  - Grey = neutral
  - Orange = weakly defended
- Filter chips: All · Mine · Enemy · Weak · Free
- Stats header: owned / enemy / free counts with colour dots
- Tap a territory → bottom sheet with defense progress bar, owner name, "Run to Claim" button
- Recenter button, map style picker (Standard / Dark / Light)
- `flyTo()` animation on territory select

### Social

#### `FeedScreen` — Social activity feed (Feed tab)
- Explore tab: runs from all users, ranked by recency/distance
- Following tab: runs from users you follow
- Run cards: avatar, username, distance, pace, territories, emoji activity type
- Like + comment counts with tap handlers
- Inline stories row at top — tap to open `StoryViewerScreen`
- Follow / Unfollow from feed
- Time-ago formatting ("2h ago", "yesterday")

#### `StoryViewerScreen` — Instagram-style story viewer
- Full-screen image display with dark overlay
- Animated progress bars (one per story in group), driven by `Animated.timing`
- Auto-advances after 5 seconds per story
- Press-and-hold to pause (resumes from exact position using `anim._value`)
- Tap left half → previous story / previous user
- Tap right half → next story / next user
- Cross-group navigation (moves through all users' stories sequentially)
- Initials avatar + username in header
- Close button → `navigation.goBack()`

#### `ProfileScreen` — Player profile (Me tab)
- Overview / Stats / Gear tabs
- Animated XP ring with level badge
- Personal records: fastest km, longest run, best pace, most territory in one run
- All-time stats: total distance, total time, run count, territories owned
- Shoe list with wear percentage
- Avatar with deterministic colour from username hash

### Missions & Progression

#### `MissionsScreen` — Daily missions
- 3–5 missions generated daily per player
- Progress bars with current / target values
- Difficulty badges: Easy / Medium / Hard
- Emoji icons per mission type
- Claim reward button (grants XP + coins, updates Supabase)
- Mission types: run distance, claim territories, fortify, capture enemy, explore new hexes, speed run, run streak, beat pace, complete run

#### `DashboardScreen` — Home (Dashboard tab)
- Player level + XP ring animation
- Stats row: distance this week, runs, territories owned, streak
- Today's missions preview (top 3 with progress)
- Recent runs list
- Sync status indicator
- Quick-launch buttons to Run and Missions

### Clubs & Social Rooms

#### `ClubScreen` — Club browser
- Browse and join running clubs
- Club cards: badge emoji, name, member count, total club distance
- Join / Leave toggle
- Club description
- Owner info
- Create club form

#### `LobbyScreen` — Chat lobbies list
- 5 predefined lobby rooms: Global · Training · Races · Speed · Night Runners
- Room cards with emoji, description, live message count
- Tap to enter `LobbyChatScreen`

#### `LobbyChatScreen` — Real-time chat
- Supabase Realtime subscription per room
- Messages with user avatar (colour-coded), username, level badge, timestamp
- Text input with send button
- Auto-scroll to latest message
- Formatted timestamps

### Events

#### `EventsScreen` — Community events
- List of upcoming runs and races
- Event cards: emoji category, title, date/time, location, distance, participant count
- Join / Leave toggle
- Filter by category

#### `CreateEventScreen` — Create new event
- Title, type, date picker, time picker
- Location text field
- Distance (km/mi)
- Description (multiline)
- Saves to Supabase `events` table
- Form validation with field-level error messages

### Nutrition

#### `CalorieTrackerScreen` — Daily nutrition log
- Circular progress ring: consumed / daily goal calories
- Remaining calories label
- Meal sections: Breakfast · Lunch · Dinner · Snacks
- Add food entry per meal
- Delete entries with swipe
- FoodSearch modal (searches food database)
- Run calories auto-deducted from balance

#### `NutritionSetupScreen` — Nutrition profile setup
- Age, gender, weight (kg/lbs), height (cm/ft)
- Activity level selector (sedentary → very active)
- Dietary preferences (omnivore / vegetarian / vegan / keto / paleo)
- Weekly goal (weight loss / maintain / gain)
- Auto-calculated daily calorie target using Mifflin-St Jeor formula
- Saves to `nutrition_profiles` table

### Gear

#### `GearScreen` — Shoe management
- Shoe list with wear progress bar (current km / max km)
- Retirement alert when >85% worn
- Default shoe badge
- Category labels: Road · Trail · Track · Casual
- Total mileage per pair
- Swipe to delete / retire

#### `GearAddScreen` — Add / edit shoe
- Brand, model, nickname text inputs
- Shoe category picker
- Max mileage capacity slider
- Colour swatch selector
- Photo picker: camera or photo library via `expo-image-picker`
- Photo upload to Supabase Storage `user-media` bucket
- Thumbnail preview

### Leaderboard

#### `LeaderboardScreen` — Rankings
- Tab switcher: Distance · XP · Territories
- Timeframe picker: This Week · This Month · All Time
- Gold / Silver / Bronze medal badges for top 3
- Rank number, avatar, username, value for all entries
- Pulls from Supabase leaderboard RPC

### AI Coach

#### `CoachScreen` — AI running coach
- Chat interface with streaming Claude responses
- Quick prompt buttons: "Improve my pace", "Recovery tips", "Plan this week", "Warm-up routine"
- Conversation history persisted per user
- Powered by `ai-coach` Supabase edge function (Claude API)
- Markdown rendering in responses

### Subscription

#### `SubscriptionScreen` — Runivo+
- Free / Monthly / Annual plan cards
- Feature comparison list:
  - Free: 50 territories, basic missions, standard map
  - Runivo+: unlimited territories, advanced analytics, priority lobbies, no ads, custom map styles
- Live prices from RevenueCat (falls back to hardcoded if SDK not ready)
- Purchase via `purchaseProduct()` → RevenueCat → `rc-webhook` updates `profiles.subscription_tier`
- Restore purchases button

### Auth & Onboarding

#### `LandingScreen`
- Animated hex grid decoration
- Value proposition bullets
- Login / Sign Up CTAs

#### `LoginScreen` / `SignUpScreen`
- Email + password forms
- Password visibility toggle
- Field-level validation
- Supabase auth integration
- Error message display

#### `OnboardingScreen` — 6-step wizard
1. Confirm display name
2. Age, weight, height
3. Running experience level
4. Primary goal (territory domination / fitness / community)
5. Weekly run frequency
6. Training plan selection

### Utility

#### `HistoryScreen` — Run log
- Chronological run history
- Date, distance, pace, duration, territories claimed per run
- Tap row → RunSummary with stored data

#### `NotificationsScreen` — Notification centre
- Territory lost / captured alerts
- Level-up notifications
- Mission completion
- Club invites and events
- Mark as read
- Action buttons (navigate to relevant screen)

#### `SettingsScreen` — Preferences
- Distance unit: km / miles
- Dark mode toggle
- Notification toggles per category
- Haptics / sound
- GPS accuracy (battery save / balanced / high accuracy)
- Auto-pause threshold
- Mission difficulty preference
- Privacy settings
- Sign out

---

## Services (apps/mobile/src/services/)

### `locationTask.ts` — Background GPS task
- `TaskManager.defineTask('runivo-background-location', ...)` registered at module level
- Appends GPS points to SQLite while app is backgrounded
- Handles foreground/background location merge to avoid duplicate points
- Foreground service notification: "Runivo is tracking your run" (#D93518)

### `notificationHandler.ts` — Push notification routing
- `registerNotificationHandler(navRef)` — wires `addNotificationResponseReceivedListener`
- `handleLaunchNotification(navRef)` — handles killed-state notification taps via `getLastNotificationResponseAsync()`
- URL routing table:

  | `action_url` | Route |
  |---|---|
  | `/notifications` | Notifications |
  | `/missions` | Missions |
  | `/leaderboard` | Leaderboard |
  | `/profile` | Main (Profile tab) |
  | `/feed` | Main (Feed tab) |
  | `/events` | Events |
  | `/clubs` | Club |
  | `/lobby` | Lobby |
  | `/history` | History |
  | `/run/summary/:id` | History |

### `purchaseService.ts` — RevenueCat IAP
- `configureRevenueCat(userId)` — platform API key from `EXPO_PUBLIC_RC_API_KEY_IOS/ANDROID`
- `getAvailablePackages()` — fetches live offerings from RevenueCat
- `purchaseProduct(productId)` — triggers native purchase sheet, checks entitlements
- `restorePurchases()` — restores previous purchases
- Products: `runivo_plus_monthly`, `runivo_plus_annual`

### `healthService.ts` — Native health sync
- `writeRunToHealth(run)` — writes completed run to:
  - iOS: Apple Health (`react-native-health`) — `HKWorkoutActivityTypeRunning` with distance + calories
  - Android: Health Connect (`react-native-health-connect`) — `ExerciseSession` + `Distance` records
- `readRecentWorkouts(days)` — reads past workouts for onboarding baseline
- Both SDKs dynamically imported; silently no-ops if package not installed

---

## Shared Business Logic (packages/shared/src/)

### Services

| Service | What it does |
|---------|-------------|
| `store.ts` (web) | IndexedDB via `idb` — tables: player, runs, territories, nutritionLogs, nutritionProfile, shoes, settings, savedRoutes, pendingActions |
| `store.native.ts` | expo-sqlite equivalent with same API surface — used by Metro on iOS/Android |
| `supabase.ts` | Supabase client with SecureStore auth adapter on native, localStorage on web |
| `sync.ts` | Bidirectional sync: push unsynced runs → pull profile → pull territories → push nutrition → pull missions |
| `auth.ts` | `signUp`, `signIn`, `signOut`, `resetPassword`, OAuth (Google, Apple) |
| `claimEngine.ts` | Territory state machine — dwell time tracking, claim progress events, energy cost |
| `missionStore.ts` | Ensure today's 3–5 missions exist in DB; `claimMissionReward(missionId)` |
| `missions.ts` | 15+ mission templates across difficulty levels with XP/coin rewards |
| `config.ts` | Game constants: claim duration, XP per territory, corridor buffer, GPS sample rate, MS_PER_DAY, etc. |
| `passiveIncome.ts` | Accrues XP/coins every hour for each fortified territory |
| `personalRecords.ts` | Computes PRs from run history |
| `diamonds.ts` | In-game premium currency earn/spend |
| `profile.ts` | Player profile model, biometrics, training preferences |
| `pushNotificationService.ts` | Web: VAPID subscription lifecycle, `push_subscriptions` table |
| `pushNotificationService.native.ts` | Native: Expo push token, `expo_push_tokens` table, foreground notification handler |
| `storiesService.ts` | Story feed fetch and post |
| `avatarUtils.ts` | `avatarColor(name)` — deterministic colour from username hash (10-colour palette) |
| `haptics.ts` (web) | Vibration API wrapper |
| `haptics.native.ts` | `expo-haptics` wrapper: `light` → Impact.Light, `success` → Notification.Success, `warning` → Notification.Warning |

### Hooks

| Hook | What it does |
|------|-------------|
| `useAuth` | Subscribes to `supabase.auth.onAuthStateChange`; exposes `user`, `session`, `loading` |
| `useGameEngine` | Orchestrates game state: loads player + territories from SQLite, runs `claimEngine`, tracks session stats (distance, pace, XP delta), computes awards |

---

## Database (Supabase — 46 migrations)

### Core tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profile, level, XP, coins, subscription_tier, biometrics, streak |
| `runs` | Completed runs with GPS route, distance, duration, pace, territories_claimed |
| `territories` | Claimed hex polygons with owner_id, defense_level, last_claimed_at |
| `pending_actions` | Offline claim/fortify queue, replayed on reconnect |
| `missions` | Active daily missions per user |
| `mission_templates` | 15+ reusable mission definitions |
| `clubs` | Club metadata, badge_emoji, owner, member_count |
| `club_members` | Club membership junction |
| `club_messages` | Real-time club chat (Realtime enabled) |
| `events` | Community events, races, challenges |
| `event_participants` | Event RSVP junction |
| `feed_posts` | Social feed entries linked to runs |
| `followers` | User follow graph |
| `notifications` | Notification inbox per user |
| `push_subscriptions` | Web VAPID push endpoints |
| `expo_push_tokens` | Native Expo push tokens (iOS + Android) |
| `nutrition_logs` | Daily food entries |
| `nutrition_profiles` | Per-user calorie goal and dietary preferences |
| `shoes` | Gear log — shoe models, mileage, photos |
| `saved_routes` | User-saved GPS routes |
| `coach_messages` | AI coach conversation history |
| `ai_usage_log` | Claude API usage tracking per user |
| `stories` | Story posts linked to runs |
| `device_connections` | Linked wearables and external devices |

### Key RPCs / Edge Functions

| Function | Purpose |
|----------|---------|
| `secure_claim_territory` | Validates GPS proof server-side before claiming |
| `fortify_territory` | Increases defense level, costs energy |
| `energy_regen` | Regenerates player energy over time |
| `mission_completion` | Marks mission done, credits XP/coins atomically |
| `get_feed` | Paginated social feed with follow filter |
| `find_routes_nearby` | Geo-query: saved routes within N metres |
| `ai-coach` edge function | Claude API streaming chat endpoint |
| `send-push-notification` | Fan-out to VAPID + Expo push in parallel, cleans stale tokens |
| `rc-webhook` | RevenueCat → updates `profiles.subscription_tier` |
| `stripe-webhook` | Legacy Stripe subscription events |
| `device-webhook` | Inbound data from connected devices (watches, chest straps) |
| `foot-scan` | Foot strike analysis via Claude Vision |

---

## Push Notifications

Two parallel delivery paths:

**Web (VAPID):**
- Service worker subscription → `push_subscriptions` table
- `send-push-notification` uses `web-push` library

**Native (Expo Push):**
- `pushNotificationService.native.ts` → `Notifications.getExpoPushTokenAsync()`
- Token stored in `expo_push_tokens` table
- `send-push-notification` POSTs to `https://exp.host/--/api/v2/push/send`
- Stale `DeviceNotRegistered` tokens deleted automatically

Notification categories sent:
- Territory lost / captured
- Level up
- Mission completed
- Club invite
- Event reminder
- Weekly leaderboard update

---

## In-App Purchases

RevenueCat manages the purchase lifecycle for both platforms:

| Product | ID | Price |
|---------|-----|-------|
| Runivo+ Monthly | `runivo_plus_monthly` | ~$4.99/mo |
| Runivo+ Annual | `runivo_plus_annual` | ~$39.99/yr |

Flow:
1. `purchaseProduct()` → native purchase sheet (App Store / Play Store)
2. RevenueCat validates receipt
3. RevenueCat fires `rc-webhook` → Supabase edge function
4. Edge function updates `profiles.subscription_tier = 'runner-plus'`
5. App re-checks entitlements on next load

Subscription tiers:
- `free` — 50 territory limit, standard features
- `runner-plus` — unlimited territories, advanced analytics, no ads

---

## Health Integration

### iOS (Apple Health)
- Permission: `HKWorkoutActivityTypeRunning`, `HKQuantityTypeIdentifierDistanceWalkingRunning`, `HKQuantityTypeIdentifierActiveEnergyBurned`
- Writes: `saveWorkout` after each run with start/end time, distance, calories
- Reads: past workout count for onboarding baseline
- Requires HealthKit entitlement in `app.config.ts`

### Android (Health Connect)
- Writes: `ExerciseSession` record (type 79 = RUNNING) + `Distance` record
- Available on Android 9+ via Health Connect APK, built-in on Android 14+

---

## Offline Support

Runs and territory claims are fully offline-capable:

1. GPS points buffered to SQLite during run
2. Territory claims queued in `pending_actions` table
3. On reconnect: `sync.ts` calls `pushUnsyncedRuns()` then `pushPendingActions()`
4. Supabase RPC `secure_claim_territory` validates GPS proof server-side
5. Territories pulled from Supabase after successful sync

---

## Build & Deployment

### EAS Build profiles

| Profile | Distribution | OTA Channel | iOS target |
|---------|-------------|-------------|-----------|
| `development` | Internal | `development` | Simulator |
| `preview` | Internal | `preview` | Physical device |
| `production` | Store | `production` | App Store |

### Build commands
```bash
# Development (simulator)
eas build --platform ios --profile development

# TestFlight / internal Android
eas build --platform ios --profile preview
eas build --platform android --profile preview

# App Store / Play Store
eas build --platform ios --profile production
eas build --platform android --profile production

# Submit
eas submit --platform ios --latest
eas submit --platform android --latest

# OTA patch (no store review needed for JS-only changes)
eas update --branch production --message "fix: territory map flicker"
```

### App identifiers
- iOS bundle ID: `com.runivo.app`
- Android package: `com.runivo.app`

### iOS permissions declared
- Location when in use + always (background run tracking)
- Camera (shoe photos, foot scan)
- Photo library (shoe photos)
- HealthKit read + write

### Android permissions declared
- `ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`
- `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`
- `CAMERA`, `READ_MEDIA_IMAGES`
- `POST_NOTIFICATIONS`, `VIBRATE`

---

## App Store Metadata

| Field | Value |
|-------|-------|
| Name | Runivo |
| Subtitle | Run. Claim Territory. Dominate. |
| Category | Health & Fitness |
| Secondary | Sports |
| Age rating | 4+ |
| Bundle ID | com.runivo.app |
| Deep link scheme | `runivo://` |

Store listing files: `apps/mobile/store-metadata/ios/` and `store-metadata/android/`

Full submission steps: see `apps/mobile/SUBMISSION_CHECKLIST.md`
