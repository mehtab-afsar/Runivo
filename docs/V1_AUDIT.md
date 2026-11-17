# V1 audit: PACE, territory and map colours

November 2026. This covers what was wrong, what changed, and how each fix is tested.

## The rules

All rules live in one file, `packages/shared/src/engine/runEngine.ts` (`ENGINE`). `packages/shared/src/services/config.ts` holds only app-only settings (live GPS gate, legacy coins) and must never copy a rule. The server runs a byte-for-byte copy at `supabase/functions/_shared/runEngine.ts`; `runEngine.sync.test.ts` fails if the two differ. After editing the engine, run `npm run engine:sync`.

| Rule | Value |
|---|---|
| Distance PACE | 2 per whole verified km (0.99 km pays 0). Was 1 at the audit; raised to 2 later, engine tests updated |
| New zone | +5, once per run, runs of 200 m or more |
| Stolen zone | +10 per rival zone where ground actually moved |
| Streak bonus | +3 on the run that takes the streak to 7, 14, 21… days |
| Weekly cap | 100 free, 150 premium/admin, week starts Monday 00:00 UTC |
| Meaningful run | at least 50 m and 60 s |
| Territory | runs only, at least 200 m of route |
| Strip | 12 m either side of the route (24 m wide), counted once where the route repeats |
| Loop | back within 100 m of an earlier point with at least 300 m of route in between; claims the inside plus the strip, up to 500,000 m² inside |
| Tiers | patch < 5k, block < 50k, district < 200k, quarter < 500k, domain ≥ 500k m² |
| Freshness | −10 a day, floored; stale below 40; fresh zones need >30 % overlap to steal |
| Free zone limit | 10 zones |
| Speed | segments faster than 7.5 m/s are dropped; distance is capped at duration × 7.5 m/s |

Worked examples (from the tests):

| Run | PACE |
|---|---|
| 5.0 km, no zones, free, 0 earned this week | 10 |
| 7.3 km, 1 new zone, 1 steal, streak hits 14 | 14 + 5 + 10 + 3 = 32 |
| 20 km, free, 90 already earned this week | 10 (capped at 100) |
| Same run, premium | 40 |
| 150 m with a zone | 0 (zones need 200 m, distance needs 1 km) |
| Same run replayed | 0 (ledger key is the run id) |

## PACE: what could be cashed out that shouldn't have been

| Severity | Problem | Fix |
|---|---|---|
| Critical | `pace_weekly_reset_at` was client-writable, so a runner could reset their own weekly cap | Locked in `protect_profile_columns`; the app no longer sends it |
| Critical | Replaying a run, or sending a made-up trace, paid again | `run_processing` claims each run once; the run must exist and belong to the caller; distance comes from the trace with teleports dropped and a speed ceiling |
| High | Two runs syncing at once could both pass the cap | `credit_pace_capped` locks the profile row and applies the cap inside the database |
| High | Mission rewards were reverted by the column-protection trigger, and missions could be claimed again under a new id | Missions credit through the ledger with key `user:mission:date` |
| Medium | Streak bonus paid on every run of a 7th day | Only the run that moves the streak pays it |
| Medium | Rank was client-writable | Set by the ledger from lifetime PACE |
| Medium | Zone PACE ignored the 200 m rule | Enforced in the engine |
| Medium | Premium cap differed between screens | One `weeklyCapFor` everywhere; the app reads the real subscription tier |
| Low | Minimum duration 60 s on the server, 30 s in the app | 60 s in both |
| Low | Store redemption ignored expiry and stock | `redeem_reward` checks both and decrements stock |

The app still shows PACE straight after a run. After sync it applies the server's number once, and the run keeps that number, so retries change nothing.

## Territory: was the claimed area right?

No. On a 200 m square loop the server stored only the corridor, about 46 % of the area the app showed.

| Problem | Fix |
|---|---|
| Server stored the corridor, not the loop | PostGIS `build_territory_geom` builds strip + loop |
| Convex hull over-claimed (a lollipop claimed ~110k m² for a ~62k m² route) | Loop is the route's own ring, not a hull |
| Loops only detected when start ≈ end | Any return within 100 m of an earlier point after ≥ 300 m |
| Server corridors self-crossed on hairpins | PostGIS buffer, always valid |
| The app's optimistic zone stayed after the server's arrived, double counting | Removed once the server's zone for that run arrives |
| Leaderboard scores never decayed | Floor decay in `get_territory_score`, nightly refresh |
| Rounding differed between server and app | Both floor |
| Kalman smoothing shrank routes depending on GPS spacing | Not used for area or distance (trail drawing only) |
| Wrong metres-per-degree constant | WGS84 series by latitude |
| Steals could count when nothing moved | Only counted when the returned area is above 0 |
| Claim kept only the largest piece of free land | Every piece ≥ 100 m² is kept |
| Live HUD showed corridor area | Uses the same shape rules as the finished run |

Measured by PostGIS in the tests: 200 m square loop 50,099 m² (district); 600 m out-and-back 14,859 m². The app's estimate is within 4 % and 5 %.

Defending a zone still restores it to 100 % freshness. That is deliberate.

## Map colours

Before: three different reds for your zones, two greys for rivals, stale rivals looked like fresh ones, selecting a rival zone painted it your colour, maps ignored dark mode, and friends' markers were close to your trail red.

Now, from `apps/mobile/src/theme/territory.ts` (colours updated in the November redesign; the rules stayed: one palette, mine / rival / fading always distinct, dark-mode variants):

| Thing | Light | Dark |
|---|---|---|
| Your zones | #7DBA3C, fill by freshness | #9BD25A |
| Your fading zones | #A9C77A, dashed outline | #6F8F4A |
| Rival zones | #F2A43A, fill 10–26 % | #F2A43A |
| Fading rival zones | #CDB089, thin outline | #8A7556 |
| Selected | outline only, #17181A | #FFFFFF |
| New capture (24 h) | white halo | white halo |
| Your trail | ink #17181A | lime #C9F06B |
| Friends | their own palette, never green or amber (by user id) | same |

## Tests

| Suite | What | Run |
|---|---|---|
| `packages/shared/src/engine/runEngine.test.ts` | Engine rules: area at several latitudes, loops, lollipops, figure-8s, teleports, PACE table, caps, streak, ranks, decay | `npx vitest run` |
| `packages/shared/src/services/claimEngine.test.ts` | The app gives the same answers the server pays | `npx vitest run` |
| `supabase/tests/v1_integrity.test.sql` | 30 database checks: client lockout, cap, replay, week reset, premium, rank, missions, loop and strip area, steals, decay, redemption | `supabase/tests/run.sh v1_integrity` |

## Deploying

```
supabase db push
supabase functions deploy process-run-territory
```

The rules are in `supabase/migrations/20261118000005_territory.sql` (`build_territory_geom`) and `20261118000006_pace.sql` (`credit_pace_capped`); the original change is `supabase/archive/migrations_2026/20261106000001_v1_pace_and_territory_integrity.sql`. Deploy the function after the migrations.
