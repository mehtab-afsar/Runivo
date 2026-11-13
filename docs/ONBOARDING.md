# Onboarding and login (v1)

Goal: a new runner is out on their first run within 24 hours, and PaceX knows enough to coach them from that first run. Targets: 70% finish onboarding, 50% start a run within 24 hours. Analytics events: `onboarding_started`, `onboarding_step_done`, `onboarding_step_skipped`, `onboarding_complete`, `auth_code_sent`, `auth_signed_in`.

## Login

One screen for new and returning runners (`AuthScreen`; both "Get started" and "I already have an account" open it). The first sign-in creates the account.

| Method | How |
|---|---|
| Apple | Native button on iOS (`signInWithIdToken`) |
| Google | Browser sign-in with PKCE (`runivo://auth/callback`) |
| Phone | 6-digit SMS code (`signInWithOtp({ phone })`, then `verifyOtp`). Numbers without a country code are treated as Indian (+91). |
| Email | Magic link to `runivo://auth/magic` (PKCE). The same email carries a 6-digit code for when the link opens on another device. |
| Password | "Use a password instead" keeps the old email + password forms for existing accounts. |

Codes can be resent after 30 seconds, at most 3 times in 10 minutes (checked in the app; the real limit is Supabase's, below).

## The screens

| # | Screen | Collects | Powers | Required |
|---|---|---|---|---|
| 1 | Welcome | — | The landing page, then login | — |
| 2 | Your area | Location while using the app, country | Zones, rivals, city leaderboard, local rewards. Shows the real zones within ~1.5 km. | Asked; can continue if declined |
| 3 | Why do you run? | Get fit, train for a race, compete, run with people | Mission mix, PaceX tone (`pacex_tone`), campaign targeting | Yes |
| 4 | Your running now | Runs a week, usual distance, optional 5K time | Starting weekly target, mission difficulty, PaceX pace zones | Distance yes, time optional |
| 5 | Health app | Separate consent, then the last 90 days of runs from Apple Health / Health Connect | PaceX baseline (`health_baseline`). Past runs never claim zones. | No |
| 6 | About you | Age range, sex, height, weight | Calories and heart-rate zones only | No, skippable |
| 7 | Name and photo | Username, optional photo | Name on zones and leaderboards | Name yes |
| 8 | Find your people | Clubs to join, invite link | Clubs; mutual follows unlock the live friend map | No |
| 9 | Alerts | Push permission, asked with the reason | Zone attacked, fading zones, streak at risk | No ("Not now") |
| 10 | First mission | — | "Run a loop of at least 1 km to claim your first zone." Start run opens the Run tab. | — |

Background location ("Always") is asked on the first run, when the runner locks the screen, not here. There is no paywall in onboarding.

How answers become the starting setup (`packages/shared/src/engine/onboarding.ts`, tested):

- **Weekly target:** runs a week × usual distance, plus 10% for a race goal. If the health app was connected, it's averaged with the last 90 days. Kept between 3 and 120 km.
- **Experience:**
  - New: 1 run a week or under 3 km.
  - Competitive: 5+ runs and 10+ km, or a 5K under 20 minutes.
  - Regular: 4+ runs or 8+ km.
  - Casual: everyone else.
- **Mission difficulty:** easy for new runners, hard for competitive, mixed otherwise.
- **PaceX tone:** encouraging (get fit), structured (race), competitive (compete), friendly (run with people).

## Where it's stored

`profiles` (migration `20261106000005_onboarding_profile.sql`):

| Column | From |
|---|---|
| `primary_goal` | Goal. The new values `race` and `social` are added; the old ones stay valid. |
| `weekly_frequency`, `weekly_goal_km`, `experience_level`, `mission_difficulty`, `preferred_distance` | Your running now |
| `usual_distance_km`, `recent_5k_seconds` | Your running now (new) |
| `pacex_tone` | Goal (new) |
| `age_range`, `gender`, `height_cm`, `weight_kg`, `age` (range midpoint) | About you |
| `health_consent_at`, `health_consent_version`, `health_baseline` | Health app (new). Consent is separate from the terms. Withdrawing it (setting `health_consent_at` to NULL) deletes the baseline. |
| `username`, `avatar_url` | Name and photo |

The migration also fixes phone sign-ups. With no email there was no username to derive, so account creation failed with "Database error saving new user". Phone accounts now start as `runner_xxxx` and pick their name at step 7.

## Supabase dashboard settings (you need to set these)

**Phone (SMS) login**

1. Authentication → Providers → Phone: enable it and connect an SMS provider (Twilio, MessageBird, Vonage or Textlocal). For India, register a DLT sender ID and OTP template with your provider first, or carriers drop the messages.
2. Authentication → Rate Limits: set SMS sent per hour to what you can afford (SMS costs money per message). Start around 30 an hour while testing.
3. Authentication → Providers → Phone: OTP expiry of 300 seconds and a 6-digit OTP length (the app expects 6 digits).

**Email magic link**

1. Authentication → URL Configuration → Redirect URLs: add `runivo://auth/magic` (and keep `runivo://auth/callback` for Google).
2. Authentication → Email Templates → Magic Link: include both the link and the code, for example:

   ```html
   <h2>Sign in to Runivo</h2>
   <p><a href="{{ .ConfirmationURL }}">Tap to sign in</a></p>
   <p>Or enter this code in the app: <strong>{{ .Token }}</strong></p>
   ```

3. Authentication → Providers → Email: keep "Confirm email" on. Set the OTP length to 6.
4. Authentication → SMTP: use your own sender (Resend, Postmark, SES). Supabase's built-in sender is limited to a few emails an hour.

**Account linking (Settings → Sign-in methods)**

One Runivo account, several ways in. Settings lists every linked method (Apple, Google, phone, email) with a masked email or number, offers the ones still missing (Apple only on iOS), and removes a method only when another one is left.

1. Authentication → Sign In / Providers → **Allow manual linking**: turn it on. Without it, Link Google and Link Apple fail with "Linking isn't switched on yet".
2. Google linking reuses the sign-in redirect `runivo://auth/callback`, already in Redirect URLs.
3. Apple linking uses the native iOS flow, so the Apple provider needs the app's bundle ID in its Client IDs, the same as for sign-in.
4. Adding a phone number sends an SMS through the same provider as phone login (`updateUser({ phone })`, then a `phone_change` code). The phone sign-in settings above apply, including the rate limit. The app allows a new code every 30 seconds, up to 3 in 10 minutes.
5. A phone number added this way is a way to sign in but has no separate identity, so Settings shows it as linked and doesn't offer to remove it. If someone needs it removed, do it from Authentication → Users.

The rules (what can be linked, when a method can be removed, the masked labels and error messages) are in `packages/shared/src/engine/identities.ts`, with tests.

## Tests

- `packages/shared/src/engine/onboarding.test.ts`: 24 tests covering 5K times, starting setup, health baseline, username, phone and email, and code resend limits.
- `supabase/tests/v1_onboarding.test.sql`: 13 checks covering sign-ups by email and phone, goals, new columns, and health consent. Run it after `_stub_supabase.sql`, `20261106000001…`, `_stub_onboarding.sql` and `20261106000005…`.
