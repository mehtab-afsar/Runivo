# Runivo Mobile App — Comprehensive Screen Audit

> Generated: 2026-03-29
> Platform: React Native (Expo) · Navigation: React Navigation (Bottom Tabs + Native Stack)
> Fonts: PlayfairDisplay (italic titles) · Barlow (UI text, 300/400/500/600)
> Colors: Red `#D93518` · Black `#0A0A0A` · Bg `#F8F6F3` · Stone `#F0EDE8` · Border `#DDD9D4` · Gray `#ADADAD`

---

## Table of Contents

1. [Auth & Onboarding](#1-auth--onboarding)
2. [Bottom Navigation](#2-bottom-navigation)
3. [Dashboard](#3-dashboard)
4. [Missions](#4-missions)
5. [Calorie Tracker](#5-calorie-tracker)
6. [Territory Map](#6-territory-map)
7. [Notifications](#7-notifications)
8. [Leaderboard](#8-leaderboard)
9. [Events](#9-events)
10. [Clubs & Community Chat](#10-clubs--community-chat)
11. [Feed](#11-feed)
12. [Record (Run Flow)](#12-record-run-flow)
13. [AI Coach](#13-ai-coach)
14. [Profile](#14-profile)
15. [Gear / Shoe Tracker](#15-gear--shoe-tracker)
16. [History](#16-history)
17. [Settings](#17-settings)
18. [Subscription](#18-subscription)
19. [Design System Summary](#19-design-system-summary)

---

## 1. Auth & Onboarding

### 1.1 Landing Screen
**File:** `apps/mobile/src/features/auth/screens/LandingScreen.tsx`
**Background:** `#F8F6F3`

**Navigation Bar:**
- Left: HexMark logo (28px black) + "run**ivo**" wordmark (PlayfairDisplay italic, 17px — "ivo" in red `#D93518`)
- Right: "Sign in" pressable → `Login`

**Animated Accents:**
- HexMark top-right: 64px, red 22% opacity, floats −18px over 3s (loop)
- HexMark bottom-left: 44px, red 18% opacity, floats −10px over 4.25s (loop)

**Content Stack:**
1. `LandingHero` component
2. `LandingFeatures` component
3. `LandingActions` component
   - "Sign up" → `SignUp`
   - "Sign in" → `Login`

---

### 1.2 Login Screen
**File:** `apps/mobile/src/features/auth/screens/LoginScreen.tsx`

- `KeyboardAvoidingView` (iOS: padding / Android: height)
- `LoginForm` component (managed by `useLogin()`)
- Back → `goBack()`
- "No account?" → `SignUp`

---

### 1.3 Sign Up Screen
**File:** `apps/mobile/src/features/auth/screens/SignUpScreen.tsx`

- `KeyboardAvoidingView`
- `SignUpForm` component (managed by `useSignUp()`)
- Back → `goBack()`
- "Already have account?" → `Login`

---

### 1.4 Onboarding Screen (6-Step Wizard)
**File:** `apps/mobile/src/features/auth/screens/OnboardingScreen.tsx`

Horizontal slide transition (240ms, `useNativeDriver`). Steps 1–5 show progress bar + back button; step 6 hides progress.

| Step | Component | Field(s) |
|------|-----------|----------|
| 1 | `UsernameStep` | Username, Experience level |
| 2 | `AvatarStep` | Avatar selection (color/style) |
| 3 | `GoalStep` | `primaryGoal` (get_fit / lose_weight / run_faster / explore / compete) |
| 4 | `TargetStep` | Days of week toggle, `distKm`, weekly target display |
| 5 | `NotificationsStep` | Push notification opt-in |
| 6 | `ReadyStep` | Summary: weeklyKmDisplay, goal, difficulty, error state |

**Footer CTA Button:**
- Steps 1–5: Red `#D93518`, label **"Continue"**
- Step 6: Black `#0A0A0A`, label **"Start running →"** (or **"Setting up…"** with spinner)
- Disabled state: mid-gray `#E8E4DF` when `canContinue()` is false

**On complete:** Resets nav stack → `Main`

---

## 2. Bottom Navigation

**File:** `apps/mobile/src/navigation/AppNavigator.tsx`

| Position | Tab Name | Icon (lucide) | Label | Screen |
|----------|----------|---------------|-------|--------|
| 1 | Dashboard | `Home` | Home | `DashboardScreen` |
| 2 | Feed | `Rss` | Feed | `FeedScreen` |
| 3 | Run | `Play` | Run | `RunScreen` |
| 4 | Coach | `Sparkles` | Coach | `CoachScreen` |
| 5 | Profile | `User` | Profile | `ProfileScreen` |

**Tab bar styling:**
- Background: `#F5F3EF`
- No top border
- Active tint: `#D93518` (red)
- Inactive tint: `#ADADAD`
- Font: Barlow_400Regular, 10px
- iOS height: 80px · Android height: 60px

---

## 3. Dashboard

**File:** `apps/mobile/src/features/dashboard/screens/DashboardScreen.tsx`
**Hook:** `useDashboard()`
**Background:** `#F8F6F3`

---

### 3.1 Header
- **Greeting** (time-based, uppercase, Barlow 400, 10px, `#ADADAD`):
  - < 5 am → "GOOD NIGHT"
  - 5–11 am → "GOOD MORNING"
  - 12–4 pm → "GOOD AFTERNOON"
  - 5–8 pm → "GOOD EVENING"
  - ≥ 9 pm → "GOOD NIGHT"
- **Username** — PlayfairDisplay italic, 26px, `#0A0A0A`
- **Right side:**
  - Bell button 🔔 (34×34 white circle, 0.5px border) → `Notifications`
  - `XPRing` component showing user initials + XP progress ring

---

### 3.2 Dashboard Pills (`DashboardPills`)
Horizontal pill row with wrap. Each pill: white bg, 0.5px border, 34px tall, 20px border-radius.

| Pill | Always shown | Condition |
|------|-------------|-----------|
| `{xp.toLocaleString()} XP · {levelTitle}` | ✓ | Always |
| ⚡ `{energy}/10 energy` | — | Only when energy < 5 |
| 🔥 `{streakDays} day streak` | — | Only when streakDays > 0 |

Level titles (1–10): Scout → Pathfinder → Trailblazer → Ranger → Explorer → Captain → Vanguard → Commander → Warlord → Legend

---

### 3.3 Hero Carousel (Horizontal Paging)
Two swipeable cards, dot indicators below.

**Card 1 — Weekly Goal:**
- Label: `"WEEKLY GOAL"` (10px, letter-spacing 1, gray)
- Value: `{weeklyKm.toFixed(1)} / {weeklyGoal} km`
- Progress bar (red, height 4px)
- Sub: `"✓ Goal reached!"` or `"{remaining} km remaining"`

**Card 2 — Today's Calories:** (Pressable → `CalorieTracker`)
- Label: `"TODAY'S CALORIES"`
- Value: `{caloriesConsumed.toLocaleString()} / {calorieGoal} kcal`
- Color logic: > 105% → orange `#C25A00`; ≥ 90% → red `#D93518`; < 90% → green `#1A6B40`
- Progress bar (dynamic color)
- Sub: `"Tap to log food →"`

---

### 3.4 Bento Card (`BentoCard`)
Two-column grid layout, margin 16px horizontal.

**Left column — WeeklyRing (black card, 224px tall):**
- `WeeklyRing` component with weekly km + goal ring + run-day dots

**Right column — Quick Actions (3 stacked buttons):**

| Icon | Label | Navigates to |
|------|-------|-------------|
| `Calendar` | Events | `Events` |
| `Users` | Clubs | `Club` |
| `Award` | Leaderboard | `Leaderboard` |

Each button: `#F0EDE8` bg, 14px radius, 32×32 white icon box with red icon.

**Start Run Button (full width, black):**
- Left: Red circle (40px) with Play icon + "TAP TO BEGIN" label + "Start run" text
- Right: Energy badge "1 energy" (Zap icon, semi-transparent white)
- → navigates to `Run`, Medium haptic

---

### 3.5 Empire Section
- Section title: `"EMPIRE"` | Action link: `"View map →"` → `TerritoryMap`
- **TerritoryStats** component — 2×2 white card grid:

| Cell | Value | Label |
|------|-------|-------|
| Top-left | `{ownedCount}` | ZONES OWNED |
| Top-right | `{avgDefense}%` | AVG DEFENSE |
| Bottom-left | `+{dailyIncome}` | DAILY INCOME |
| Bottom-right | `{weakZones}` (red if > 0) | WEAK ZONES |

---

### 3.6 Missions Section
- Section title: `"MISSIONS"` | Action link: `"Change →"` → `Missions`
- Black card `#0A0A0A`, padding 18px, radius 20px
- Label inside: `"TODAY'S CHALLENGE"` (10px, rgba white 35%, letter-spacing 1.2)
- Renders `MissionRow` for each mission:
  - Icon box 32×32 (rgba white 8%; green 30% if completed)
  - Icons: run_distance→Target, capture_zones/run_in_enemy_zone→MapPin, complete_run→Check, beat_pace→Zap
  - Mission title (white, strikethrough + dim if completed)
  - Progress bar (red → green when done)
  - XP reward: `"+{xp} XP"` right-aligned

---

### 3.7 Recent Runs Section
- Section title: `"RECENT RUNS"` | Action link: `"See all →"` → `History`
- White card with `RecentRunRow` per run:
  - Left: activity type (uppercase gray) + relative date (Today / Yesterday / Mon DD)
  - Right: distance (km) + duration (time)
  - Press → `RunSummary` with `runId`
- Empty state: `"No runs yet"` + `"Start running →"` → `Run`

---

## 4. Missions

**File:** `apps/mobile/src/features/missions/screens/MissionsScreen.tsx`
**Background:** `#EDEAE5`

---

### Header
- Back button (← circular)
- Title: `"Missions"` (PlayfairDisplay italic)
- Date label: `"Mon · Mar 17"` format

---

### Category Tabs (Horizontal Scroll)
`For You` · `Weight Loss` · `Endurance` · `Speed` · `Territory` · `Explorer` · `All`

Active tab: red underline + bold. Inactive: gray.

---

### Daily Blueprint Card (Black `#0A0A0A`)
- Eyebrow: `"DAILY BLUEPRINT"` (10px uppercase light gray)
- Title: `"Today's optimal mission set"`
- Kicker: `"Curated for your {goal} goal"` (dynamic)
- Shows 3 recommended missions (emoji + title + XP + difficulty pill)
- Button: **`"✓ Apply Blueprint"`** — auto-selects 3 goal-aligned missions

Generated by `generateBlueprint(primaryGoal, missionDifficulty)` from `@shared/services/missions`.

---

### All Missions List (FlatList)
Divider label: `"All missions"` + `"X / 3 selected"` counter

**Each mission card:**
| Element | Detail |
|---------|--------|
| Emoji icon box | Background surface/stone |
| Title | Barlow 500 Medium, 14px |
| Difficulty badge | Easy: green · Medium: amber · Hard: red |
| Category badge | Goal category label |
| Description | Barlow 300 Light, 12px gray |
| Rewards | `"+{xp} XP  ·  +{coins} coins"` |
| Selection indicator | Checkmark circle when selected |

**States:** selected (surface bg), disabled at 0.4 opacity (when 3 already chosen), normal (white bg).
Max 3 missions selectable at once.

---

### Sticky Save Bar (appears when ≥ 1 selected)
- 3 slot circles showing selected mission emojis
- Button: **`"Set {n} mission(s) for today"`** or `"Saving…"` while loading
- On save: persists to `missionStore.setDailyMissions()`, navigates back

---

## 5. Calorie Tracker

**File:** `apps/mobile/src/features/nutrition/screens/CalorieTrackerScreen.tsx`
**Hook:** `useCalorieTracker()`, `useNutritionContext()`, `useNutritionInsights()`

---

### Header
- Back button
- Title: `"Calorie Tracker"` (PlayfairDisplay italic)
- Settings ⚙ → `NutritionSetup`

### Tabs
`Today` · `Insights`

---

### TODAY Tab

**Run Burn Chip** (shown if `runBurnKcal > 0`):
- Zap icon + `"Run activity · +{kcal} kcal burned today"`
- Orange tint background

**CalorieRing:**
- Circular ring showing consumed vs. goal
- Shows: consumed kcal, remaining kcal, % filled

**MacroBars:**
- Protein: `{g}/{goalG} g` + progress bar
- Carbs: `{g}/{goalG} g` + progress bar
- Fat: `{g}/{goalG} g` + progress bar

**Meal Sections** (Breakfast / Lunch / Dinner / Snacks):
- Expandable/collapsible
- Listed food entries with delete button per item
- `"+ Add"` button per meal type

**Log Food Button:** `"+ Log Food"` → opens `AddFoodModal`

---

### Add Food Modal

Presented as slide-up pageSheet.

**Meal type selector** (4 buttons): 🌅 Breakfast · 🥗 Lunch · 🍽️ Dinner · 🍿 Snacks
Active: black bg / Inactive: white bg

| Field | Required | Placeholder |
|-------|----------|-------------|
| Food name | ✓ | `"e.g. Chicken breast"` |
| Calories | ✓ | `"300"` (decimal-pad) |
| Protein (g) | — | `"25"` |
| Carbs (g) | — | `"30"` |
| Fat (g) | — | `"10"` |

**Add button:** Disabled (0.4 opacity) until name + kcal filled.
On submit: creates entry with `meal, name, kcal, macros, source: "manual"`.

---

### INSIGHTS Tab

**Weekly Chart (`WeeklyChart`):**
- 7 bars (Mo–Su), fixed height 80px
- Bar colors: green (under goal), orange (over goal), red (today)
- Goal line reference
- Average: `"avg {weekAvg} kcal"`
- Legend row

**Today's Macros Card:** Protein / Carbs / Fat rows with progress bars

**Weekly Stats Card:**
- `avg kcal/day` · `days logged` · `vs goal` (+/- diff, orange if over, green if under)

**AI Insights Section:**
- Label: `"AI INSIGHTS"`
- Insight cards with icon + title + body
- Loading: `ActivityIndicator`

**Coach CTA:** `"✨ Ask Coach for deeper insights →"` → `Coach`

---

## 6. Territory Map

**File:** `apps/mobile/src/features/territory/screens/TerritoryMapScreen.tsx`
**Hook:** `useTerritoryMap()`

---

### Map Layer
- `MapLibreGL` with CartoDB Positron basemap
- H3-indexed territory hexagons with `fillColor` by ownership
- User location dot

### Absolute-Positioned Overlays

**Header (top):**
- Title: `"Territory"`
- `TerritoryStatsBar`: ownedCount · enemyCount · freeCount

**Filter Chips Row:**
`All` · `Mine` · `Enemy` · `Weak`
Shows count badge per chip.

**Recenter Button:**
- ⊕ icon — flies camera to user location on press + haptic

**Territory Bottom Sheet** (on hex tap):
- Territory ID, owner name, defense %, tier
- **`"Fortify"`** button → `ActiveRun` (starts a fortify run)
- **Close** → clears selection

### Loading
`ActivityIndicator` red `#E8391C` while data fetches.

---

## 7. Notifications

**File:** `apps/mobile/src/features/notifications/screens/NotificationsScreen.tsx`
**Hook:** `useNotifications()`

---

### Header
- Back button
- Title: `"Notifications"` (+ `"(3)"` badge if unread > 0)
- `"Mark all read"` button (if unread > 0)

### List
`FlatList` of `NotifItem` components (pressable to mark read).
Pull-to-refresh (red tint).

### Empty State
- Title: `"You're all caught up"`
- Body: `"No notifications yet. Start running to get activity here."`

---

## 8. Leaderboard

**File:** `apps/mobile/src/features/leaderboard/screens/LeaderboardScreen.tsx`
**Hook:** `useLeaderboard()`

---

### Header
Back button · Title: `"Leaderboard"` (PlayfairDisplay italic, 20px)

### Filters (`LeaderboardFilters`)
- **Tab:** Distance · XP · Power (etc.)
- **Time Frame:** Day · Week · Month
- **Scope:** Friends · Local · Global

### Podium (Top 3)
3-column layout: 2nd · 1st · 3rd

| Position | Pedestal height | Avatar size | Medal |
|----------|----------------|-------------|-------|
| 1st | 70px | 44px | 🥇 gold |
| 2nd | 50px | 36px | 🥈 silver |
| 3rd | 36px | 30px | 🥉 bronze |

Each: medal emoji, avatar (initial), name, formatted value, rank block `#1/#2/#3`.

### List (Rank 4+)
`EntryRow` per entry: rank · avatar · name · value + unit.

**Units:** km → `"X.0 km"` · XP → `"X,XXX XP"` · Power → `"X ⚡"`

### Empty State
`"No data yet"` · `"Complete runs to appear on the leaderboard."`

---

## 9. Events

**File:** `apps/mobile/src/features/events/screens/EventsScreen.tsx`
**Hook:** `useEvents()`

---

### Header
- Back button
- Title: `"Events"` (PlayfairDisplay italic, 20px)
- `"+"` button (if `canCreate`) → `CreateEvent`

### Content
`FlatList` of `EventCard` components:
- Event details, join status
- `"Join"` / joined button state per event
- Pull-to-refresh (red tint)

### Empty State
`"No events yet"` · `"Check back soon for upcoming community events."`

---

## 10. Clubs & Community Chat

### 10.1 Club Discovery Screen
**File:** `apps/mobile/src/features/clubs/screens/ClubScreen.tsx`
**Hook:** `useClubs()`

- **Search bar** — placeholder: `"Search clubs..."`
- `FlatList` of `ClubCard` (join / leave callback)
- Pull-to-refresh
- Empty state: `"No clubs found"` · `"Try a different search or check back soon."`

---

### 10.2 Lobby (Community Rooms)
**File:** `apps/mobile/src/features/clubs/screens/LobbyScreen.tsx`
**Hook:** `useLobby()`

**5 predefined rooms:**

| Room | Emoji | Color | Description |
|------|-------|-------|-------------|
| Global Runners | 🌍 | `#1E4D8C` | Connect with runners worldwide |
| Training Talk | 🏃 | `#1A6B40` | Plans, tips, and workout advice |
| Race Reports | 🏆 | `#9E6800` | Share your race results and stories |
| Speed & Intervals | ⚡ | `#D93518` | Track work, tempo runs, PRs |
| Night Runners | 🌙 | `#6B2D8C` | For those who run after dark |

Each card: colored emoji box · room name · description · today's message count.
Tap → `LobbyChat` with `lobbyId`.

**Footer banner:**
💬 `"Be respectful"` (red bold) — `"Keep conversations positive. Toxic behaviour will result in a ban."`
Background: `#FEF0EE`

---

### 10.3 Lobby Chat
**File:** `apps/mobile/src/features/clubs/screens/LobbyChatScreen.tsx`
**Hook:** `useLobbyChat(lobbyId)`

**Header:** Room icon (colored square 36px) · room name · room description

**Messages (`FlatList`):**
- `ChatBubble` per message (username, text, timestamp, reactions)
- Auto-scrolls to bottom on new messages (100ms delay)
- `LongPress` → opens `ReactionModal`

**Reaction Picker Modal:**
- 6 emojis: ❤️ 🔥 💪 👏 🤣 😮
- Each button: 44×44px, `#F0EDE8` bg
- Tap → `reactToMessage(messageId, emoji, userId)`, closes modal

**Input (`ChatInput`):**
- Placeholder: `"Message..."` · Send button
- `KeyboardAvoidingView` (iOS: padding / Android: height)

**Empty state:** Room emoji (40px) · `"No messages yet"` · `"Be the first to start the conversation!"`

---

## 11. Feed

**File:** `apps/mobile/src/features/social/screens/FeedScreen.tsx`
**Hook:** `useFeed()`
**Background:** `#F7F6F4`

---

### Header
- Title: `"Feed"` (PlayfairDisplay italic, 22px)
- Bell 🔔 → `Notifications`

### Tabs
`Discover` · `Following`
Active: black underline + Barlow 500 Medium. Inactive: gray.

---

### Story Reel (`StoryReel`)
Horizontal scroll of story groups:
- 54×54 ring (colored border from username hash)
- 48×48 avatar with first-letter initial
- Username below (10px, truncated 1 line)
- Tap → `StoryViewer` with `{ groups, initialGroupIndex }`

---

### Suggested Runners (Discover tab only)
Appears as `ListHeaderComponent` when `suggestedRunners.length > 0`:
- Label: `"SUGGESTED RUNNERS"` (9px uppercase, gray)
- Horizontal scroll, max 10 runners
- Each runner card (min-width 72px):
  - 48×48 avatar circle (border thicker `2px black` if following)
  - Follow dot (bottom-right corner, 18px circle):
    - Not following: `"+"` on black bg
    - Following: `"✓"` on black bg
  - First name (11px)
  - Total distance km (10px gray)

---

### Feed Posts (`FlatList`)
Pull-to-refresh (red tint). Renders `FeedPostCard` per post.

**`FeedPostCard` sections:**

**A — Header:**
- 40×40 avatar (colored by username, first letter)
- Username (Barlow 500, 13px)
- Time ago: Xm · Xh · Xd
- Activity type chip (stone bg): run→TrendingUp, trail→MapPin, interval→Zap, long_run→Navigation

**B — Stats Row (3 columns with dividers):**
- DISTANCE: `"5.2 km"` · TIME: `"25m"` or `"1h 30m"` · PACE: `"5:20/km"` (or `"–"`)

**C — Badges Strip** (if territoriesClaimed > 0 or xpEarned > 0):
- `"⚡ X Zone(s)"` — red text, `#FEF0EE` bg
- `"✨ X XP"` — green `#1A6B40`, `#EDF7F2` bg

**D — Reactions Bar:**
- Left: kudos count · comment count (MessageSquare icon)
- Right: 3 reaction chips:
  - 👍 Kudos (ThumbsUp) — calls `onKudos()`; active: black bg/white icon
  - ⭐ Star — local toggle
  - ⚡ Zap — local toggle

---

### Post Detail Sheet (`PostDetailSheet`)
Modal (slide, transparent) opened on card press.

**Contents:**
- Avatar + username + formatted date (`"Tue, Mar 29"`)
- Stats row (stone bg): Distance · Time · Pace
- Badges: zones claimed + XP earned
- **`"REACT"` section:**
  - 4 buttons: ❤️ Kudos · 🔥 Fire · 👑 Crown · 💪 Strong
  - Kudos active state: `#FCE8EB` bg, red border
  - Kudos shows `kudosCount`

---

## 12. Record (Run Flow)

### 12.1 Run Setup Screen (Pre-Run)
**File:** `apps/mobile/src/features/run/screens/RunScreen.tsx`
**Hook:** `useRunSetup()`

**Components:**
- `RunMapView` (full-screen background map, CartoDB Positron)
- `RunSetupSheet` (draggable bottom sheet, 240px collapsed / 420px expanded)
- `ActivityModal` (activity type selector)
- `RouteModal` (saved / nearby routes)

**GPS Status Chip (color-coded):**
| Status | Color | Label |
|--------|-------|-------|
| Error | `#EF4444` | GPS Error |
| Searching | `#D1D5DB` | Locating… |
| Accuracy < 20m | `#22C55E` | GPS Strong |
| Accuracy 20–50m | `#F59E0B` | GPS OK |
| Accuracy > 50m | `#F87171` | GPS Weak |

**RunSetupSheet content:**
- Activity type chip (tap → `ActivityModal`)
- Selected route name (if any, tap → `RouteModal`)
- Territory intel summary: enemy count · neutral · weak zones
- Beat Pacer chip (`useBeatPacer`): enabled toggle + BPM display
- **`"Start Run"`** button (disabled until GPS ready)

**Beat Pacer BPM table** (pace → cadence):
3:30→185 · 4:00→180 · 4:30→176 · 5:00→172 · 5:30→167 · 6:00→163 · 6:30→159 · 7:00→155 BPM
Plays `click.wav` via expo-av at 25ms scheduler with 100ms lookahead.

---

### 12.2 Active Run Screen (Live Tracking)
**File:** `apps/mobile/src/features/run/screens/ActiveRunScreen.tsx`
**Hook:** `useActiveRun()`

**Layout:**
- `ActiveRunMapView` full-screen (GPS trace + color-coded segments)
- All other UI absolutely positioned

**Header:** Status title (`"Ready to Run"` / `"Running"` / `"Paused"`) + close ✕ button

**GPS Tag (bottom-left of map):** `"GPS Active · {n} pts"` — black semi-transparent pill

**Banners (conditional):**
- GPS error: red bg, error message
- Energy depleted: amber bg, warning icon + text

**RunHUD (floating metrics):**
- Distance (km) · Pace (/km) · Elapsed time · Energy level · Claim progress %

**BeatPacer Chip** (top-right, visible when running)

**Claim Progress Ring** — circular indicator, shows claim % (visible when claiming > 0%)

**Claim Progress Bar** (horizontal bar): `"X% CLAIMING"` (red fill, right-aligned label)

**Controls:**
- Not running: Large red play circle (72×72px)
- Running: Pause/Resume + Stop/Finish buttons

**Finish Flow:**
1. Short run (< 0.05km AND < 30s) → Alert: `"You haven't run far enough. End anyway?"` → Keep Running / End Run
2. Normal run → `FinishConfirmSheet` (shows distance, time, territories claimed) → Keep Running / Finish
3. On confirm → `finishRun()` → `postRunSync()` → navigate `RunSummary`

**GPS:** Foreground + background tracking (expo-location). Haversine distance with 100m outlier filter. Keep-awake active during run.

---

### 12.3 Run Summary Screen (Post-Run)
**File:** `apps/mobile/src/features/run/screens/RunSummaryScreen.tsx`
**Hook:** `useRunSummary(runId, passedData)`, `usePlayerStats()`, `usePostRunInsights()`

**Header:**
- Close ✕ (30×30 circle)
- Action type: `"TRAINING RUN"` / `"ATTACK RUN"` / `"DEFENCE RUN"` / `"FORTIFY RUN"`
- Heading (28px italic):
  - Success: `"Territory Conquered"` / `"Territory Defended"` / `"Territory Fortified"` / `"Run Complete"`
  - Failure: `"{Action} Failed"`
- Date: `"Tue, Mar 29"`

**Scrollable Content:**

**Route Map** — GPS route with color-coded segments

**Stats Grid (4 columns):**
- Distance (`"5.23 km"`) · Time (`"HH:MM:SS"`) · Avg Pace (`"5:20/km"`) · Claimed (count)

**Splits List** — 1km segment times (expandable)

**Rewards Card** (if successful):
- XP earned this run
- Current level
- XP progress bar (animated: pre-run % → post-run %)
- Level-up info (if leveledUp: `Level X → Y`)
- Completed missions list

**Post-Run AI Insights Card:**
- `praise` · `analysis` · `suggestion` · `recovery` (from Supabase edge function `ai-coach`)

**Shoe Chip** (if distance ≥ 0.5km):
- Selected shoe brand/model · total km on shoe
- Tap → `ShoeDrawer` if multiple shoes

**Fuel Card** (if distance ≥ 1km):
- 🔥 `"You burned ~{kcal} kcal"`
- `"Priority next 2hrs: 35–40g protein + 60–80g carbs"`
- **`"+ LOG"`** → `CalorieTracker` with `burnKcal` param

**Actions Row:**
- **Share** → system share sheet: `"🏃 Run Complete!\n📍 X.XX km ⏱ MM:SS 🏃 pace/km\n🏆 X zones · Y XP\nTracked on Runivo"`
- **Save Route** → `SaveRouteSheet` (requires ≥ 2 GPS points)
- **Done** → navigate `Main`

**Auto overlays on mount:**
- `LevelUpOverlay` if `leveledUp` (shows from/to levels)
- Story auto-upload after 1500ms (if successful + distance ≥ 0.5km)

---

## 13. AI Coach

**File:** `apps/mobile/src/features/coach/screens/CoachScreen.tsx`
**Hook:** `useCoachChat()`
**Background:** `#F8F6F3`

---

### Header
- Back button
- Center: `"AI Coach"` (title) + `"Powered by Claude"` (subtitle, 11px gray)
- Right: ✨ sparkle in purple square box

---

### Initial / Welcome State
- 🏃 icon in purple bg
- Title: `"Your AI Running Coach"`
- Text: `"Ask me anything about training, nutrition, form, recovery, or race strategy."`

**Quick Prompts (4 chips):**
1. `"How can I improve my pace?"`
2. `"Build me a 5K training plan"`
3. `"How should I warm up before a run?"`
4. `"Tips for running in the heat?"`

---

### Chat State
- `FlatList` of `MessageBubble` components (user / assistant roles)
- Typing indicator when `coach.sending` is true
- Auto-scrolls to end on new messages

---

### Training Plan Accordion
- Expandable (toggle via `coach.togglePlanOpen`)
- Goal text input
- `"Generate"` button with loading state
- Displays generated `coach.trainingPlan` when complete

---

### Input Bar (Bottom)
- `TextInput` placeholder: `"Ask your coach..."`
- Return key: `"send"`
- Send button (40×40 pill):
  - Disabled (gray): empty text or sending
  - Active: red `#D93518` bg, `"↑"` up-arrow

---

## 14. Profile

**File:** `apps/mobile/src/features/profile/screens/ProfileScreen.tsx`
**Hooks:** `useProfile()`, `usePlayerStats()`, `useWeeklyBrief()`
**Background:** `#F8F6F3`

---

### Profile Header
- Display name (or `"Runner"` fallback)
- Bio (editable)
- Avatar (colored circle with initial)
- Level (Barlow 500, with XP progress bar)
- 3 action icons: Edit Profile · 🔔 Notifications → `Notifications` · ⚙ Settings → `Settings`

**Stats row:**
- Total KM · Total runs · This week's KM · Territories claimed · Weekly goal

---

### Tabs (5)

#### Overview
- **Weekly Brief card** (if `brief` exists):
  - Sparkles icon (`#8B5CF6`)
  - Label: `"THIS WEEK"`
  - Headline: AI-generated insight (`brief.headline`)
  - Tip: Actionable advice (`brief.tip`)
- Recent runs list

#### Stats
- Personal records (best distance, best pace, etc.)
- Total runs · Total KM · Total territories claimed · Streak days

#### Awards
- `AwardsTab` component (achievement badges)

#### Nutrition
- `NutritionTab` component (nutrition summary/history)

#### Gear
- Shoes list with km per shoe
- `"Add Shoe"` button → `GearAdd`

---

### Edit Profile Sheet (Modal)
- Name input · Bio input · Color picker
- `"Save"` / `"Cancel"` buttons

---

## 15. Gear / Shoe Tracker

**File:** `apps/mobile/src/features/gear/screens/GearScreen.tsx`
**Hook:** `useShoeTracker()`
**Background:** `#EDEAE5`

---

### Header
- Back button
- Title: `"Gear"` (PlayfairDisplay italic, 20px)
- Right actions:
  - 🦶 FootScan (purple `#5A3A8A`) → `FootScan`
  - `+` Add (black) → `GearAdd`

---

### Shoes List (`FlatList`)
Sections: **Active shoes** (top) → **`"RETIRED"`** header → retired shoes (bottom)

**Each `ShoeCard`:**
- Brand + model name
- Nickname (optional)
- KM total for this shoe
- Actions: Set as default · Retire · Delete (with Alert confirmation)

**Retire toast:**
`"{brand} {model} · {km}km · Well run."` — black pill, bottom-absolute, 2600ms total (400ms fade-out).

---

### Empty State
`"No shoes yet"` · `"Add your running shoes to track mileage."` · `"Add first shoe"` → `GearAdd`

---

## 16. History

**File:** `apps/mobile/src/features/history/screens/HistoryScreen.tsx`
**Hook:** `useRunHistory()`
**Background:** `#F8F6F3`

---

### Header
Back button · Title: `"Run History"`

### Stats Summary (if runs exist)
Run count · Total KM · Avg KM/run

### Activity Filter Chips (Horizontal Scroll)
`All` · `Run` · `Walk` · `Hike` · `Trail` · `Cycle` · `Interval` · `Tempo` · `Race`

Active: black bg, white text, Barlow 600. Inactive: `#F0EDE8` bg, gray text.

### Run List (`FlatList`)
`RunItem` per run → press → `RunSummary` with `runId`

### Empty States
- Filter = all: `"No runs yet"` · `"Your run history will appear here."`
- Filter active: `"No {filter} activities"` · `"Try a different filter."`

---

## 17. Settings

**File:** `apps/mobile/src/features/settings/screens/SettingsScreen.tsx`
**Hook:** `useSettings()`
**Background:** `#F8F6F3`

---

### Header
Back button · Title: `"Settings"`

---

### Sections

#### Account
| Row | Control | Options / Action |
|-----|---------|-----------------|
| Edit Profile | Link → `Profile` | — |
| Profile Visibility | SegmentedControl | Public · Friends · Private |

#### Appearance
| Row | Control | Options |
|-----|---------|---------|
| Distance unit | SegmentedControl | km · mi |
| Dark Mode | Switch | on/off |

#### Notifications
| Row | Control | Sub-text |
|-----|---------|----------|
| Push notifications | Switch | "Territory captures, kudos, challenges" |
| Announce Achievements | Switch | — |
| Weekly summary | Switch | — |

#### Sound & Haptics
| Row | Control |
|-----|---------|
| Sound effects | Switch |
| Haptic feedback | Switch |

#### Run Settings
| Row | Control | Sub-text |
|-----|---------|----------|
| Auto-pause | Switch | "Pause tracking when you stop moving" |
| GPS accuracy | SegmentedControl (Standard · High) | "High accuracy uses more battery" |
| Countdown | PillCycle (`cycleCountdown()`) | — |

#### Missions
| Row | Control | Sub-text |
|-----|---------|----------|
| Daily missions | Switch | "Generate new missions each day" |
| Mission difficulty | PillCycle (`cycleDifficulty()`) | Easy / Medium / Hard |

#### Devices
| Row | Action |
|-----|--------|
| Connected Devices | → `ConnectedDevices` |
| — | Sub: "Apple Health, Garmin, COROS…" |

#### Data & Privacy
| Row | Action |
|-----|--------|
| Export Run Data | Alert: "Export feature coming soon." |
| Clear Run History | `clearHistory()` with Alert confirmation |
| — | Sub: "Removes local data only" |

#### Support
| Row | Action |
|-----|--------|
| Help & FAQ | External link: `https://runivo.app/help` |
| About Runivo | Shows `v1.0.0` |

---

### Upgrade to Pro Card
Gradient background: `#E8435A → #D03A4F`
⚡ icon · `"Upgrade to Pro"` (bold white) · `"Unlock unlimited zones & features"` → `Subscription`

---

### Sign Out
`"Sign out"` button (red text, border) → calls `signOut()`

### Footer
`"Runivo v1.0.0"` (small gray)

---

## 18. Subscription

**File:** `apps/mobile/src/features/subscription/screens/SubscriptionScreen.tsx`
**Hook:** `useSubscription()`
**Background:** `#EDEAE5`

---

### Header
Back button · Title: `"Upgrade"`

### Hero
🏴 · `"Runivo Plus"` (PlayfairDisplay italic, 28px) · `"Dominate more territory. Run smarter."`

### Plan Cards (if not premium)
Two `PlanCard` components: Monthly · Annual
Prices from RevenueCat (`rcPrices[rcProductId]`) or fallback defaults.

### Subscribe CTA
Button: **`"START FREE TRIAL"`**
Sub: `"7 days free, then {trialPrice}"`
`ActivityIndicator` while purchasing.

### Restore Button
`"Restore purchases"`

### Features (`"WHAT YOU GET"`)
`FeatureRow` per feature with checkmark.

### Free Plan Limits (`"FREE PLAN LIMITS"`)
`FeatureRow` per limitation with ✗.

### Legal
`"Cancel anytime. Subscription auto-renews unless cancelled at least 24 hours before the end of the trial or billing period."`

---

## 19. Design System Summary

### Color Tokens
| Name | Hex | Usage |
|------|-----|-------|
| Red | `#D93518` | Primary actions, active states, progress bars |
| Black | `#0A0A0A` | Primary text, dark cards |
| Background | `#F8F6F3` | Main screen background |
| Background alt | `#EDEAE5` | Some screen backgrounds |
| Stone | `#F0EDE8` | Subtle card backgrounds, chips |
| Mid | `#E8E4DF` | Disabled states, track backgrounds |
| Border | `#DDD9D4` | Card borders, separators |
| Gray 2 | `#6B6B6B` | Secondary text |
| Gray 3 | `#ADADAD` | Tertiary text, labels |
| White | `#FFFFFF` | Cards, surfaces |
| Green | `#1A6B40` | Success, under-goal |
| Amber | `#9E6800` | Warning |
| Orange | `#C25A00` | Over-goal |
| Purple | `#5A3A8A` | AI Coach accents |

### Typography
| Role | Font | Size | Weight |
|------|------|------|--------|
| Screen titles | PlayfairDisplay_400Regular_Italic | 20–28px | — |
| Section labels | Barlow_500Medium | 10–11px | Uppercase + letter-spacing |
| Body / UI | Barlow_400Regular | 11–14px | — |
| Stats / Values | Barlow_300Light | 16–28px | Light, letter-spacing −0.3 to −0.6 |
| Bold emphasis | Barlow_600SemiBold | 12–16px | — |

### Navigation Structure
```
AppNavigator (Stack)
├── Landing / Login / SignUp / Onboarding
└── Main (Bottom Tabs)
    ├── Dashboard ─────────────┐
    ├── Feed                   │ All accessible as
    ├── Run (RunScreen)        │ Stack screens from
    ├── Coach                  │ anywhere:
    └── Profile                │
                               ├── ActiveRun
                               ├── RunSummary
                               ├── Missions
                               ├── CalorieTracker
                               ├── NutritionSetup
                               ├── TerritoryMap
                               ├── History
                               ├── Events / CreateEvent
                               ├── Club / Lobby / LobbyChat
                               ├── Leaderboard
                               ├── Notifications
                               ├── Settings / ConnectedDevices
                               ├── Gear / GearAdd / FootScan
                               ├── Subscription
                               └── StoryViewer
```

### Interaction Patterns
- **Haptics:** Light on nav taps; Medium on start run; Success/Warning on run finish
- **Pull-to-refresh:** All list screens (red `#D93518` tint)
- **Empty states:** Every list screen has a styled empty state with CTA
- **Bottom sheets:** Detail sheets, confirmation sheets, modals all slide up
- **Animated toasts:** Gear retire confirmations (opacity fade, 2600ms)
- **Loading:** `ActivityIndicator` red on data fetch; skeleton-free
