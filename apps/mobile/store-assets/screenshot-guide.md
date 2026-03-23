# Screenshot Capture Guide

Capture on iPhone 16 Pro Max (6.9") for primary App Store submission.
Device size: 1320 × 2868 px @3x. Use Xcode Simulator or physical device.

---

## Setup Before Shooting

1. Log in with a demo account that has:
   - Level 8+ player
   - 12+ territories claimed (mix of red own / blue enemy on map)
   - 5-day streak
   - 3 active missions

2. Set the map to a dense urban area (e.g. London, NYC, Tokyo) to show territory density.

3. Enable dark mode for shots 1, 2, 3 — light mode for shots 4, 5.

---

## Shot 1 — Territory Map
**Screen:** TerritoryMap
**State:**
- Zoom level 14, user dot centred
- 8+ red (owned) hexagons visible
- 4+ blue (enemy) hexagons visible
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
- GPS trail visible (red polyline)
- ClaimProgressRing at ~70%
- Territories claimed: 2
**Action:** Capture mid-run
**Caption overlay:** "Real-time territory claiming"

---

## Shot 3 — Run Summary
**Screen:** RunSummaryScreen
**State:**
- runData: distance 5.1 km, duration 1680s, pace 5:28, territoriesClaimed 4
- xpEarned: 340, coinsEarned: 12, leveledUp: false
- Show the RewardsCard fully expanded
**Caption overlay:** "XP, coins, and territory — every run counts"

---

## Shot 4 — Dashboard
**Screen:** DashboardScreen (light mode)
**State:**
- Player: Level 8, 1240 XP, 5-day streak
- Today's stats: 5.1 km run shown
- 3 missions visible in mission row
**Caption overlay:** "Track your empire at a glance"

---

## Shot 5 — AI Coach
**Screen:** CoachScreen (light mode)
**State:**
- Show a coach message thread
- Assistant message: "Your average pace improved by 12 seconds/km this week. I'd recommend a tempo run tomorrow — aim for 4:45/km over 4 km to push your lactate threshold."
- User message above: "How did I do this week?"
**Caption overlay:** "Your AI coach knows your data"

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
