# Runivo — Complete App Overview

> **Run · Capture · Conquer** — A territory-claiming running app that turns fitness into a competitive location-based game.

---

## Table of Contents

1. [App Overview](#app-overview)
2. [Tech Stack](#tech-stack)
3. [All Pages & Features](#all-pages--features)
4. [Run Tracking Mechanics](#run-tracking-mechanics)
5. [Territory System](#territory-system)
6. [Points, Coins & Diamonds](#points-coins--diamonds)
7. [Energy System](#energy-system)
8. [Levels & Progression](#levels--progression)
9. [Missions System](#missions-system)
10. [Game Mechanics](#game-mechanics)
11. [Premium Subscriptions](#premium-subscriptions)
12. [Social & Feed](#social--feed)
13. [Leaderboards](#leaderboards)
14. [Achievements & Records](#achievements--records)
15. [Clubs](#clubs)
16. [Events](#events)
17. [Onboarding Flow](#onboarding-flow)
18. [Settings & Customization](#settings--customization)
19. [Data & Sync](#data--sync)
20. [Key Formulas](#key-formulas)
21. [Database Tables](#database-tables)
22. [Numbers at a Glance](#numbers-at-a-glance)

---

## App Overview

Runivo gamifies running through real-world territory control. Users run physical routes, claiming hexagonal map tiles as territories. Territories generate passive coin income, can be attacked by other players, and must be defended by running. The more you run, the more territory you own, the more passive income you earn, and the higher you climb the leaderboards.

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React 18 + TypeScript + TailwindCSS + Framer Motion |
| Build | Vite |
| Maps | MapLibre GL (Carto positron/dark-matter tiles) |
| Territory Grid | H3-js (hexagonal tiles, resolution 9) |
| Backend | Supabase (Postgres + Auth + Realtime) |
| Local Cache | IndexedDB (offline-first) |
| Audio | Howler.js |
| Routing | React Router v6 |

---

## All Pages & Features

| Page | Route | Purpose |
|---|---|---|
| Home / Dashboard | `/home` | Stats overview, passive income, missions, motivation |
| Run Setup | `/run` | Activity type picker, GPS sync, saved routes |
| Active Run | `/active-run` | Live GPS tracking, territory claiming, map |
| Run Summary | `/run-summary` | Post-run stats, replay map, share card |
| Territory Map | `/territory-map` | Full-screen hex map, filter owned/enemy/neutral |
| Feed | `/feed` | Social activity posts, kudos, following |
| Leaderboard | `/leaderboard` | Rankings by distance / zones / XP |
| Profile | `/profile` | Stats, achievements, records, edit profile |
| History | `/history` | All past runs grouped by date |
| Missions | `/missions` | Daily mission selection & progress |
| Events | `/events` | Community runs, races, challenges |
| Club | `/club` | Club rankings, chat, member activity |
| Lobby | `/lobby` | Global community chat |
| Notifications | `/notifications` | Territory alerts, kudos, club activity |
| Settings | `/settings` | Appearance, sound, GPS, privacy |
| Subscription | `/subscription` | 3 premium tiers |
| Onboarding | `/onboarding` | Multi-step signup (9 steps) |

---

## Run Tracking Mechanics

### GPS Filtering
- **Accuracy threshold:** 30m — points with worse accuracy are discarded
- **Valid speed range:** 0.8 – 12.0 m/s (filters stationary jitter and teleports)
- **Teleport filter:** Points >100m from last point in <1s are dropped
- **Throttle:** Position updates processed max once per second

### Metrics Calculated
| Metric | How |
|---|---|
| Distance | Haversine formula between consecutive GPS points |
| Pace | Minutes per km (rolling average) |
| Speed | Current m/s from GPS |
| Calories | Based on weight × distance (from biometrics in profile) |
| Elevation | GPS altitude (where available) |

### Activity Types (17 total)
Run · Jog · Sprint · Walk · Hike · Cycle · Trail Run · HIIT · Strength · Swim · Wheelchair · Ski · Cross-Country · Tempo · Fartlek · Interval · Race

---

## Territory System

### The Grid
- **Hexagonal tiles** using H3 library at resolution 9 (~500m wide per hex)
- Run path creates a 50m-wide corridor polygon
- All hexes intersecting that corridor become claimable

### Claiming a Territory
| Scenario | Claim Time | Energy Cost |
|---|---|---|
| Neutral zone | 15 seconds contact | 10 energy |
| Enemy zone | 45s + (defense × 1.2s) | 10 energy |
| Max siege time | 300 seconds | — |

- Claim progress bar fills 0 → 100% while inside the zone
- Leaving a zone mid-claim resets the bar

### Territory Defense
- **Initial defense on capture:** 30
- **Max defense:** 100
- **Fortify rate:** +4 defense per 8-second tick while running inside
- **Adjacent bonus:** +3 defense to each neighboring owned territory
- **Daily decay:** -10 defense per day after 3 days idle
- No run for 3 days → passive income also pauses

### Territory Tiers & Income Multipliers
| Tier | Income Multiplier |
|---|---|
| Common | 1.0× |
| Uncommon | 1.5× |
| Rare | 2.0× |
| Epic | 3.0× |
| Legendary | 5.0× |

### Territory Status Colors (Map)
- **Owned (mine):** Teal/green
- **Enemy:** Red/orange
- **Neutral:** Gray
- **Contested:** Pulsing animation

---

## Points, Coins & Diamonds

### XP — How Earned
| Action | XP |
|---|---|
| Claim neutral territory | 25 XP |
| Claim enemy territory | 60 XP |
| Per km run | 30 XP |
| Fortify territory | 10 XP |
| Speed bonus (pace >3.5 m/s) | ×1.4 multiplier on all XP |

### Coins (Soft Currency) — How Earned
| Action | Coins |
|---|---|
| Claim neutral territory | 10 coins |
| Claim enemy territory | 25 coins |
| Per km run | 5 coins |
| Passive income (daily) | 5 × zones owned × tier multiplier × contiguity bonus |
| Runner Plus subscriber | 2× daily passive income |

**Passive income formula:**
```
daily_income = owned_zones × 5 × tier_multiplier × (1 + contiguity_bonus)
contiguity_bonus = min(adjacent_owned_count × 0.1, 1.0)  — max +100%
```
Paid hourly. Pauses if no run in last 3 days.

### Diamonds (Premium Currency) — How Earned
| Source | Amount |
|---|---|
| Reach level 5 | 2 💎 |
| Reach level 10 | 5 💎 |
| Reach level 15 | 10 💎 |
| Reach level 20 | 20 💎 |
| 7-day streak | 3 💎 |
| 30-day streak | 10 💎 |
| 100-day streak | 25 💎 |
| Certain daily missions | 0–5 💎 |
| Empire Builder monthly bonus | 50 💎 |

**New player start:** 100 coins + 5 diamonds

### Diamonds — How Spent
- Premium cosmetics (avatar frames, trail colors)
- Revive interrupted runs
- Special one-time powerups
- Profile customization items

---

## Energy System

| Item | Value |
|---|---|
| Max energy | 100 |
| Passive regen | 10 / hour |
| Regen while running | 10 / km run (real-time) |
| Territory claim cost | 10 energy |
| Shield powerup | 30 energy |
| Boost powerup | 20 energy |
| Scan powerup | 10 energy |

If energy hits 0, claim progress freezes at 100% — you're in the zone but can't complete the capture until energy regens.

---

## Levels & Progression

### XP Thresholds
| Level | Title | XP Required |
|---|---|---|
| 1 | Scout | 0 |
| 2 | Pathfinder | 200 |
| 3 | Trailblazer | 500 |
| 4 | Ranger | 900 |
| 5 | Explorer | 1,400 |
| 6 | Captain | 2,000 |
| 7 | Vanguard | 2,800 |
| 8 | Commander | 3,800 |
| 9 | Warlord | 5,000 |
| 10 | General | 6,500 |
| 11 | Conqueror | 8,500 |
| 12 | Overlord | 11,000 |
| 13 | Sovereign | 14,000 |
| 14 | Emperor | 17,500 |
| 15 | Titan | 22,000 |
| 16 | Mythic | 27,000 |
| 17 | Immortal | 33,000 |
| 18 | Transcendent | 40,000 |
| 19 | Apex | 48,000 |
| 20 | Legend | 58,000 |

Level-ups trigger: animation, diamond reward, title update, leaderboard refresh.

---

## Missions System

### Daily Mission Flow
1. At start of day, player selects **3 missions** from available templates
2. Missions expire at 23:59:59 each day
3. Progress auto-tracked during and after runs
4. Player taps "Claim" to collect reward once complete

### Mission Difficulty Tiers
| Difficulty | XP Reward Range |
|---|---|
| Easy | 30–55 XP |
| Medium | 60–100 XP |
| Hard | 120+ XP |

### Example Missions
| Mission | Target | Rewards |
|---|---|---|
| Morning Miles | Run 1 km | 30 XP, 15 coins |
| Land Grab | Claim 1 territory | 40 XP, 20 coins |
| Hostile Takeover | Capture 1 enemy zone | 75 XP, 35 coins, medium |
| Speed Demon | Hold <6:00/km for 1 km | 70 XP, 35 coins |
| Behind Enemy Lines | Run 500m through enemy territory | 60 XP, 30 coins |
| Calorie Crusher | Run 2 km | 55 XP, 25 coins |
| Explorer | Pass through 5 different hexes | 25 XP, 10 coins |

### Mission Categories (aligned to onboarding goal)
- Weight Loss → distance/calorie missions
- Endurance → long steady runs
- Speed → pace targets
- Territory → claim, fortify, capture
- Explorer → new hexes, varied routes
- General → mixed challenges

---

## Game Mechanics

### Speed Multiplier
- Triggers when pace **> 3.5 m/s** (~10:17/km)
- Multiplies all XP and coin rewards by **1.4×** for that run

### Streaks
- Increments for every day you complete a run
- Resets if you skip a day
- Diamond milestones at 7 / 30 / 100 days

### Ghost Runs
- Re-run a saved route with a ghost trail overlay on the map
- Ghost appears as a translucent line showing your previous path
- Good for chasing personal records or training consistency

### Powerups (During Run)
| Powerup | Effect | Cost |
|---|---|---|
| Shield | Protects owned territories from capture | 30 energy |
| Boost | 1.4× XP/coin multiplier | 20 energy |
| Scan | Reveals nearby enemy territories | 10 energy |

### Weekly Goal
- Customizable km target (default 20 km)
- Auto-calculated from onboarding: `frequency × session_distance`
- Visualized as a ring on the dashboard
- Resets every Monday

### Saved Routes
- Save completed runs as named routes (with emoji icon)
- Reuse as ghost-run references
- Share publicly or keep private
- Synced to Supabase for cross-device access

---

## Premium Subscriptions

### Free
- Max 20 territories
- 100 energy max, 10/hour regen
- Standard ads
- Basic analytics

### Runner Plus — $4.99/month
- Unlimited energy
- No ads
- **2× daily passive coin income**
- Advanced analytics
- Custom profile colors

### Territory Lord — $9.99/month ⭐ Most Popular
- Everything in Runner Plus, plus:
- AI route optimization
- Real-time territory attack alerts
- Auto-defense (auto-fortifies weak zones)
- Exclusive legendary territory types
- Weekly coaching tips

### Empire Builder — $19.99/month
- Everything in Territory Lord, plus:
- Create & host events
- Found & manage clubs
- Territory naming rights
- Personal trainer AI
- Beta feature access
- **+50 diamonds/month**

---

## Social & Feed

### Activity Posts
Each run auto-generates a feed post showing:
- Distance, duration, pace, elevation, calories
- Territories claimed / enemy zones captured
- PRs achieved (badge if new record)
- Route line on mini map

### Kudos / Reactions
| Reaction | Emoji |
|---|---|
| Kudos | 👏 |
| Fire | 🔥 |
| Crown | 👑 |
| Muscle | 💪 |

### Feed Tabs
- **Explore** — All public runs
- **Following** — Only people you follow

### Profile Sharing
- Share card image generation (distance, zones, level)
- QR code for profile link
- Strava + Instagram handle integration
- Privacy levels: Public / Followers Only / Private

---

## Leaderboards

### Metrics
1. Distance (km)
2. Zones claimed
3. XP earned

### Time Frames
- This Week (Mon–Sun)
- This Month (last 30 days)
- All Time

Shows top 50 players. Your own rank always highlighted. Recalculated nightly.

---

## Achievements & Records

### Personal Records Tracked
| Record | Description |
|---|---|
| Fastest 1K | Estimated time if run ≥1 km |
| Fastest 5K | Estimated time if run ≥5 km |
| Fastest 10K | Estimated time if run ≥10 km |
| Longest Run | Max single-run distance |
| Best Pace | Fastest seconds/km (runs >0.5 km) |
| Most Territories | Most zones in a single run |

### Achievement Categories
- Distance milestones (5K / 10K / 50K / 100K total)
- Territory milestones (10 / 25 / 50 zones claimed)
- Streak milestones (7 / 30 / 100 day streaks)
- Speed milestones
- Social milestones (followers, post engagement)
- Level milestones
- Exploration (unique hexes visited)

---

## Clubs

### Requirements
- **Create club:** Empire Builder subscription only
- **Join club:** Open / request-based / invite-only (per club setting)

### Club Stats
- Club level (aggregate of member levels)
- Member count
- Total territories controlled
- Club streak (consecutive days with runs by any member)
- Weekly km (aggregate)
- Daily coin income

### Club Roles
Owner → Admin → Member → Pending

### Club Chat
- Real-time messaging (Supabase Realtime)
- Activity feed: level-ups, territory captures/defends
- Message read receipts

---

## Events

### Event Types
- Community Runs (group activities)
- Challenges (time-based competitions)
- Races (competitive with live rankings)

### Event Details
- Title, description, category, distance
- Start/end times + location
- Participant count
- Organizer (Empire Builder subscribers can create)

### Participation
- Join (`event_participants` table)
- Save for later (local)
- Filter: upcoming vs past

---

## Onboarding Flow (9 Steps)

| Step | Screen | Data Collected |
|---|---|---|
| 1 | Welcome | — |
| 2 | Account | Username, email, password |
| 3 | Biometrics | Age, gender, height (cm), weight (kg) |
| 4 | Experience | new / casual / regular / competitive |
| 5 | Goal | get_fit / lose_weight / run_faster / explore / compete |
| 6 | Weekly Plan | Frequency (days/week) × preferred distance |
| 7 | Location | GPS permission |
| 8 | Preferences | km/mi, notifications, mission difficulty |
| 9 | Ready | Confirm → enter app, seed local territories |

Weekly goal auto-calculated:
```
frequency_per_week × session_distance_km = weekly_goal_km
(e.g. 3 times × 5K = 15 km/week)
```

---

## Settings & Customization

### Appearance
- Dark mode toggle
- Distance unit: km / mi
- Avatar color: 8 options (teal, indigo, rose, amber, violet, emerald, sky, orange)

### Notifications
- Global on/off
- Achievement alerts
- Weekly summary (Sunday)
- Territory attack alerts

### Sound & Haptics
- Sound effects toggle
- Haptic feedback toggle (light / medium / heavy)

### Run Settings
- Auto-pause on GPS loss
- GPS accuracy: standard (30m) / high
- Countdown timer: 0 / 3 / 5 seconds

### Mission Settings
- Daily missions on/off
- Difficulty: easy / mixed / hard
- Weekly goal (km)

### Privacy
- Public / Followers Only / Private

---

## Data & Sync

### Local Storage (IndexedDB)
Offline-first. All data cached locally, synced to Supabase when online.

Stores: `player` · `runs` · `territories` · `missions` · `settings` · `profile` · `savedRoutes` · `pendingActions`

### Sync Strategy
- **App launch:** Supabase → IndexedDB (pull latest)
- **After run:** IndexedDB write first (optimistic) → Supabase confirm async
- Unsynced runs flagged with `synced: false`

### Pending Actions Queue
Territory claims/fortifies queued when offline. Replayed automatically when reconnected (with GPS proof attached).

---

## Key Formulas

```
// Passive daily income
daily_coins = zones_owned × 5 × tier_multiplier × (1 + contiguity_bonus)
contiguity_bonus = min(adjacent_owned × 0.1, 1.0)

// Enemy claim time
enemy_claim_seconds = 45 + (defense_level × 1.2)
max = 300 seconds

// XP speed multiplier
multiplier = pace_mps > 3.5 ? 1.4 : 1.0

// Defense daily decay
new_defense = max(0, defense - (hours_idle × 10 / 24))
decay starts after 3 days idle

// Energy regen during run
regen = 10 energy per km run (real-time)
```

---

## Database Tables

| Table | Purpose |
|---|---|
| `profiles` | User stats, preferences, achievements |
| `runs` | Run records + GPS traces |
| `territories` | Owned zones, defense, tier, owner |
| `missions` | Daily missions + progress |
| `clubs` | Club data, members, ranking |
| `events` | Community events |
| `event_participants` | RSVPs |
| `leaderboard_weekly` | Auto-calculated weekly rankings |
| `notifications` | User alerts |
| `feed_posts` | Social activity posts |
| `followers` | Following relationships |
| `club_messages` | Club chat messages |
| `saved_routes` | Named saved routes |

---

## Numbers at a Glance

| Stat | Value |
|---|---|
| Total levels | 20 |
| Activity types | 17 |
| Territory tiers | 5 (1× – 5×) |
| Max energy | 100 |
| Energy per hour (passive) | 10 |
| Energy per km (during run) | 10 |
| Max defense | 100 |
| Speed bonus threshold | 3.5 m/s |
| Speed bonus multiplier | 1.4× |
| Neutral claim time | 15 seconds |
| Enemy base claim time | 45 seconds |
| Max siege time | 300 seconds |
| Daily coin per territory | 5 coins (base) |
| Max contiguity bonus | +100% |
| New player starting coins | 100 |
| New player starting diamonds | 5 |
| Premium tiers | 3 ($4.99 / $9.99 / $19.99) |
| Avatar color options | 8 |
| Reaction types | 4 |
| Personal records tracked | 6 |
| H3 resolution | 9 (~500m hex) |
