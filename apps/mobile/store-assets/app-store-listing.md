# Runivo — App Store Listing

> v1 launch scope only. AI Coach, Nutrition Tracker, Foot Scan, Shoe Tracker, Clubs &
> Events are built but flagged off (`apps/mobile/src/config/features.ts`) and show
> "Coming Soon" in the shipped build — do not mention them here until those flags flip
> back on. Re-add their copy blocks below (they're preserved in git history) once live.

## App Name
Runivo: Run. Claim. Dominate.

## Subtitle (30 chars max)
Territory-claiming running app

## Category
Primary:   Health & Fitness
Secondary: Sports

---

## Description (4000 chars max)

**Turn every run into a battle for territory.**

Runivo transforms your daily run into a location-based strategy game. Claim zones around your city, defend them against rivals, and build an empire — one kilometre at a time.

**CLAIM TERRITORY**
Every run you complete draws a corridor on the map and converts it into your territory. The more ground you cover, the more zones you own. Run the same streets to fortify your hold; let a rival run through and they steal it back.

**REAL-TIME RIVALRY**
Other runners in your city are competing for the same map. Watch zones flip colours in real time. Get push notifications the moment an enemy enters your territory so you can plan your counter-run.

**PACE ECONOMY & RUNNER RANK**
Every kilometre and every zone you claim earns PACE. Build your PACE balance, climb from Pacer to Sovereign as your Runner Rank rises, and track your Territory Score against every other runner in your city.

**MISSIONS & LEADERBOARDS**
Daily and weekly missions give you targets beyond just running. Climb the global leaderboard or compete within your city.

**SOCIAL FEED**
Follow other runners, see their claims and conquests, and share your own runs and territory milestones.

**HISTORY**
Every run is saved with GPS route, pace splits, and territory claims. Review your history and watch your empire grow over time.

---

## Keywords (100 chars max, comma-separated)
running,territory,GPS,map,game,fitness,tracker,rival,claim,leaderboard,run,rank,social

---

## Promotional Text (170 chars max — shown above description, can be updated without review)
Claim your city, one run at a time. Earn PACE, climb the Runner Rank ladder, and defend your territory from rivals.

---

## What's New (Version 1.0)
First release. Run. Claim. Dominate.

---

## Support URL
https://runivo.app/support

## Marketing URL
https://runivo.app

## Privacy Policy URL
https://runivo.app/privacy

---

## Age Rating
4+ (no objectionable content)

## Content Descriptions
- Location: Always — required for background run tracking
- Health & Fitness: Yes — writes runs to Apple Health

---

## Apple Review Notes

**Background Location:**
Runivo tracks the user's GPS position continuously during an active run so that territory claims are accurate and the route is recorded. The app requests "Always" location permission because runs continue while the screen is locked. A foreground service notification is displayed at all times during tracking.

**HealthKit:**
The app writes completed run workouts (distance, duration, calories, start/end time) to Apple Health after each run, and optionally reads past workouts to pre-populate baseline stats. This is opt-in and explained in onboarding.

**Test Account:**
[Fill in before submission — see below.] A brand-new signup starts with zero territory by design (the Territory Map shows an explicit "Be the first to claim your city" empty state for new users) — there is no pre-seeded sample data on first launch. For a faster review, we recommend logging in with the demo account below, which already has run history, claimed territory, and a PACE balance:
  - Email: [demo account email]
  - Password: [demo account password]
  - This account has [N] runs, [N] claimed territory zones, and a Runner Rank of [rank].
To test live territory claiming yourself, a short walk (as little as ~100m) with location services enabled is enough to trigger GPS lock and claim a small zone — the core loop does not require a long run to demonstrate.

---

## Screenshots Required (iOS)

### iPhone 6.9" (iPhone 16 Pro Max) — 1320 × 2868 px
1. Territory Map — claimed zones (own) vs rival zones, freshness-colored
2. Active Run screen mid-run with GPS trail, timer, and territory claim progress
3. Run Summary screen with PACE earned, territory claimed, and Runner Rank
4. Dashboard with Territory Score, Runner Rank, City Rank, and streak
5. Leaderboard showing city rankings

### iPhone 6.7" (iPhone 15 Plus) — 1290 × 2796 px
(Same 5 screenshots, resized)

### iPad 13" (optional) — 2064 × 2752 px
(Optional — app is iPhone-only, supportsTablet: false)

---

## Android Play Store (Additional)

**Short Description (80 chars):**
Claim running territory. Earn PACE. Rival runners. GPS tracking.

**Full Description:**
(Same as iOS description above)

**Content Rating:** Everyone
**Target SDK:** 35 (Android 15)

### Screenshots Required
- Phone: 1080 × 1920 px minimum, 8 screenshots max
- Same 5 topics as iOS
