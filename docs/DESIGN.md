# Runivo Design System — "Editorial Athletics"

> **What this is:** the design direction + execution plan to take Runivo's mobile UI from
> "good bones, inconsistent execution" to top-class premium. Derived from a full design
> audit of all 39 screens / 190 components (2026-07-06). Every number below is measured,
> not estimated.

---

## 1. The verdict on what exists today

**Runivo already has a distinctive identity — don't replace it, enforce it.**

The core language is genuinely differentiated from every competitor:

| | Strava | Nike Run Club | **Runivo today** |
|---|---|---|---|
| Canvas | clinical white | pitch black | **warm paper** `#F8F6F3` |
| Accent | orange `#FC5200` | volt yellow | **vermilion** `#D93518` |
| Type voice | Inter-ish neutral | huge condensed | **Barlow + Playfair italic** (editorial) |
| Texture | cards + shadows | full-bleed photo | **hairline borders (0.5px), ink-on-paper** |

That "running magazine" feel — warm paper, ink text, hairline rules, italic serif accents,
a burnt vermilion that reads more literary than sporty — is a real brand. It is
Strava-*inspired* in energy (one hot accent color doing all the work) without copying
Strava's palette. Keep it. Sharpen it.

**Why it doesn't feel premium yet — measured:**

1. **The system font leaks everywhere.** 989 raw `fontSize` literals; the `Fonts` theme
   token is imported by **zero** files. Half the text on any screen sets only
   `fontWeight`, which silently renders San Francisco next to Barlow. Mixed typefaces on
   one surface is the single fastest way to read "unfinished." This is the #1 fix.
2. **Micro-type epidemic.** 232 text sites below 11px (19× 8px, 91× 9px, 121× 10px).
   Illegible mid-run and cheap-feeling everywhere else.
3. **The eyebrow/overline is hand-rolled 74 times** with 11 different letterSpacing
   values (0.5 → 2.5) and sizes 8–11px. It's the app's signature typographic move and
   it's never the same twice.
4. **984 hardcoded color literals across 124 files**, including a parallel off-palette
   Tailwind set that drifted in (`#7C3AED`, `#F59E0B`, `#EF4444`, `#0284C7`, …16+ alien
   colors). Also 15+ ad-hoc `rgba(255,255,255,α)` alpha values.
5. **The component library is dead.** `PrimaryButton` imported once; `SectionHeader`,
   `CardContainer`, `PACEPill`, `TierBadge`, `BottomSheet`: **zero** imports. Result:
   ~62 hand-rolled red buttons + 52 dark buttons with radii 8–36 and heights 40–72.
6. **No shared scales:** 30+ borderRadius values, ~12 ad-hoc shadow recipes (iOS shadows
   not synced to Android elevation), screen gutter split between 16/20/14/18/24.
7. **Dark mode accent was muddy** — the same `#D93518` on `#0D0D0D` loses all its energy
   (fixed: dark mode now uses `#FF5326`).

---

## 2. Design language — the rules

### 2.1 Palette (Strava-inspired energy, Runivo's own hues)

Light mode (primary experience — "paper"):

| Role | Token | Value | Notes |
|---|---|---|---|
| Canvas | `bg` | `#F8F6F3` | warm paper, never pure white |
| Card | `white` / `surface` | `#FFFFFF` / `#F0EDE8` | white cards on paper, hairline border |
| Ink | `t1` | `#0A0A0A` | text + "ink" fills that invert in dark |
| Accent | `red`/`accent` | `#D93518` | THE hot color. CTAs, live states, streaks |
| Fixed-dark card | `alwaysDark` | `#0A0A0A` | bold hero cards, same in both themes |
| Success | `green` | `#1A6B40` | money/positive only |

Dark mode: same structure, hotter accent `#FF5326` (vermilion loses energy on black),
warm-tinted darks (`#1A1816`, not neutral gray).

**Rules**
- One accent per screen region. Red is for *the* action and *live* status — never
  decoration. If everything is red, nothing is.
- **Kill the off-palette drift**: `#7C3AED`, `#F59E0B`, `#EF4444`, `#0284C7` etc. map to
  `purple`, `amber`, `red`, or get deleted. No new hex literals in feature code — if a
  color isn't in `colors.ts`, it doesn't exist.
- White-on-dark overlay alphas come from a 4-step ladder: **0.08 / 0.35 / 0.55 / 0.9**
  (hairline / disabled / secondary / primary). Not 15 ad-hoc values.

### 2.2 Typography (`Type` scale in `src/theme/typography.ts` — built)

Two voices, strict separation:
- **Barlow** — everything functional: metrics, body, labels, buttons.
- **Playfair Display Italic** — editorial moments only: greeting, hero headlines,
  celebration copy. Never data, never chrome. It's the brand's handwriting; overuse
  cheapens it.

| Style | Spec | Use |
|---|---|---|
| `display` / `displaySm` | Playfair 32/22 | hero + celebration headlines |
| `metricXL` | Barlow Light 72, tabular | the run distance |
| `metricLg` / `metricMd` / `metricSm` | Light 44/28, SemiBold 16, tabular | stats everywhere |
| `title` / `headline` | SemiBold 20/16 | card titles, rows |
| `body` / `bodySm` | Regular 15/13 | copy |
| `label` / `labelSm` | Medium 13/11 | buttons-in-rows, meta |
| `button` | SemiBold 15, +0.2 | PrimaryButton |
| `overline` | Medium 10, +1.2, uppercase | THE eyebrow. One spec, everywhere |
| `caption` | Regular 11 | timestamps, footnotes |

**Rules**
- Every `<Text>` composes a `Type.*` style + a color. No raw font strings, no bare
  `fontWeight` (SF leak), no local `FONT_SEMI`/`FS`/`FL` constants.
- **10px floor**, and 10 only for the tracked-uppercase overline. Count badges may go to
  9px as the single exception.
- Live-updating numbers always use `metric*` (tabular-nums → no digit jitter in timers).

### 2.3 Shape, space, depth

- **Screen gutter: 20** (`Spacing.gutter`) — one value, every screen.
- **Radius scale**: 8 (chips) / 12 (inputs, small cards) / 14 (buttons) / 20 (hero
  cards) / 999 (pills). Nothing else.
- **Depth = borders, not shadows.** Hairline 0.5 borders are the brand's texture.
  Shadows only for floating elements (tab bar run button, toasts, sheets) — one recipe:
  `shadowOpacity 0.12, radius 16, offset {0,4}` + matching Android `elevation: 8`.
- Fixed-dark cards (`alwaysDark`) pair with `alwaysLight`/white-alpha text only.

### 2.4 Interaction feel

- Every tappable gives feedback: pressed = `opacity 0.85` + `scale 0.98` (built into
  `PrimaryButton`), plus the existing `feedback`/haptics layer.
- Motion uses the existing `Spring.snappy/gentle` tokens; 200–300ms; count-ups for
  earned numbers (PACE, TS) — already good, keep.
- Hit targets ≥ 44pt even when the glyph is small (`hitSlop`).

---

## 3. Execution plan

### Phase 1 — Foundation (DONE this pass)
- [x] Semantic `Type` scale + tabular numerals (`typography.ts`), exported from `@theme`.
- [x] Dark-mode accent fix: `red`/`accent`/`danger` → `#FF5326` in `DarkColors`.
- [x] `Spacing.gutter` token.
- [x] `PrimaryButton` rebuilt: 5 variants (accent/dark/surface/ghost/danger), pressed
      states, Barlow via `Type.button` (was system-font), radius 14.
- [x] `SectionHeader` rebuilt on `Type.overline` with optional icon + action.
- [x] Dashboard + `CustomTabBar` + dashboard components moved onto the system
      (SF-leak kill, micro-type bumps, `SectionHeader` adoption).

### Phase 2 — The sweep (DONE — ~134 files converted; see "Phase 2 leftovers" below)
Order by user exposure. For each file: raw font strings/local consts → `Type.*`;
hex literals → tokens; sub-11px → nearest scale step; overlines → `Type.overline` or
`SectionHeader`; hand-rolled CTAs → `PrimaryButton`; radii → scale.
1. Run flow: `RunScreen`, `ActiveRunScreen`, `RunSummaryScreen` + run components
2. Profile: `ProfileHeader`, tabs, `ProfileScreen`
3. Leaderboard, History, Territory map UI chrome
4. PACE Store, Missions, Notifications, Settings
5. Feed/social, Clubs/Events (flagged off, lowest priority) — incl. the worst offenders:
   `ClubScreen` (41 literals), `AddFoodModal` (36), `NutritionSetupForm` (27),
   `ShoeCard` (23), `RunReplayScreen` (22)
6. Delete the off-palette Tailwind colors (map to tokens or add ONE `purple` treatment)

### Phase 2 leftovers (found during the sweep — real design decisions, not mechanical)
- **Static-sheet surfaces that ignore dark mode** (need mkStyles(C) conversion): the
  coach chat UI (CoachFloatingInput/CoachMessageCard/MessageBubble/QuickPrompts/
  TrainingPlanAccordion/CoachSidebar), nutrition forms (AddFoodModal,
  NutritionSetupForm, pickers), ChatBubble/ChatInput, EventForm/CreateEventScreen,
  ShoeCard, FootScanScreen (module-scope `Colors`), StatsTab (orphaned — likely delete),
  PlanCard, ErrorBoundary, FeedPostCard's RouteMapHero.
- **Pre-existing contrast bugs surfaced**: ConnectedDevicesScreen + FootScanScreen use
  the `mid` BACKGROUND token as TEXT color (invisible in dark mode); RunSetupSheet's
  white check on inverting `C.black`; ClubScreen header "+" white-on-paper;
  PostRunInsightsCard white card + inverting ink text.
- **Palette decisions pending**: macro-chart series colors (3 slightly-different
  blue/amber/green sets → should become tokens); avatar SWATCHES data palette (has 2
  off-palette hexes but values are persisted user data); activity-type color maps
  (module consts, deliberate multi-hue); blue has no token (used in ~6 places).
- Dead components (RunCTACard, DailyBonusCard, DashboardPills, TerritoryScoreBlock,
  LevelUpOverlay) were left unconverted — delete or revive, don't restyle.

### Phase 3 — Hero-moment polish (design work, not cleanup)
1. **Run summary as celebration**: full-bleed route map header, `metricXL` distance,
   PACE count-up with confetti restraint, rank-up sheet. This screen is the shareable
   artifact — it sells the app.
2. **Story-card generator** restyle to match (paper/ink/vermilion, Playfair headline).
3. **Dashboard hero**: tighten BentoCard grid rhythm, consistent 20-gutter alignment.
4. **Active run HUD**: already fixed legibility; add pause-state color shift.
5. **Empty states**: every list gets the `firstRunCard` treatment (Playfair headline +
   one-line body + single CTA) — currently only Dashboard has it.

### Phase 4 — Motion & delight
- Screen-level transitions (fade-through on tab switch).
- Territory claim: map polygon fill animation on capture (pairs with live ClaimToast).
- Streak flame micro-animation on Dashboard when streak > 0.

### Guardrails (unchanged from repo conventions)
- Styles: `const ss = useMemo(() => mkStyles(C), [C])` + module-scope `mkStyles`.
- Onboarding keeps its intentional fixed-light palette (documented in
  `onboardingStyles.ts`) — restyle it in Phase 3 only if it graduates to `useTheme`.
- No new npm deps; no `console.log`; no `any`.

### Definition of done (measurable)
- `grep -r "fontFamily: 'Barlow" src --include="*.tsx"` → 0 (outside theme/).
- `grep -rE "fontSize: (6|7|8|9|10)\b" src --include="*.tsx"` → overlines/badges only.
- Off-palette hexes (`#7C3AED|#F59E0B|#EF4444|#0284C7|#059669|#D97706|#EA580C`) → 0.
- `PrimaryButton`/`SectionHeader` imported ≥ 20 files each.
- Screen-level `paddingHorizontal` ≠ `Spacing.gutter` → 0 new instances.
