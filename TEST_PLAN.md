# Runivo — Manual QA Test Plan

> **How to use this document**
> Work through each section top-to-bottom. Every test step describes exactly what to tap/type and what to look for. After each step, note Pass ✅ / Fail ❌ / Blocked 🚫 beside it. For any DB verification steps, open the [Supabase Dashboard → Table Editor](https://app.supabase.com) and check the relevant table.

---

## Table of Contents

1. [Onboarding & Auth](#1-onboarding--auth)
2. [Dashboard](#2-dashboard)
3. [Run — Setup & Pre-Run](#3-run--setup--pre-run)
4. [Run — Active Run](#4-run--active-run)
5. [Run — Post-Run Summary](#5-run--post-run-summary)
6. [Social Feed](#6-social-feed)
7. [Stories](#7-stories)
8. [Clubs — Browse & Join](#8-clubs--browse--join)
9. [Clubs — Club Detail & Members](#9-clubs--club-detail--members)
10. [Clubs — Create a Club](#10-clubs--create-a-club)
11. [Clubs — Lobby Chat](#11-clubs--lobby-chat)
12. [Events](#12-events)
13. [Territory Map](#13-territory-map)
14. [Leaderboard](#14-leaderboard)
15. [Missions](#15-missions)
16. [Coach (AI)](#16-coach-ai)
17. [Profile — Own Profile](#17-profile--own-profile)
18. [Profile — Other User Profile](#18-profile--other-user-profile)
19. [History](#19-history)
20. [Gear / Shoes](#20-gear--shoes)
21. [Nutrition Setup](#21-nutrition-setup)
22. [Calorie Tracker](#22-calorie-tracker)
23. [Notifications](#23-notifications)
24. [Settings](#24-settings)
25. [Connected Devices](#25-connected-devices)
26. [Subscription Screen](#26-subscription-screen)
27. [Realtime & Sync Checks](#27-realtime--sync-checks)
28. [Edge Cases & Error States](#28-edge-cases--error-states)

---

## 1. Onboarding & Auth

### 1.1 Landing Screen
- [ ] App opens to the landing screen (not a blank screen or crash)
- [ ] Runivo logo and tagline are visible — no `[?]` glyphs or broken icons
- [ ] "Get Started" / "Sign In" buttons are tappable and visible

### 1.2 Sign Up
- [ ] Tap **Get Started** → Sign Up screen opens
- [ ] Enter a valid email and password (≥8 chars) and tap **Create Account**
- [ ] App navigates to the Onboarding screen (not the feed yet)
- [ ] **DB check** → `profiles` table has a new row with your email's user UUID
- [ ] Profile row has default values: `subscription_tier = 'free'`, `level = 1`, `xp = 0`

### 1.3 Onboarding Flow
- [ ] Onboarding shows multiple steps (name, goal, experience level, weekly frequency)
- [ ] All icons on onboarding screens are Lucide SVGs — no emoji `[?]` glyphs
- [ ] Fill in: display name, primary goal (e.g. "Get fit"), experience level, weekly frequency
- [ ] Tap through to the last step and confirm
- [ ] App navigates to the **Dashboard** (main tab)
- [ ] **DB check** → `profiles` row now has `display_name`, `primary_goal`, `experience_level`, `weekly_frequency` populated

### 1.4 Sign Out & Sign Back In
- [ ] Go to **Settings** (Profile tab → gear icon) → tap **Sign Out**
- [ ] App returns to Landing screen
- [ ] Tap **Sign In**, enter correct credentials, tap **Sign In**
- [ ] App navigates directly to **Dashboard** (skips onboarding)
- [ ] Wrong password → error message shown (not a crash)

---

## 2. Dashboard

### 2.1 Layout & Data
- [ ] Dashboard shows: Weekly KM progress bar, Run Days dots, Calorie summary, Empire section, Missions strip
- [ ] All icons are Lucide SVGs — no `[?]` glyphs anywhere on this screen
- [ ] Weekly KM progress bar shows correct value (0 km if first use)
- [ ] Run days dots match actual run days this week (empty if first use)

### 2.2 Navigation from Dashboard
- [ ] Tap **View map →** in Empire section → opens **Territory Map** screen
- [ ] Tap **Missions** → opens **Missions** screen
- [ ] Tap calorie section → opens **Calorie Tracker**
- [ ] Bottom tabs (Dashboard, Feed, Run, Coach, Profile) all navigate correctly
- [ ] **START RUN** button (or equivalent) on the Run tab → opens Run setup sheet

---

## 3. Run — Setup & Pre-Run

### 3.1 Run Setup Sheet
- [ ] Tap **Run** tab → Run screen opens
- [ ] GPS status pill shows "Searching…" or "GPS Ready" — no `[?]` glyphs
- [ ] Map loads and **does NOT default to San Francisco** — it should center on your device location (or show a loading state if GPS denied)
- [ ] Activity type selector (Run / Trail / Interval / Long Run) shows Lucide icons, no emoji
- [ ] Route selector works: tap **Choose Route** → RouteModal opens, routes listed with correct Lucide icons (not emoji)
- [ ] Shoe selector works: tap shoe chip → ShoeDrawer opens (if shoes exist)
- [ ] Beat Pacer toggle is functional (no crash)

### 3.2 GPS Acquisition
- [ ] With iOS Location permission **denied**: app shows **Location Required** screen with MapPin icon
- [ ] Tap **Enable Location** → iOS permission prompt appears
- [ ] After granting permission: GPS status changes to "Searching…" then "GPS Ready"
- [ ] Map re-centers to current device location

### 3.3 Start Button
- [ ] While GPS is searching: **START RUN** button is disabled (greyed out, "WAITING FOR GPS" label)
- [ ] Once GPS is ready: button becomes active and shows Play icon — no `▶` text glyph
- [ ] Tap **START RUN** → 3-second countdown plays → Active Run screen loads

---

## 4. Run — Active Run

### 4.1 Live Metrics
- [ ] Screen shows: Distance, Elapsed time, Current pace — all updating in real time
- [ ] Map shows your position moving as you walk/run (or simulated movement in simulator)
- [ ] Route line draws on map as you move
- [ ] GPS pill shows "GPS Ready" with green dot — no `[?]` glyphs

### 4.2 Controls
- [ ] **Pause** button pauses the timer and distance counter
- [ ] **Resume** button restarts tracking
- [ ] **Back / ✕** button shows "Abandon Run?" alert with Cancel/End options — icon is an X, not `✕` text glyph
- [ ] Cancelling the alert returns to active run
- [ ] Confirming ends the run and goes back to Run setup

### 4.3 Territory Claiming
- [ ] As you move through unclaimed zones, a **Claim Progress Ring** appears
- [ ] Ring fills as you run through the zone
- [ ] On claim: **Claim Toast** pops up ("Zone Captured!") with correct icon, no emoji
- [ ] Territory count increments in the session stats

### 4.4 Map Styles
- [ ] Tap the **Layers** icon → Style picker appears (Standard / Dark / Light) — no `[?]` glyphs
- [ ] Selecting each style switches the map basemap

### 4.5 Finish
- [ ] Tap **Finish** → **Finish Confirm Sheet** appears with distance and elapsed time
- [ ] Tap **End Run** → app processes, then navigates to **Run Summary**
- [ ] **DB check** → `runs` table has a new row with correct `user_id`, `distance_m`, `duration_sec`, `started_at`, `finished_at`, `xp_earned`
- [ ] **DB check** → `territories` table has new rows if zones were claimed

---

## 5. Run — Post-Run Summary

### 5.1 Stats Display
- [ ] Summary shows: Distance, Duration, Average Pace, Elevation, Splits
- [ ] All icons correct — no `[?]` glyphs
- [ ] Route map thumbnail shows the run path (if GPS points were recorded)
- [ ] XP Earned badge displays correctly (e.g., "+150 XP")

### 5.2 Rewards Card
- [ ] Rewards card shows XP earned, territories claimed, any PR badges
- [ ] If a PR was broken: "Personal Record" badge appears with Trophy icon — not `🏆`
- [ ] If leveled up: "Leveled Up!" badge shows with Star icon — not `⭐`
- [ ] Streak badge shows Flame icon — not `🔥`

### 5.3 AI Insight Card
- [ ] **Run Insight** card appears below stats
- [ ] Shows either a rule-based insight (if no AI available) or AI-generated praise + analysis
- [ ] Lightbulb icon used for suggestions — not `💡`

### 5.4 Shoe Assignment
- [ ] Shoe chip shows the run's assigned shoe (if one was set)
- [ ] Tap shoe chip → ShoeDrawer opens to change shoe assignment
- [ ] Changing shoe → shoe chip updates, Check icon shown — not `✓`

### 5.5 Share & Save Route
- [ ] **Share** button → generates SVG card, iOS share sheet appears (or error alert)
- [ ] **Save Route** button (visible if route has ≥2 GPS points) → SaveRouteSheet opens
- [ ] SaveRouteSheet shows Lucide icon picker (12 icons, no emoji), name input, Save button
- [ ] Save → route appears in Run Setup sheet's route picker next time

---

## 6. Social Feed

### 6.1 Feed Layout
- [ ] Feed tab opens showing posts from followed users (or "No posts yet" state)
- [ ] Each post card shows: Avatar, Username, Time ago, Activity chip, Stats (Distance/Time/Pace), Badge strip, Reaction bar
- [ ] All icons in the feed are Lucide — no `[?]` glyphs anywhere
- [ ] Activity chip (RUN / TRAIL / INTERVAL / LONG RUN) displays with correct icon

### 6.2 Post Interactions
- [ ] Tap **Thumbs Up (Kudos)** on a post → chip turns black (active), kudos count updates
- [ ] Tap again → kudos removed, chip returns to grey
- [ ] **DB check** → `feed_post_likes` table: row inserted on kudos, deleted on un-kudos
- [ ] Tap **Star** and **Zap** reaction chips → toggle active/inactive state (local state only)

### 6.3 Suggested Runners
- [ ] Pull down feed → Suggested runners section at top (if no follows)
- [ ] Each suggested runner shows avatar, username, stats
- [ ] Follow button shows correct state — Check icon for followed, Plus icon for unfollowed
- [ ] Tap **Follow** → button changes to followed state
- [ ] **DB check** → `followers` table: new row `(your_id, target_id)` inserted
- [ ] Tap **Follow** again (unfollow) → row deleted from `followers`

### 6.4 Notifications Bell
- [ ] Bell icon in Feed header — no `🔔` emoji
- [ ] Tap bell → navigates to Notifications screen

### 6.5 Post Detail
- [ ] Tap a post card → Post Detail sheet opens (full view)
- [ ] Detail sheet shows full stats, route map, badge strip
- [ ] All icons in detail sheet use Lucide — no emoji

---

## 7. Stories

### 7.1 Story Bubbles
- [ ] If you follow users who have stories: story bubbles appear at top of Feed
- [ ] Avatar circles with colored ring indicate unviewed stories

### 7.2 Story Viewer
- [ ] Tap a story bubble → **StoryViewerScreen** opens fullscreen
- [ ] Close button shows **X icon** — not `✕` text glyph
- [ ] Tap close → returns to feed
- [ ] Story auto-advances after a few seconds

---

## 8. Clubs — Browse & Join

### 8.1 Club List
- [ ] Navigate to **Profile → Clubs** (or via a tab if directly accessible)
- [ ] Club list loads with club cards
- [ ] Each card shows: Badge icon (Lucide, not emoji), Club name, Member count (Users icon), Total KM
- [ ] No `[?]` glyphs anywhere on club cards
- [ ] Search bar filters clubs by name — X (clear) button works, no `✕` glyph

### 8.2 Join an Open Club
- [ ] Tap **Join** on an open club
- [ ] Button changes to "Leave" or "Joined" state
- [ ] **DB check** → `club_members` table: row `(club_id, your_user_id, role='member')` inserted
- [ ] **DB check** → `clubs.member_count` incremented by 1

### 8.3 Join a Request-Required Club
- [ ] Tap a club with `join_policy = 'request'`
- [ ] Button shows "Request to Join"
- [ ] Tap → request sent, button changes to "Pending"
- [ ] **DB check** → `club_join_requests` table: new row with `status = 'pending'`

### 8.4 Leave a Club
- [ ] Tap **Leave** on a club you're in
- [ ] Confirmation prompt appears
- [ ] Confirm → removed from club
- [ ] **DB check** → row deleted from `club_members`

---

## 9. Clubs — Club Detail & Members

### 9.1 Club Detail Screen
- [ ] Tap a club card → **ClubDetailScreen** opens
- [ ] Club header shows name, badge icon (Lucide), description, member count
- [ ] Back arrow (← ) is ArrowLeft icon — not `←` text
- [ ] No `[?]` glyphs anywhere

### 9.2 Members Tab
- [ ] Switch to Members tab → list of members sorted by total_km (highest first)
- [ ] Each member shows: Avatar color, username, level, total km
- [ ] Member with "admin" role shows an Admin badge

### 9.3 Activity Tab
- [ ] Switch to Activity tab → recent club activity feed
- [ ] Activity items show: icon, username, action description, time ago
- [ ] All icons are Lucide SVGs

### 9.4 Leaderboard Tab
- [ ] Switch to Leaderboard → ranking of members by distance
- [ ] Your own rank is highlighted
- [ ] Trophy icon for top position — not `🏆`

### 9.5 Join Requests (Admin only)
- [ ] If you are admin: a "Requests" tab or badge appears when there are pending requests
- [ ] Tap a request → Approve / Reject options
- [ ] Approve → user added to `club_members`, request status → 'approved'
- [ ] **DB check** → `club_join_requests.status = 'approved'` and new row in `club_members`

---

## 10. Clubs — Create a Club

### 10.1 Create Flow
- [ ] On Club Screen → tap **Create Club** (or "+" button)
- [ ] Create Club sheet opens: name input, description input, badge icon picker, join policy selector
- [ ] Badge icons are Lucide icons with colors — not emoji
- [ ] Fill in: name = "Test Club QA", description = "Test", pick a badge, set policy = "Open"
- [ ] Tap **Create**

### 10.2 DB Verification
- [ ] **DB check** → `clubs` table has new row:
  - `name = 'Test Club QA'`
  - `owner_id = <your_user_id>` ← **Critical: must be `owner_id`, not `created_by`**
  - `join_policy = 'open'`
  - `member_count = 1` (creator auto-joined)
- [ ] **DB check** → `club_members` table has row `(new_club_id, your_user_id, role='admin')`
- [ ] New club appears in the club list immediately

### 10.3 Edit & Delete (if available)
- [ ] If edit is available: change club description → confirm → `clubs` table updated
- [ ] Delete club (admin only) → club removed from list and DB

---

## 11. Clubs — Lobby Chat

### 11.1 Lobby List
- [ ] From ClubDetailScreen → tap **Lobby** tab or button
- [ ] **LobbyScreen** shows list of chat rooms (e.g., #general, #runs, #goals)
- [ ] Channel icons are Lucide (Globe, Activity, Trophy, Moon) — not emoji
- [ ] Unread message count badges shown

### 11.2 Enter a Chat Room
- [ ] Tap a channel → **LobbyChatScreen** opens
- [ ] Message history loads (older messages at top, newest at bottom)
- [ ] Each message shows: Avatar, username, message text, timestamp
- [ ] Your own messages are right-aligned (if styled)

### 11.3 Send a Message
- [ ] Type a message in the input field and tap **Send**
- [ ] Message appears at the bottom of the chat immediately (optimistic update)
- [ ] **DB check** → `lobby_messages` table: new row with `room_id`, `user_id`, `content`, `created_at`
- [ ] Open the same room on a second device/account → message appears (realtime)

### 11.4 Message Reactions
- [ ] Long press (or tap reaction button) on a message → reaction picker appears
- [ ] Tap a reaction emoji/icon → reaction added below message with count
- [ ] **DB check** → `lobby_message_reactions` table: row `(message_id, your_user_id, emoji)`
- [ ] Tap same reaction again → removed (toggle off)

### 11.5 Realtime
- [ ] With another account: send a message in the same channel
- [ ] The message appears on first account's screen **without refreshing**

---

## 12. Events

### 12.1 Events List
- [ ] Navigate to Events (via Dashboard or tab)
- [ ] Events list shows active events with: Calendar icon (not `📅`), title, date/time, location, distance, participant count
- [ ] No `[?]` glyphs anywhere

### 12.2 Join an Event
- [ ] Tap **Join** on an active event
- [ ] Button changes to "Leave" state
- [ ] **DB check** → `event_participants` table: row `(event_id, your_user_id)` inserted
- [ ] **DB check** → `events.participant_count` **incremented by 1** ← critical fix verification

### 12.3 Leave an Event
- [ ] Tap **Leave** on a joined event
- [ ] **DB check** → row removed from `event_participants`
- [ ] **DB check** → `events.participant_count` decremented by 1

### 12.4 Create Event (Empire-Builder tier)
- [ ] Log in with an Empire-Builder account
- [ ] Tap **Create Event** button
- [ ] Fill in: title, event type, description, location, distance, start/end time
- [ ] Submit → event appears in list
- [ ] **DB check** → `events` table: new row with `creator_id = your_user_id`, `is_active = true`
- [ ] With free-tier account: Create Event is blocked or shows upgrade prompt

---

## 13. Territory Map

### 13.1 Map Opens at Correct Location
- [ ] Navigate to **Territory Map**
- [ ] Map **does NOT open at San Francisco or New Delhi** — it centers on device GPS location
- [ ] If GPS not yet acquired: map follows user location automatically via `followUserLocation`
- [ ] H3 hexagonal grid renders on map

### 13.2 Territory Display
- [ ] Your claimed territories appear highlighted (your color)
- [ ] Enemy territories appear in a different color
- [ ] Unclaimed zones are default map color
- [ ] Territory count badge shows correct number

### 13.3 Territory Info
- [ ] Tap a territory → info popup shows: owner name, level/tier, claimed date, defense level
- [ ] Map icon (🗺) replaced with Lucide Map icon — no emoji glyph

### 13.4 Fortify Territory (if premium)
- [ ] Tap your own territory → "Fortify" button appears
- [ ] Tap Fortify → defense level increments
- [ ] **DB check** → `territories.level` or `fortified_by` updated

### 13.5 Realtime Updates
- [ ] While on the map, have another user claim a territory nearby (or simulate)
- [ ] The territory updates **without requiring a manual refresh**

---

## 14. Leaderboard

### 14.1 Layout
- [ ] Leaderboard screen opens with Weekly tab selected by default
- [ ] All icons are Lucide (Globe, Flag, MapPin for scope filters) — no `🌍🏳📍` emoji
- [ ] Your own rank is highlighted in the list

### 14.2 Tabs & Filters
- [ ] Switch between **Distance / XP / Territories** tabs → list re-sorts correctly
- [ ] Switch between **Week / Month / All-Time** → data changes
- [ ] Switch scope: **Global → National → City** → list filters appropriately

### 14.3 Data Accuracy
- [ ] After completing a run with XP earned: your XP rank updates (may need to pull-to-refresh)
- [ ] **DB check** → `leaderboard_weekly` table: your row shows updated `weekly_km` or `weekly_xp`

---

## 15. Missions

### 15.1 Missions List
- [ ] Navigate to **Missions** screen
- [ ] Today's 3–4 missions are shown
- [ ] Each mission card shows: Icon (MapPin/Map/Flag/Wind/Flame/Timer/Target/Coins/Check — no emoji), title, description, XP reward, progress bar
- [ ] No `[?]` glyphs anywhere

### 15.2 Progress Tracking
- [ ] After completing a run, return to Missions
- [ ] Distance-based missions show updated progress (e.g., "2.3 / 5 km")
- [ ] Territory missions update if zones were claimed

### 15.3 Claim Reward
- [ ] Complete a mission fully (progress = 100%)
- [ ] **Claim** button appears on the completed mission
- [ ] Tap Claim → XP added to player, mission marked complete
- [ ] Claimed mission shows Check icon with "Claimed" label — not `✓`

### 15.4 Daily Reset
- [ ] The next day (or change device clock): missions refresh to a new set
- [ ] Old completed missions are replaced

---

## 16. Coach (AI)

### 16.1 Chat Interface
- [ ] Navigate to **Coach** tab
- [ ] Chat history loads (or empty state on first use)
- [ ] Input field and Send button functional
- [ ] All icons are Lucide — no `🏃🧠` emoji

### 16.2 Send a Message
- [ ] Type "How do I improve my 5k time?" and tap Send
- [ ] Your message appears in the chat immediately
- [ ] Loading indicator shows while waiting for AI response
- [ ] AI response appears below your message (may take a few seconds)
- [ ] **DB check** → `coach_messages` table: two rows — `role='user'` and `role='assistant'`

### 16.3 Training Plan
- [ ] Tap **Generate Training Plan** (or ask "give me a training plan")
- [ ] Training plan appears with weekly breakdown
- [ ] **DB check** → `ai_cache` table: row with `key='training_plan'`, `value` is JSON with plan data
- [ ] Open Coach tab again → cached plan loads without calling AI again

---

## 17. Profile — Own Profile

### 17.1 Profile Screen
- [ ] Navigate to **Profile** tab
- [ ] Shows: Avatar (colored circle with initial), Display Name, Level, Total KM, Total Runs, Follower/Following counts
- [ ] All icons are Lucide (Camera, Bell, Settings, Activity) — no `📷🔔⚙️🏃` emoji

### 17.2 Edit Profile
- [ ] Tap **Edit Profile** or pencil icon
- [ ] Edit sheet opens: display name, bio, location, Instagram, Strava
- [ ] Change display name → tap Save
- [ ] **DB check** → `profiles.display_name` updated
- [ ] Return to profile → new name shown

### 17.3 Avatar
- [ ] Tap avatar → option to change color or upload photo
- [ ] Change avatar color → avatar color updates immediately
- [ ] **DB check** → `profiles.avatar_color` updated
- [ ] Upload photo → avatar shows photo thumbnail
- [ ] **Storage check** → Supabase Storage `avatars/{userId}/avatar.*` file created

### 17.4 Stats & Records
- [ ] **Awards / Trophies tab** → shows earned badges with Medal icons — not `🏅`
- [ ] **Gear tab** → shows registered shoes with Footprints icon — not `👟`
- [ ] **Nutrition tab** → shows daily nutrition summary with Flame icon — not `🔥`
- [ ] Personal Records section shows correct PRs (fastest 5k, longest run, etc.)

---

## 18. Profile — Other User Profile

### 18.1 Navigate to Another User
- [ ] Tap a username in the Feed → **UserProfileScreen** opens
- [ ] Profile shows their stats, recent runs, follower count
- [ ] MapPin icon for location — not `📍`

### 18.2 Follow / Unfollow
- [ ] Tap **Follow** → button changes to **Following** (Check icon)
- [ ] **DB check** → `followers` table: row `(your_id, target_id)` added
- [ ] Tap **Unfollow** → back to Follow state
- [ ] **DB check** → row removed from `followers`
- [ ] Follower count on their profile increments/decrements

---

## 19. History

### 19.1 Run List
- [ ] Navigate to **History** (via Profile or tab)
- [ ] All past runs listed with: date, activity type icon (Activity/MapPin/Zap/Navigation), distance, pace, duration
- [ ] No `[?]` glyphs on any run item

### 19.2 Filters
- [ ] Filter by activity type: **All / Run / Trail / Interval / Long Run**
- [ ] Selecting a filter → list updates to show only that type
- [ ] Stats bar (Total km, Avg km, Run count) updates with filter

### 19.3 Pull to Refresh
- [ ] Pull down → spinner shows → list reloads with any new runs

---

## 20. Gear / Shoes

### 20.1 Shoe List
- [ ] Navigate to **Gear** (via Profile tab → Gear, or dedicated screen)
- [ ] Shoe list shows all added shoes: name, brand, photo (or placeholder), distance used
- [ ] Footprints icon used — not `👟`

### 20.2 Add a Shoe
- [ ] Tap **Add Shoe** (or "+" button)
- [ ] Form opens: Brand, Model, Purchase Date, Color, Size, Photo picker
- [ ] Photo picker camera icon is Lucide Camera — not `📷`
- [ ] Fill in brand = "Nike", model = "Air Zoom", tap **Save**
- [ ] New shoe appears in the list with 0 km

### 20.3 Shoe Details
- [ ] Tap a shoe → detail view shows: total KM, last run date, run history assigned to this shoe
- [ ] **Set as Default** toggle works — Check icon when active

### 20.4 Retire a Shoe
- [ ] Long press or tap Retire option on a shoe
- [ ] Shoe moves to "Retired" section or is hidden from active list

### 20.5 Foot Scan (if available)
- [ ] Tap **Foot Scan** → camera opens
- [ ] Take photo → loading indicator appears
- [ ] Result screen shows arch type analysis with appropriate icons — no emoji

---

## 21. Nutrition Setup

### 21.1 Setup Flow
- [ ] Navigate to **Nutrition** → if no profile exists, Setup form appears
- [ ] Form fields: Goal (Weight loss/Maintenance/Gain), Activity Level, Diet type, Weight (kg), Height (cm), Age, Sex
- [ ] All option icons are Lucide (Tv/Activity/Trophy for activity levels) — no `🛋️🏃🏆`
- [ ] Diet icons: Flame/Scale/Dumbbell/Beef/Leaf/Fish/Moon — no emoji
- [ ] Fill in all fields and tap **Save**
- [ ] **DB check** → `nutrition_profiles` table: row for your user_id with `daily_goal_kcal`, `protein_goal_g`, `carbs_goal_g`, `fat_goal_g` calculated and saved

### 21.2 Edit Setup
- [ ] Return to Nutrition Setup → form pre-filled with existing values
- [ ] Change weight → save → `nutrition_profiles` row updated

---

## 22. Calorie Tracker

### 22.1 Daily Summary
- [ ] Navigate to **Calorie Tracker**
- [ ] Today's date shown at top
- [ ] Goal ring or progress bar shows calories consumed / daily goal
- [ ] Macro bars (protein, carbs, fat) shown with correct values
- [ ] Settings gear icon is Lucide Settings — not `⚙`

### 22.2 Add Food Entry
- [ ] Tap **Add Food** (or "+ Breakfast/Lunch/Dinner/Snacks")
- [ ] **Add Food Modal** opens with food name, calories, macros, meal selector
- [ ] X button to close uses Lucide X icon — not `✕`
- [ ] Fill in: name = "Banana", kcal = 90, protein = 1, carbs = 23, fat = 0, meal = Breakfast
- [ ] Tap **Add** → entry appears under Breakfast section
- [ ] **DB check** → `nutrition_logs` table: new row with `user_id`, `log_date = today`, `meal = 'breakfast'`, `name = 'Banana'`, `kcal = 90`

### 22.3 Delete Entry
- [ ] Swipe or long-press a food entry → delete option
- [ ] Confirm delete → entry removed from list
- [ ] **DB check** → row deleted from `nutrition_logs`

### 22.4 Run Calories
- [ ] After completing a run: a "Run" entry auto-appears in the tracker with `source = 'run'`
- [ ] **DB check** → `nutrition_logs` row with `source = 'run'` and correct kcal burned

---

## 23. Notifications

### 23.1 Notifications List
- [ ] Navigate to **Notifications** screen (via bell icon or tab)
- [ ] List shows notifications with: Bell icon (not `🔔`), type label, title, body, time ago
- [ ] Unread notifications have a visual highlight
- [ ] Empty state shown if no notifications

### 23.2 Mark as Read
- [ ] Tap a notification → marked as read (highlight removed)
- [ ] **DB check** → `notifications.read = true` for that row
- [ ] **Mark All Read** button → all notifications cleared
- [ ] **DB check** → all rows for your user_id have `read = true`

### 23.3 Deep Link
- [ ] Tap a notification that references a club → navigates to that club's screen
- [ ] Tap a notification referencing a run → navigates to that run summary (if applicable)

---

## 24. Settings

### 24.1 Settings Screen
- [ ] Navigate to **Settings** (Profile tab → gear icon)
- [ ] Screen shows sections: Account, Preferences, Training, Notifications, About
- [ ] All icons Lucide — no `⚙️` emoji

### 24.2 Account Section
- [ ] **Edit Profile** link → navigates to Profile tab (functional, not a crash)
- [ ] **Profile Visibility** (Public/Friends/Private) → selector works
- [ ] Change to "Friends" → **DB check** → `profiles.privacy = 'followers'`

### 24.3 Preferences
- [ ] **Distance Unit** (km/miles) toggle → changes display everywhere
- [ ] **Dark Mode** toggle → visual mode changes (if implemented)

### 24.4 Training Settings
- [ ] **GPS Accuracy** (High/Medium) → saves correctly
- [ ] **Auto-Pause** toggle → saves

### 24.5 Notifications
- [ ] **Run Reminders** toggle → saves
- [ ] **Territory Alerts** toggle → saves
- [ ] **Weekly Summary** toggle → saves

### 24.6 Sign Out
- [ ] Tap **Sign Out** → confirmation alert appears
- [ ] Confirm → returns to Landing screen, session cleared
- [ ] Tap back → cannot navigate back to authenticated screens

---

## 25. Connected Devices

### 25.1 Devices List
- [ ] Navigate to **Settings → Connected Devices**
- [ ] Devices list shows any paired devices with: Smartphone icon (not `📱`), device name, type, connection status
- [ ] Activity/TrendingUp/Brain icons used for device types — not `🏃📈🧠`
- [ ] Status dots are colored Views — not `🟣⚫🔴` emoji circles

### 25.2 Add Device
- [ ] Tap **Add Device** or pair button
- [ ] Device type picker shows correct icons
- [ ] Pair → **DB check** → `device_connections` table: new row with `device_type`, `device_name`, `user_id`

### 25.3 Remove Device
- [ ] Tap remove/disconnect on a device
- [ ] **DB check** → row removed from `device_connections`

---

## 26. Subscription Screen

### 26.1 Layout
- [ ] Navigate to **Subscription** (Profile → Upgrade, or Settings)
- [ ] Three tiers shown: Free, Premium, Empire-Builder
- [ ] Feature comparison table uses Check/X icons — not `✓✕`
- [ ] Flag icon used for any national reference — not `🏴`
- [ ] Current plan highlighted

### 26.2 Feature Gates (Free Account)
- [ ] **Territory cap**: After claiming N territories, new claims are blocked with upgrade prompt
- [ ] **Create Event**: Button shows "Upgrade to Empire-Builder" prompt — not a crash

### 26.3 Upgrade Flow (use Sandbox)
- [ ] Tap **Upgrade to Premium** → Apple IAP sheet appears (sandbox environment)
- [ ] Complete sandbox purchase → tier updates
- [ ] **DB check** → `profiles.subscription_tier = 'premium'`
- [ ] Feature gates unlocked: territory cap removed

---

## 27. Realtime & Sync Checks

### 27.1 Post-Run Sync
- [ ] Complete a run
- [ ] **DB check immediately after** → `runs` table has the new run
- [ ] Check `territories` table → any claimed zones are saved
- [ ] Open Leaderboard → your weekly_km updated

### 27.2 Territory Realtime
- [ ] Open Territory Map
- [ ] On another device/account: claim a territory in the same area
- [ ] **First account's map**: territory color changes within 5 seconds — no manual refresh needed

### 27.3 Chat Realtime
- [ ] Open LobbyChatScreen on two devices/accounts in the same room
- [ ] Send a message from Device A → it appears on Device B within 2 seconds
- [ ] Send from Device B → appears on Device A within 2 seconds

### 27.4 Club Join Realtime
- [ ] Account A is an admin of a club
- [ ] Account B sends a join request
- [ ] Account A's join request badge updates (may require screen refresh if no realtime subscription)

---

## 28. Edge Cases & Error States

### 28.1 No Network
- [ ] Turn off WiFi and cellular → try to load Feed
- [ ] App shows error state (not a blank screen or crash)
- [ ] Dashboard still loads from local SQLite cache

### 28.2 Empty States
- [ ] New account with no runs: History screen shows empty state message
- [ ] New account with no follows: Feed shows "Follow runners to see their activity"
- [ ] No clubs joined: Club screen shows "Browse clubs below"
- [ ] All empty states have correct icons (no `[?]` glyphs)

### 28.3 Icon Sweep Final Check
Walk through every screen listed below and confirm **zero `[?]` glyphs** appear:
- [ ] Landing / Login / Sign Up
- [ ] Onboarding
- [ ] Dashboard
- [ ] Run Setup Sheet
- [ ] Active Run (HUD, controls, toast)
- [ ] Run Summary (all badges, icons, cards)
- [ ] Feed (post cards, reaction chips, suggestions)
- [ ] Story Viewer
- [ ] Club List + Club Detail + Lobby Chat
- [ ] Events list
- [ ] Territory Map
- [ ] Leaderboard
- [ ] Missions
- [ ] Coach chat
- [ ] Profile (all 3 tabs: Awards, Gear, Nutrition)
- [ ] History
- [ ] Gear screens
- [ ] Nutrition Setup + Calorie Tracker
- [ ] Notifications
- [ ] Settings
- [ ] Connected Devices
- [ ] Subscription

### 28.4 DB Column Name Check (Club Creation Critical)
- [ ] Create a new club
- [ ] **DB check** → `clubs` table row must have `owner_id` populated (NOT `created_by` which is undefined)
- [ ] RLS should allow you to see and edit your own club

### 28.5 Events Participant Count
- [ ] Note current `participant_count` on an event
- [ ] Join → count increments by 1 in DB
- [ ] Leave → count decrements by 1 in DB
- [ ] Join again → count increments again (was the critical bug fixed)

### 28.6 Map Default Location
- [ ] Fresh launch → open Run tab
- [ ] Map center **must not be San Francisco (37.7, -122.4)**
- [ ] Map must center on or follow device GPS location

---

## Appendix — Supabase Tables Quick Reference

| Table | What to verify | When |
|-------|---------------|------|
| `profiles` | `display_name`, `subscription_tier`, `owner_id` (clubs), privacy | Auth, onboarding, profile edit |
| `runs` | `user_id`, `distance_m`, `duration_sec`, `xp_earned`, `territories_claimed` | After every run |
| `territories` | `owner_user_id`, claimed zones count | After run with territory claims |
| `clubs` | `owner_id` (not `created_by`), `member_count` | After club create/join |
| `club_members` | `club_id`, `user_id`, `role` | After join/leave/create |
| `club_join_requests` | `status` = pending/approved/rejected | After request/approval |
| `lobby_messages` | `room_id`, `user_id`, `content` | After sending chat message |
| `lobby_message_reactions` | `message_id`, `user_id`, `emoji` | After reacting |
| `events` | `participant_count`, `creator_id` | After join/leave/create |
| `event_participants` | `event_id`, `user_id` | After join/leave |
| `followers` | `follower_id`, `following_id` | After follow/unfollow |
| `feed_post_likes` | `post_id`, `user_id` | After kudos |
| `nutrition_logs` | `user_id`, `log_date`, `kcal`, `source` | After adding food, after run |
| `nutrition_profiles` | `daily_goal_kcal`, `protein_goal_g` | After nutrition setup |
| `coach_messages` | `role`, `content` | After coach chat |
| `ai_cache` | `key`, `value` | After training plan generated |
| `notifications` | `read` flag | After marking read |
| `device_connections` | `device_type`, `user_id` | After add/remove device |
