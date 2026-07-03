# Screenshot Capture Guide

Capture on iPhone 16 Pro Max (6.9") for primary App Store submission.
Device size: 1320 × 2868 px @3x. Use Xcode Simulator or physical device.

---

## Setup Before Shooting

1. Log in with a demo account that has:
   - Territory Score reflecting a meaningful footprint (several claimed zones)
   - 12+ territories claimed (mix of own zones / rival zones on map)
   - A 5-day+ run streak
   - 3 active missions
   - A Runner Rank above the starting tier (e.g. Chaser or Hunter, not Pacer)

2. Set the map to a dense urban area (e.g. London, NYC, Tokyo) to show territory density.

3. Enable dark mode for shots 1, 2, 3 — light mode for shots 4, 5.

---

## Shot 1 — Territory Map
**Screen:** TerritoryMap
**State:**
- Zoom level 14, user dot centred
- 8+ own zones visible, colored by freshness (bright = recently defended, faded = stale)
- 4+ rival zones visible in the rival color
- Filter chips: "All" selected
**Action:** None — static map
**Caption overlay (add in design tool):** "Claim every street you run"

---

## Shot 2 — Active Run
**Screen:** ActiveRun
**State:**
- Run in progress, isRunning = true
- Elapsed: 18:43
- Distance: 3.2 km
- GPS trail visible (route polyline)
- ClaimProgressRing at ~70%
- Territories claimed: 2
**Action:** Capture mid-run
**Caption overlay:** "Real-time territory claiming"

---

## Shot 3 — Run Summary
**Screen:** RunSummaryScreen
**State:**
- runData: distance 5.1 km, duration 1680s, pace 5:28, territoriesClaimed 4
- paceEarned: 34, runnerRank shown with a rank-up indicator if applicable
- Show the territory/PACE breakdown card fully expanded
**Caption overlay:** "PACE, Runner Rank, and territory — every run counts"

---

## Shot 4 — Dashboard
**Screen:** DashboardScreen (light mode)
**State:**
- Player: Runner Rank badge, Territory Score, City Rank populated
- Today's stats: 5.1 km run shown
- 3 missions visible in mission row
**Caption overlay:** "Track your empire at a glance"

---

## Shot 5 — Leaderboard
**Screen:** LeaderboardScreen (light mode)
**State:**
- Show the demo account placed within the top of a city leaderboard
- Territory Score / Runner Rank badges visible per entry
**Caption overlay:** "Own your city's leaderboard"

---

## Post-processing

1. Import shots into Figma or Canva
2. Add phone frame (Apple Device Frames plugin)
3. Add gradient background: `#0A0A0A` → `#1A0A0A` (dark red)
4. Add caption text: `PlayfairDisplay_400Regular_Italic` 36pt white
5. Export at 1320 × 2868 px PNG, 72 DPI

---

## App Icon Check (1024 × 1024 px)
Current: `assets/icon.png`
- Must be exactly 1024 × 1024 px
- No alpha channel (iOS rejects transparent icons)
- No rounded corners (Apple adds them automatically)
- Run: `sips -g pixelWidth assets/icon.png` to verify dimensions
