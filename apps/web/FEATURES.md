# Runivo Web App — Full Feature Reference

> Source-of-truth documentation. Covers every screen, interaction, copy, color, and animation pattern.
> Last reviewed: 2026-03-29

---

## Design System

### Colors
```
bg:       #F8F6F3   (beige background)
white:    #FFFFFF   (cards/surfaces)
stone:    #F0EDE8   (light stone — inputs, secondary bg)
mid:      #E8E4DF   (dividers, progress tracks)
border:   #DDD9D4   (card borders)
black:    #0A0A0A   (primary text, black buttons)
t2:       #6B6B6B   (secondary text)
t3:       #ADADAD   (tertiary/muted text)
red:      #D93518 / #E8391C   (primary action, territory owned)
redLo:    #FEF0EE   (red tint backgrounds)
green:    #1A6B40   (success, high defense)
greenLo:  #EDF7F2
amber:    #9E6800   (warning, carbs macro)
amberLo:  #FDF6E8
orange:   #F97316   (activity/energy burn)
blue:     #1445AA   (protein macro)
purple:   #7C3AED / #5A3A8A  (AI Coach tint)
purpleLo: #F2EEF9
```

### Typography
- **Playfair Display** italic — hero titles, screen headings (20–28px)
- **Barlow 300/400/500/600** — all body text, labels, values
- Inputs: `borderBottom: 0.5px solid #DDD9D4`, no box border, no radius
- Cards: `borderRadius: 14–20px`, `border: 0.5px solid #DDD9D4`, no shadows

### Animation Library
Framer Motion throughout:
- Card entrances: `spring(damping: 24, stiffness: 300)` + `opacity 0→1, y 8→0`
- Sheet open/close: `spring(damping: 28, stiffness: 240)` + `y: 300→0`
- Progress bars: `ease-out, 0.7–1.1s`
- Staggered lists: `0.06s delay per item`

### Navigation
5-tab bottom bar (mobile-first web app):
- **Home** (house icon) → `/`
- **Map** (map icon) → `/territory`
- **Record** (large red circle, play icon, center) → `/run`
- **Coach** (sparkles icon) → `/coach`
- **Profile** (person icon) → `/profile`

---

## 1. Welcome / Landing Screen

**Route:** `/welcome` (or root if not authenticated)

### Layout
- Background: `#F8F6F3` + grain texture overlay (4% opacity SVG noise)
- Floating hex accents: 3–4 hexagons, red `#D93518` at 22% opacity, animated bob (6–8.5s ease-in-out infinite)
- **Top bar:** "runivo" logo + "Sign in" link (top-right, 11px, gray)
- **Hero:** Large Playfair italic title "Claim your city." + tagline "Run · Capture · Conquer" (13px, letter-spacing 0.12em)
- **Phone mockup:** 136×256px black phone frame, hex grid demo with red captured territories inside
- **CTAs:**
  - "Create account" — black bg, white text, `borderRadius: 4px`, uppercase, 12px
  - "I already have an account" — outline style below

---

## 2. Onboarding Flow

**Route:** `/onboarding`
**File:** `src/features/onboarding/pages/OnboardingFlow.tsx`

6-step wizard with:
- **Progress bar:** 4 labeled chapter bars (Level / Body / Training / Setup), red fill, gray track
- **Slide transitions:** new step slides in from right (advance) or left (back), 240ms ease
- Back button (top-left, visible from step 2+)
- CTA always visible at bottom (red if can continue, gray if not)

### Step 1 — Credentials
- Heading: "Create your account" (Playfair italic, 26px)
- Fields (underline inputs):
  - Username (3+ chars, 11px label above: "USERNAME")
  - Email (regex validation)
  - Password (8+ chars, show/hide toggle with Eye icon)
- Error states: red border-bottom + red error text below field
- CTA: "Next →"

### Step 2 — Body Stats
- Heading: "Your body" (eyebrow 10px uppercase) + "Body stats." (hero title)
- Subtitle: "Used for accurate pace and calorie estimates."
- **Gender:** Two side-by-side cards (Male / Female)
  - Each card: animated SVG mascot (bounces when selected, cheek pulse animation)
  - Selected: `#FFF6F7` bg, red border 1.5px
  - Unselected: stone bg, gray border
- **Age drum picker:** always-visible vertical scroll wheel, 5-item window
  - Center band: 0.5px borders top/bottom, highlights selected item
  - Fade top/bottom overlays
  - Snap to 44px intervals
- **Height + Weight drums** (side by side):
  - Unit toggles: cm/ft · kg/lbs (segmented 8px buttons in `#ECEAE7` bg)
  - Same drum picker style

### Step 3 — Experience Level
- Heading: "How do you run?"
- 4 animated gradient cards with stagger entrance (60ms delay each):

  | Option | Icon | Key |
  |--------|------|-----|
  | Just starting | Footprints | `new` |
  | Casual runner | PersonStanding | `casual` |
  | Regular runner | Zap | `regular` |
  | Competitive | Flame | `competitive` |

- **Selected:** red gradient (`#D93518 → #B82E10`), white text, white icon
- **Unselected:** white bg, `#F3F3F3` border, gray icon
- Tap scale: spring 1→0.97 on press, back to 1 on release

### Step 4 — Primary Goal
- Heading: "What's your main goal?"
- 5 cards, same animated gradient pattern:

  | Option | Icon | Key |
  |--------|------|-----|
  | Get fit | Heart | `get_fit` |
  | Lose weight | Flame | `lose_weight` |
  | Run faster | Zap | `run_faster` |
  | Explore | Compass | `explore` |
  | Compete | Swords | `compete` |

### Step 5 — Weekly Plan
- Heading: "Weekly plan"
- **Day tiles:** 7 side-by-side tiles (Mon–Sun)
  - Selected: red gradient, white letter + gray suffix
  - Today: red letter, gray suffix, plain bg
  - Unselected: stone bg, gray text
  - Spring bounce on toggle
- **Distance chips:** 4-column row

  | Label | km | Key |
  |-------|-----|-----|
  | < 3 km | 2.5 | `short` |
  | 5 km | 5 | `5k` |
  | 10 km | 10 | `10k` |
  | 15+ km | 15 | `long` |

  - Selected: red gradient; Unselected: white, gray border
- **Summary card:** red-tinted bg (`rgba(217,53,24,0.08)`), re-animates when selection changes
  - "X runs/week · Y km/week" summary text

### Step 6 — Notifications
- Notification permission card with entrance animation (opacity 0→1, translateY 12→0)
- No inline Continue button — global CTA handles advancement

### Step 7 — Ready
- **Check circle:** animated spring scale 0.6→1, opacity 0→1 on mount
- Summary cards stagger in (80ms delay each): weekly km · primary goal · experience level
- CTA: "Start running →" (black bg)

### Login Screen
**Route:** `/login`
- Background watermark: 220×220px hex mark, 6% opacity
- Heading: "Welcome back." (Playfair italic, 26px)
- Fields: underline inputs (email + password)
- CTA: "Sign in →" (black bg)
- Error: red text below inputs
- Rate limit: "Too many attempts. Please wait 60s."

---

## 3. Dashboard (Home)

**Route:** `/`
**File:** `src/features/dashboard/pages/Dashboard.tsx`

Full-screen scrollable, `#F8F6F3` bg, `paddingBottom: 100px` for nav.

### Header
- **Left:** "GOOD MORNING" (10px uppercase, `#ADADAD`) + username (Playfair italic, 26px)
- **Right:** Notification bell pill (34px height, white bg, 0.5px border) + avatar with XP ring
  - XP ring: SVG circle, red stroke, animates from 0 to `xpProgress%` on mount (1.1s ease-out, 0.3s delay)
  - Avatar: 40×40px circle, black bg, white initials

### Currency Pills (below header)
Horizontal scrollable row, `gap: 6`, `paddingHorizontal: 22`:
- **XP pill** — shows total XP + level title e.g. "2,450 XP · Ranger"
- **Energy pill** — Zap icon (red), `X/10` value, "energy" label — hidden when energy ≥ 5
- **Streak pill** — Flame icon (red), day count, "day streak" label — hidden if 0
- Pill style: 34px height, 20px borderRadius, 0.5px border

### Login Bonus Toast (if first login today)
- Slides down from top (y: -56 → 0)
- "🎉 Daily bonus · +X coins"
- Auto-dismisses 4s

### Bento Grid (Main Cards Section)

#### Left Column — Hero Carousel (larger card, black bg)
Two slides, dot indicators at bottom (5px → 16px active):

**Slide 0: Weekly Goal**
- Label: "WEEKLY GOAL" (10px, white 35% opacity)
- SVG donut chart (100×100px):
  - Bg ring: `rgba(255,255,255,0.12)`
  - Progress ring: red, animated `strokeDasharray` 1s ease, 0.2s delay
- Center: km value (20px) + "km" unit (8px)
- Below: "X% of Y km" (11px, white 65% opacity)
- Calendar bar: 7 mini bars, red for run days, dim for rest

**Slide 1: Calorie Tracker CTA**
- Full-card button → navigates to `/calories`
- Flame icon: 52×52px circle (orange bg 15%, orange border 30%)
- "Track your cal" (16px, 500 weight) + goal (10px lighter)
- "Tap to open →" (9px, 28% opacity)

#### Right Column — 3 Tall Cards
Stack of 3 equal-height cards, stone bg, each:
- 32×32 icon box (white bg, red icon 14px)
- Label (13px bold)
- Cards: **Events** · **Clubs** · **Leaderboard** → navigate to respective routes

#### Start Run Card (full width, below bento)
- Black bg, `borderRadius: 16`, `padding: 14×16`
- Left: red circle (40×40) with Play icon inside
- "TAP TO BEGIN" (9px uppercase, white 35%) + "Start run" (17px bold, white)
- Right: "1 energy" pill (10px, semi-transparent)
- Navigates to `/run` + haptic medium

### Empire Section
- Header: "EMPIRE" (11px, uppercase, `#ADADAD`) + "View map →" link
- **2×2 stats grid:**
  - Zones owned · Avg defense % · Daily income · Weak zones (red text if > 0)
- **Weak zone alert** (if weak zones exist):
  - Amber bg `#FDF6E8`, amber border, 3×28px red left accent bar
  - "X zones need defending" (12px bold) + "Tap to reinforce →" (10px amber)

### Missions Section
- Header: "MISSIONS" + "Change →" link
- **Black card** (borderRadius: 20, padding: 18×20)
- Label: "TODAY'S CHALLENGE" (10px, white 35%)
- Mission rows (max 3 shown):
  - Icon box (32×32, 9px radius) + title (13px) + 2px progress bar
  - XP value right: "+X XP"
  - Completed: green check, strikethrough title, "Claimed" badge
- No missions: serif italic "No missions set yet." + plus button

### Recent Runs Section
- Header: "RECENT RUNS" + "See all →" link
- **White card** (borderRadius: 20, border: 0.5px gray)
- Rows (last 3 runs ≥ 500m):
  - Activity type (10px uppercase) + date label ("Today", "Yesterday", "3 days ago")
  - Distance + duration (right)
  - Dividers between rows
- Empty: "No runs yet" + "Start running →"

---

## 4. Feed (Social)

**Route:** `/feed`
**File:** `src/features/social/pages/Feed.tsx`

### Tabs
- **Discover** · **Following**
- Underline indicator, red active

### Discover Tab
- **Suggested Runners strip** (horizontal scroll carousel):
  - 48×48px circular avatars with gradient bg (deterministic per user)
  - First name below + total km
  - Blue ring if already following
  - Follow/check toggle (bottom-right corner of avatar)
- **Recent Runs grid** — runs from all users ordered by date

### Following Tab
- Loads from `get_feed` RPC (last 40 posts for followed users)
- Stories bar if active stories exist

### Activity Cards
Each run post is a full-width card:

**Card Header** (16×20px padding):
- 40×40px avatar (left) + username (13px, 500) + timestamp (11px gray)
- Activity type chip badge (right) — colored bg based on type

**Activity Title:**
- Large distance: "X.XX km" (28px, weight 300) + unit label
- Optional location with MapPin icon

**Route Map Hero** (if GPS route exists):
- 310×110 SVG viewBox with normalized route coordinates
- Procedural building silhouettes in background (12 buildings, seeded from post ID)
- Dotted path line + start/end markers
- Distance overlay bottom-left

**Badge Chips Row:**
- PR badge: amber bg, ⭐ star
- Zones badge: red bg, Navigation icon
- XP badge: green bg, Zap icon
- Streak badge: orange bg, Flame icon

**Stats Row** (3 columns, 1px gap separators):
- Distance · Time · Avg Pace
- Each: white bg, centered label + value

**Reaction Bar:**
- Long-tap (500ms) opens reaction picker: 👏 Kudos · 🔥 Fire · 👑 Crown · 💪 Muscle
- Kudos count with mini avatar stack
- Comment count icon

---

## 5. Territory Map

**Route:** `/territory`
**File:** `src/features/territory/pages/TerritoryMap.tsx`

### Map Canvas
- **MapLibre GL** with Carto positron style (default)
- Default center: [77.209, 28.613] (Delhi), zoom 14
- **User location:** red dot (14px) + white border + pulsing ring (scale 0.8→2.4, 2s infinite)
- **Territory polygons:** GeoJSON layer
  - Owned: `#E8391C` fill, 28% opacity
  - Enemy: `#DC2626` fill, darker
  - Neutral: `#ADADAD`, very faint

### Map Styles (5 options)

| Style | Preview Color | Source |
|-------|--------------|--------|
| Standard | `#E8F5E9` | Carto positron |
| Dark | `#263238` | Carto dark matter |
| Light | `#FAFAFA` | Carto voyager |
| Terrain | `#C8E6C9` | OpenTopoMap tiles |
| Satellite | `#1B5E20` | ArcGIS World Imagery |

### Header Bar (floating, top)
- White bg 92% opacity + backdrop blur 20px + 0.5px border + shadow
- Back button (30×30 circle, gray bg)
- "Territory" title (13px bold)
- Stats chips: red dot "X owned" · dark red dot "X enemy" · gray dot "X free"

### Filter Pill Row (below header, horizontal scroll)
All · Mine · Enemy · Weak · Free
- Active: black bg, white text
- Inactive: semi-transparent white, gray text

### Right Controls (40×40 circles, vertical stack)
1. **Recenter** — crosshair icon; flies to user position (zoom 15, 800ms)
2. **Map style picker** — Layers icon; opens style grid popover

### Style Picker Popover
- Spring animation entry (damping 24, stiffness 300)
- 3-column grid, 5 styles
- Each: 48×34px color swatch preview + 9px label
- Selected: 1.5px black border

### Territory Detail Sheet (bottom)
Triggered by tapping any polygon:
- **Backdrop:** 30% black opacity, dismisses sheet on tap
- **Sheet animation:** spring y: 300→0 (damping 28, stiffness 240)
- **Drag handle:** 32×3px gray bar

**Content:**
- Hex/polygon ID (monospace, 9px, faded, truncated)
- Territory title (Playfair italic, 20px):
  - "Your territory" / "[Name]'s zone" / "Unclaimed zone"
- Status badge (top-right):
  - "YOURS" red · "ENEMY" dark red · "NEUTRAL" gray
- **Defense bar:**
  - Label: "DEFENSE" (10px uppercase) + "XX/100" value
  - 3px height bar, animated fill (0.7s ease-out)
  - Color: >70 green · 30–70 amber · <30 red
- **Action button** (full width, black bg):
  - Enemy: ⚔️ "Attack territory" → `/run`
  - Owned: 🛡️ "Fortify — run to strengthen" → `/run`
  - Neutral: 🚩 "Claim this territory" (outline style) → `/run`

---

## 6. Record / Run Flow

### 6a. Pre-Run Setup Screen
**Route:** `/run`
**File:** `src/features/run/pages/RunScreen.tsx`

Full-screen map with a bottom sheet that snaps between collapsed (228px) and expanded (68vh).

**Map layer:** MapLibre GL with territory polygons visible. User marker = pulsing red dot.

**GPS Status Chip** (top, floating):
- "Locating..." (gray) → "GPS Strong" `#22C55E` (acc <20m) → "GPS OK" `#F59E0B` (20–50m) → "GPS Weak" `#EF4444` (>50m)
- Animated pulse dot while searching

**Territory Intel Chip** (top, floating):
- "X enemy · Y weak" territory count in the area

**Sheet — Activity Picker (vertical drum scroll):**

18 activity types:

| Activity | Icon | Color |
|----------|------|-------|
| Run | Activity | `#E8391C` red |
| Jog | Gauge | `#E8391C` red |
| Sprint | Zap | `#DC2626` dark red |
| Walk | Footprints | `#059669` green |
| Hike | Mountain | `#B45309` amber |
| Trail | TreePine | `#15803D` forest |
| Cycle | Bike | `#0284C7` blue |
| Intervals | Timer | `#7C3AED` purple |
| Tempo | TrendingUp | `#EA580C` orange |
| Fartlek | Shuffle | `#2563EB` blue |
| Race | Flame | `#E11D48` rose |
| XC | Route | `#4338CA` indigo |
| Stairs | TrendingUp | `#9333EA` purple |
| HIIT | Flame | `#DC2626` red |
| Strength | Dumbbell | `#4B5563` slate |
| Swim | Waves | `#0369A1` blue |
| Wheelchair | Accessibility | `#6D28D9` violet |
| Ski | Snowflake | `#0EA5E9` sky |

- Drum: snap-to-center, 5-item visible window, center item highlighted
- Colored icon + colored bg badge per type

**Route Options:**
- "Find Nearby Routes" button (loads 5km radius from Supabase)
- Saved route list if found

**Start Run Button:**
- Full width, black bg, "Start Run" (uppercase, white)
- Disabled while GPS is searching
- Haptic medium on tap

### 6b. Active Run HUD
**Route:** `/run/active`
**File:** `src/features/run/pages/ActiveRun.tsx`

Full-screen map with floating UI.

**Top Stats Bar:**
- Elapsed time (H:MM:SS) · Distance (km) · Pace (min/km)
- XP counter (animates on territory claim) · Territories claimed counter

**Map Elements:**
- Route line: red `#E8435A`, 4px width + glow layer (14px blur, 0.2 opacity)
- Direction arrow marker (rotates to heading)
- Ghost route (if selected): dashed gray line, 45% opacity
- Start dot: green `#10B981`, 10px, white border

**Territory Claim Events:**
- Real-time claim progress bar
- Flash animation on successful claim

**Bottom Controls:**
- Pause / Resume (large center button)
- Finish button → confirmation modal
- Cancel button

### 6c. Run Summary Screen
**Route:** `/run/summary`
**File:** `src/features/run/pages/RunSummary.tsx`

Scrollable results screen.

**Map Header:**
- 200px height map with complete route fitted (48px padding)
- Fade-out gradient at bottom
- Close button (top-right, white blur bg) → navigates home

**Title Block:**
- Activity label: "ATTACK RUN" / "TRAINING RUN" etc. (10px uppercase)
- Heading (Playfair italic, 28px):
  - "Territory Conquered" · "Territory Defended" · "Territory Fortified" · "Run Complete"
  - Red color if run failed
- Date: "Mon Mar 29" (10px gray)

**Primary Stats Grid** (3 columns, 1px separators):
- Distance (24px light) · Time (MM:SS) · Avg Pace (M:SS/km)

**Rewards Card** (black bg):
- "XP EARNED" label + "+X XP" (22px light, red)
- XP progress bar: animates from previous % to new % (1.4s ease, 0.5s delay)
- Level markers: "Lv X" · "XXX/YYY XP" · "Lv X+1"
- Level Up banner (if leveled up): red tinted, "🎉 Level Up! Lv X → Lv Y"
- Missions completed section (if any): checkmark rows with mission titles

**Splits Card** (if GPS points):
- Per-km pace bars, color-coded:
  - Green (below average) · Orange (average) · Red (slow)
- Shows avg, min, max paces

**Recovery Card** (if distance ≥ 1km):
- Flame icon (orange)
- "You burned ~X kcal"
- "Priority next 2hrs: 35-40g protein + 60-80g carbs"
- "+ LOG" button → navigates to Calorie Tracker with burn kcal pre-filled

**Shoe Chip:**
- Shows current shoe name + total km on that shoe
- Tap to change shoe (opens ShoeDrawer)

**Footer Actions:**
- Share (generates story card PNG, uploads to feed stories)
- Save Route (opens SaveRouteSheet to name and save the route)

---

## 7. Calorie Tracker

**Route:** `/calories`
**File:** `src/features/nutrition/pages/CalorieTracker.tsx`

### Header
- Back button (26×26 circle, stone bg)
- "Calorie Tracker" (13px bold) + date (10px gray)
- FAB: 32×32 red circle, "+" icon

### Tabs
"Today" (default) · "Insights"
- 11px bold uppercase, red underline when active

### Today Tab

**Hero Ring Card** (black bg, borderRadius 16):
- SVG ring (80×80px):
  - Animated `strokeDasharray` fill
  - Color changes: green (<80% of goal) → amber (80–100%) → orange (>100%)
  - Center: kcal value (18px) + "kcal" (8px gray)
- Stats column (flex 1):
  - Goal · Remaining · Burned — dividers: white 10%
- **AI context message** (if hook returns one):
  - `rgba(255,255,255,0.08)` bg, rounded 8px, 12px text
  - Examples:
    - "Great run today! Refuel with Xg carbs + 30-40g protein in the next 2 hours."
    - "Protein is low for the day — add a protein-rich snack before bed."
    - "You're on track for the day. Keep it up!"

**Run Activity Chip** (if calories burned from run today):
- Orange bg `#FEF0E6`, orange border
- Zap icon + "Run activity · +XXX kcal added"
- "Net: XXX kcal against YYY kcal goal"

**Macros Card** (white, borderRadius 12):
3 rows: Protein · Carbs · Fat
- Colored dot + label + animated bar + "Xg / Yg" (right-aligned)
- Colors: Protein = blue `#1445AA` · Carbs = amber `#9E6800` · Fat = green `#1A6B40`
- Optional coaching note below each row (italic, 10px):
  - "Post-run: aim for 30-40g protein to kickstart muscle repair."
  - "You ran X.Xkm — replenish with Xg carbs."
  - "Fat intake is a bit high — watch oils and dressings."

**4 Meal Sections** (Breakfast / Lunch / Dinner / Snacks):
Each card (white bg, borderRadius 12):
- **Header:** emoji + meal label (12px bold) + kcal count + chevron (rotates on expand) + plus button
- **Collapsed:** header only
- **Expanded:**
  - Food items list: name (11px bold) + serving + macro pills (P/C/F, 7px) + kcal (13px, right)
  - Delete button (18×18, right)
  - "Add more" row (plus icon, red text)
- **Empty state:** "Add your first item →" button

**Weekly Bar Chart:**
- 7 bars, `gap: 5px`, `height: 52px` container
- Bar height ∝ kcal/goal, min 4px
- Today = red, past days = gray, empty = dim
- Day label below (8px)
- "avg XXX kcal" subtitle header

### Insights Tab
- Header: Sparkles icon + "RUNIVO INTELLIGENCE" (10px uppercase, purple `#5A3A8A`)
- Insight cards: light purple bg `#F2EEF9`, border `rgba(90,58,138,0.15)`
  - Emoji icon + title (11px bold) + body (12px, 1.5 line-height)
- "Ask about nutrition →" button → navigates to `/coach`

### Add Food Modal
Full-screen overlay:
- Text search field + common foods list
- Serving size picker
- Nutrition facts display (kcal, protein, carbs, fat)
- "Add to [meal]" confirm button

---

## 8. Leaderboard

**Route:** `/leaderboard`
**File:** `src/features/leaderboard/pages/Leaderboard.tsx`

### Header
- "Leaderboard" (Playfair italic, 20px)
- "Top 50 players this week" (10px, 300 weight, gray)

### Metric Tabs (3)
Distance (TrendingUp) · Zones (Navigation) · XP (Zap)
- Active: red text + light red tinted bg pill
- Inactive: gray text, transparent

### Time Frame Selector
"This Week" · "This Month" · "All Time"
- Active: red text, uppercase 9px; Inactive: gray

### Podium (Top 3)
Asymmetric heights — 2nd (40px) · 1st (58px) · 3rd (28px):
- Avatar circle: 40px (1st), 34px (2nd), 30px (3rd)
- Name below (9px, truncated)
- Score value (10px, 500 weight, red for 1st)
- Trophy icon above 1st only (amber)
- Podium block colors: 1st black · 2nd light gray · 3rd stone

### Current Player Card (if rank > 3)
- Light red bg `rgba(217,53,24,0.2)`, red border 0.5px
- Row: rank | avatar (28px, black bg) | name + "YOU" badge | score

### Rankings List (4th+)
Rows: rank (20px, gray) | avatar (26px, stone bg) | name (12px) | "Lv. X" badge | score (13px, right)

---

## 9. Events

**Route:** `/events`
**File:** `src/features/events/pages/Events.tsx`

### Header
- "Events" (Playfair italic, 20px)
- Subtitle: "Races, meetups & challenges near you" (10px, 300 weight)

### Tabs
Upcoming (default) · Challenges · Past
- Segmented control: gray bg, active = white bg + 0.5px border

### Event List Cards
Each card (white bg, 16×18px padding, 0.5px gray bottom border):
- Category label (9px uppercase, gray) + bookmark icon
- "Joined" badge (green bg, 9px) if registered
- Distance pill (red bg, 9px) if applicable
- **Title** (15px, 500)
- Meta row (10px, 300, gray): Calendar + date · MapPin + location · Users + "X going"

### FAB (+ button)
- Fixed bottom-right, 40×40 red circle, shadow `rgba(217,53,24,0.30)`
- → `/events/create` (premium) or `/subscription`

### Event Detail Bottom Sheet
Triggered by tap on card:
- Spring from bottom (88vh max), drag handle (36×4px)
- Category + distance chips
- Title (22px Playfair italic) + Close button (28px circle)
- Description (13px, 300, 1.7 line-height)
- Detail rows (white container, 16px rounded):
  - Calendar / Clock / MapPin / Users — icon in 30×30 stone box + label (9px uppercase) + value (13px)
- Organizer: avatar + "Organizer" label + name
- **Footer (pinned):**
  - Share (48×48, white) + Bookmark (toggles red bg) + Join/Leave (flex 1, black → green when joined)

### Event Types
- **Challenges:** King of Hill · Survival · Brand challenges · Custom
- **Races:** Timed distance goals
- **Meetups:** Social group runs

---

## 10. Clubs

**Route:** `/club`
**File:** `src/features/club/pages/Club.tsx`

### Tabs
My Clubs · Rankings

### My Clubs Tab
Club list cards (white bg, 16×18px padding):
- Badge emoji (large) + name (15px, 500) + member count
- 2-col stats: territories, weekly runs, streak, daily income
- Description (12px, 300, 2-line clamp)
- Buttons row: "Chat" (black bg) · "Members" (outlined) · ⋮ menu

### Rankings Tab
**Scope selector:** Local · National · International (segmented)

Ranked list:
- #1/#2/#3 podium (same visual as Leaderboard)
- Below: rank badge + emoji + club name + member count + total km + Join button

### Club Detail Sheet
- Club name (18px) + badge emoji + level + rank
- Stats 2×2 grid: Members / Territories / Weekly runs / Streak
- Tabs: Chat, Members

### Club Chat
- Message bubbles: left = others, right = self
- Timestamp per bubble
- Activity messages (joins, level-ups, territory captures) styled differently
- Text input + Send button pinned to bottom

### Create Club Modal
- Club name (required) · Description · Badge emoji picker · Join policy (Open / Request / Invite-only)
- "Create club" (black bg) + Cancel

---

## 11. AI Coach

**Route:** `/coach`
**File:** `src/features/intelligence/pages/CoachScreen.tsx`

### Layout
Beige bg `#F8F6F3`, full-screen chat interface.

### Training Plan Accordion (top, collapsible)
- Header: Flame icon (red) + "Training Plan — [goal]" (13px bold) + chevron
- White bg, 0.5px bottom border
- **Collapsed:** header row only
- **Expanded:**
  - No plan yet: text input "e.g. Run a 5K in under 30 minutes" + "Generate" button (black bg)
  - Plan generated: week cards (beige bg, borderRadius 8)
    - "Week X — [summary]" heading (12px bold)
    - Day rows: "Day: workout description" (11px, 1.6 line-height, gray)

### Chat Area
Scrollable message list:

**AI messages (left-aligned):**
- AI avatar: 32×32px, borderRadius 8, purple tint bg (`#F2EEF9`), Sparkles icon (purple `#7C3AED`)
- Bubble: white bg, 0.5px border, `borderRadius: 4px 14px 14px 14px`
- Text: 13px, 1.55 line-height, black

**User messages (right-aligned):**
- Bubble: black bg, white text, `borderRadius: 14px 4px 14px 14px`

**Typing indicator:**
- AI avatar + 3 bouncing dots (opacity/y animated, staggered 0.2s each)

### Empty State (first open)
4 quick prompt chips (white bg, 0.5px border, borderRadius 20px):
1. "How can I improve my pace?"
2. "Build me a 5K training plan"
3. "How should I warm up before a run?"
4. "Tips for running in the heat?"

### Input Bar (bottom, pinned)
- Text input (flex 1, stone bg, borderRadius 8, 0.5px border)
- Send button: red circle, Send icon (white)

---

## 12. Profile

**Route:** `/profile`
**File:** `src/features/profile/pages/Profile.tsx`

### 4 Tabs
Overview · Stats · Awards · Nutrition

### Profile Header (all tabs)
- **Avatar:** 64×64 circle, color swatch bg, white initials (or uploaded photo)
  - Camera overlay → file upload (jpg/png/webp/gif)
  - Swatch colors: `#0A0A0A · #E8435A · #3B82F6 · #10B981 · #F59E0B · #8B5CF6`
- **XP Ring:** SVG arc around avatar (r=34, circumference 213.6px)
  - Red stroke, animates 0 → xpProgress% (1s spring, 0.3s delay)
- Name (22px) · Username/bio (12px gray, 2-line clamp)
- Location + social links (11px gray): MapPin · Instagram · Strava
- "Edit profile" button → opens edit sheet
- Follow / Message button (other user's profile)

### Edit Profile Sheet
- Display name · Bio (textarea) · Location
- Strava link · Instagram link
- Avatar color swatch picker (6 colors)
- Privacy toggle (public/private)
- Save button

### Overview Tab
**2×2 Stats Grid** (white cards, borderRadius 14, 0.5px border):
- Total Runs (Play icon) · Total Distance km (Navigation) · Total Time hh:mm · Territories (MapPin)

**Weekly Goal Card:**
- "WEEKLY GOAL" label + 3px red distance bar + "X km / Y km"
- 7 mini calendar bars

**AI Weekly Brief Card:**
- Purple tint bg `#F2EEF9`, Sparkles + "WEEKLY BRIEF" (10px, purple)
- Brief text (13px, 1.55 line-height) + Refresh button
- "Ask Coach →" link → `/coach`

**Recent Runs Section:** last 5 runs + "See all runs →"

**Gear / Shoes Section:** active shoes with km progress bars

### Stats Tab
**Personal Records:**
- Amber bg `#FDF6E8`, amber border
- Best 1km · 5km · 10km · longest run · fastest pace
- Record value (20px bold, amber) + date

**Weekly Activity Chart:** 7 bars (same as calorie tracker)

**Race Predictions:** 5K / 10K / Half Marathon / Marathon estimated finish times

**AI Coach Insights** (purple tint cards): training load, recovery, pace trends

### Awards Tab
All achievements in a grid:
- **Unlocked:** full color icon + name (11px bold) + subtitle (9px gray)
- **Locked:** gray/dim, shake animation on tap
- Categories: Distance milestones · Streak achievements · Territory conquest · Social

### Nutrition Tab
- Logging streak · Average daily kcal · Total entries · Goal adherence %
- Weekly macro chart: 7-day bars, stacked Protein (blue) / Carbs (amber) / Fat (green)

---

## 13. Notifications

**Route:** `/notifications`
**File:** `src/features/notifications/pages/Notifications.tsx`

### Bell Icon (in Dashboard header)
- 34×34 circle, white bg, 0.5px border
- Unread badge: red bg, white text, animated scale-in, "9+" if > 9

### Notification Dropdown (bell tap)
- Spring entry (damping 28, stiffness 320), width 320px
- Header: "Notifications" + unread count + "Mark all read" (red text)
- List max 288px, overflow-y auto
- "See all notifications" footer

### Notification Rows
- 28×28 avatar + content (flex) + dismiss ×

| Type | Color | Icon |
|------|-------|------|
| kudos | green | ThumbsUp |
| comment | blue | MessageSquare |
| territory_claimed | red | Flag |
| zone_attacked | orange | Swords |
| club_invite | purple | Users |
| achievement | amber | Star |
| follow | gray | UserPlus |
| event_reminder | blue | Calendar |
| mission_complete | green | Check |
| level_up | red | ArrowUp |

### Full Notifications Page
- All notifications in same row format
- Mark all read on page open
- Empty state: bell icon + "All caught up"

---

## 14. Settings

**Route:** `/settings`
**File:** `src/features/settings/pages/Settings.tsx`

### Sections

**Account** — Profile link, change password

**Devices** — Apple Health · Garmin · COROS · Polar (connect/disconnect, last synced timestamp)

**Appearance** — Distance unit (km/mi), map style preference

**Notifications** — Run reminders · Territory alerts · Social activity · Mission updates (all toggles)

**Sound & Haptics** — Sound toggle, volume slider, haptic feedback toggle

**Run Settings**
- GPS accuracy preference
- Auto-pause toggle
- **Beat Pacer:**
  - Enabled toggle
  - Pace selector (3:30–7:00 min/km, shows BPM: 185–155)
  - Sound: click · beep · metronome

**Missions** — Auto-generate toggle, difficulty (easy/mixed/hard)

**Data & Privacy** — Export data, privacy toggle, Delete account (danger)

**Support** — Help center, report bug, app version

**Footer:**
- Gradient "Upgrade to Pro" CTA (red gradient)
- "Log Out" (red text, destructive)

---

## Route Summary

| Route | Screen |
|-------|--------|
| `/` | Dashboard |
| `/feed` | Social Feed |
| `/territory` | Territory Map |
| `/run` | Pre-run Setup |
| `/run/active` | Live Run HUD |
| `/run/summary` | Run Summary |
| `/calories` | Calorie Tracker |
| `/leaderboard` | Leaderboard |
| `/events` | Events |
| `/club` | Clubs |
| `/coach` | AI Coach |
| `/profile` | Profile |
| `/notifications` | Notifications |
| `/settings` | Settings |
| `/gear` | Shoe Tracker |
| `/onboarding` | Onboarding Wizard |
| `/login` | Login |
| `/welcome` | Landing |
