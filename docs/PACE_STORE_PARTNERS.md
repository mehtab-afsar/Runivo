# PACE Store partners (v1)

Partners fund the rewards, so Runivo never pays cash for them. PACE is a loyalty point, not money: runners can't buy it, sell it or cash it out. Brands give discounts and freebies because Runivo puts them in front of people who are running in their city, at the moment they've earned something.

Everything below is run from the web admin at `/admin` (admin accounts only). The admin talks to the database through server routes (`/api/admin/*`) with the service-role key. That key lives only on the server as `SUPABASE_SERVICE_ROLE_KEY` and never reaches the browser.

## The partner process

| Step | What happens | Where |
|---|---|---|
| 1. Apply | Brand fills in the form at **runivo.in/partners** (company, category, contact, website, countries and cities, offer, estimated stock). Limits: 5 per 10 minutes per IP, 3 per email per day, plus a hidden bot trap | Appears at the top of **Partners** under *Applications to review*, with **Approve** (→ active) and **Reject**. Email applications: **Add partner**, status *Applied* |
| 2. Review (within 5 working days) | Fits runners? (shoes, apparel, nutrition, cafés near parks, physio, races, gyms, health insurers). At least 15% off or a free item? Can they honour codes? | Partner notes; set status *Active* or *Rejected* |
| 3. Agree | One page: offer, stock, dates, cities, payment model, how codes work | Partner: billing model, fee, billing start, notes |
| 4. Set up | Reward details, PACE cost, rank gate, Plus-only, cities, dates, code mode; upload single-use codes as CSV | **PACE Store → Add reward**, then **Codes** |
| 5. Go live | Status *Live*; optionally a push to runners in that city | **PACE Store** status; **Campaigns → New campaign** |
| 6. Report monthly | Views, redemptions, redemption rate, totals by city and rank, fee owed | **Reports** → partner + month → **Export CSV** |
| 7. Renew | Keep the best performers, drop offers nobody redeems | Reports, then pause or end the partner |

## Pricing rewards in PACE

A runner earns at most 100 PACE a week (150 on Plus), so a PACE price really means weeks of running. The editor warns when a cost falls outside its level.

| Level | PACE cost | Roughly | Example |
|---|---|---|---|
| Entry | 50 to 100 | 1 week | 20% off Brooks (75 PACE) |
| Mid | 200 to 400 | 3 to 4 weeks | Free gait analysis, race entry discount |
| Premium | 1,000 to 1,500 | 3 months, gate to Hunter | Free shoes, sports massage |

## How partners pay us

| Model | How it works | When |
|---|---|---|
| Free listing | First 10 partners list free in exchange for a strong offer | v1 |
| Cost per redemption | Fixed fee per redeemed code (proposed $0.50 to $2), from the partner's billing start month | v1, from month 2 |
| Featured slot, sponsored challenge, affiliate share | | v2 |

Set a free partner to *Cost per redemption* with **Billing starts** on the first day of month 2. The report shows the fee owed for any month on or after that date.

## Rules the server enforces

These all live in one database function, `reward_block_reason()`, used by both redemption and the app's store list:

- **Live:** status *Live*, after **Starts**, before **Ends**.
- **Region:** the runner's country is in the reward's countries, and their last known location is inside one of its launch cities (`store_cities`: Bengaluru, Mumbai, Delhi, Pune, Hyderabad, Chennai, Kolkata, 35 km radius). Rewards for other places aren't shown at all.
- **One per runner per reward.**
- **Plus-only** rewards need Runivo Plus.
- **Rank gate:** e.g. Hunter and above.
- **Fraud gate:** the account is at least 14 days old and has at least 3 runs. Runs are counted by the server, not the phone.
- **Stock:** codes left in the pool, or the stock count for shared-code and no-code rewards.
- **Enough PACE.** Spending only lowers the balance. Lifetime and weekly PACE earned never change, so rank and the weekly cap are unaffected.

Redemption (`redeem_reward`) runs in one transaction. It locks the reward, checks every rule, hands out the oldest unused code (`FOR UPDATE SKIP LOCKED`), takes the PACE once and records the redemption. When two runners race for the last code, one gets it and the other is told it's sold out without losing PACE.

What the runner sees for each lock:

| Reason | In the app |
|---|---|
| `plus_only` | "Runivo Plus", with a button to the Plus screen |
| `rank_locked` | "Reach Hunter to unlock" |
| `new_account` | "Unlocks after 3 runs and 14 days" |
| `sold_out` | "Sold out" |
| `expired` | "Ended" |
| `not_started` / coming soon | "Starts 12 Nov" / "Coming soon" |
| `already_redeemed` | "Redeemed", with their code |
| `not_enough_pace` | Price shown; button says "Not enough PACE" |

After redeeming, the code is shown large with **Copy or share**. It stays on the reward for the runner and is listed under their redemptions.

## Privacy

Reports never contain personal data. Views and redemptions are logged in `reward_events` with only the reward, partner, city, country, rank and whether the runner is on Plus. There is no user id. A runner's repeat views on the same day count once, using a one-way key, not their id. Partners see totals per reward, per city and per rank.

## Code CSV format

One code per line. Only the first column of a CSV is read, a header row named `code` is skipped, and codes already uploaded for that reward are ignored, so re-uploading a file is safe. Up to 20,000 codes per upload.

```
code
BRK-7KQ2-91XA
BRK-9XW4-03LM
```

## Deploy

1. `supabase db push` (migration `20261106000003_pace_store_partners.sql`).
2. `supabase functions deploy redeem-reward`. Deploy this after the migration: `redeem_reward` now returns JSON with a `code` and a `reason`.
3. Set `SUPABASE_SERVICE_ROLE_KEY` on the web host (server env only) and redeploy the site.

Tests: `supabase/tests/v1_store.test.sql`, 49 checks covering every gate, code pools, the two-runner race, the PACE ledger, the app catalogue, anonymous views, reports and fees, and lockdown. See `supabase/tests/README.md`.

## City rewards and the device's location

A reward limited to cities is shown and redeemable when the runner is in one of those cities. The app sends the phone's last known position (only if location is already allowed; the store never asks) rounded to about 1 km. The server checks it against the city's radius for that request only and never stores it. Without a usable point it falls back to the runner's saved location, as before.
