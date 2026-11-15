# App Store submission checklist

Every touchpoint Apple's App Review checks, with how to verify it for Runivo and where it stands. Re-run before each submission. Extends [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md). Guidelines checked: App Review Guidelines dated 16 October 2026.

Status: **Done** = changed and verified here (typecheck, 435 tests, SQL on a scratch database). **Deploy** = done in code, needs the migration or function deployed. **You** = needs App Store Connect, a dashboard, a secret or a decision. **Open** = not done.

## 1. Safety (Guideline 1)

| Check | How to verify | Status |
|---|---|---|
| 1.2 Report content (comments, posts, clubs, events, chat, runners) | In the app, find "Report" on each; each lands in the admin Moderation tab | Done (client) / **Deploy** `20261115000015` |
| 1.2 Block users, everywhere they appear | Block someone from a comment; they vanish from feed, comments and chat, both ways | Done / **Deploy** `20261115000016` (`chat_blocks.test.sql`); rosters and "clubs near you" do not hide blocked runners yet |
| 1.2 Filter objectionable text | `supabase/tests/moderation.test.sql` (19 checks) | **Deploy**; **You**: load the full word list (`supabase/seed/blocked_terms.sql` is a starter) |
| 1.2 Act on reports, publish contact | Admin → Moderation (24h target); `support@runivo.com` | Done; **You**: confirm the mailbox exists |
| 1.2 Terms ban objectionable content, accepted at sign-up | Terms §6; line on the password sign-up form | Done |
| 1.4 Health and safety wording | "Not medical advice" on Coach, Training Plan and the consent screen; "stay on public paths" on the run start screen; also Terms §8 | Done |
| 1.4 / 5.1.4 Minors | One-time age screen (birth month and year, not stored) after sign-in; under 13 is refused and the account deleted; 13 to 17 start private with live sharing off | Done / **Deploy** `20261115000017`; `ageGateOutcome` has tests |
| 1.4 Live location safety | Live sharing is off by default; privacy zones; safety link | Pass (reviewed) |

## 2. Performance (Guideline 2)

| Check | How to verify | Status |
|---|---|---|
| 2.1 Reviewer can sign in | Demo account works with a password (`APP_REVIEW_NOTES.md`) | **You**: create it and seed it |
| 2.1 No placeholder or fake content | Store tab with no rewards shows "No rewards in your area yet"; the fake Brooks reward is gone | Done |
| 2.1 Core loop reachable without running outdoors | Seeded demo account has runs and zones | **You** (seed) |
| 2.1 No dead ends | Hidden "Change Password" without an email; removed "King of the Hill"; version shown from the app config | Done |
| 2.1 Maps load | Set `EXPO_PUBLIC_MAP_TILE_KEY` for a licensed tile source | **You** |
| 2.3 Listing matches the build | `store-metadata/` rewritten; `grep -ri "nutrition\|hexagon\|50 territor\|ad-free" apps/mobile/store-metadata` is empty | Done |
| 2.3 Field limits | `wc -m` on subtitle (29/30), keywords (98/100), Android title (30), short description (80) | Done |
| 2.5.2 OTA updates do not change purpose | `expo-updates`, bug fixes only | Pass |
| 2.5.4 Background modes justified | `UIBackgroundModes` is `location` only (the unused `fetch` is removed) | Done; confirm in a prebuild |

## 3. Business (Guideline 3)

| Check | How to verify | Status |
|---|---|---|
| 3.1.1 Digital features sold through IAP only | No external payment links in the app | Pass |
| 3.1.2 Paywall shows price, period, renewal, EULA and Privacy links, Restore | Paywall; Settings → Account | Done |
| Price visible before the purchase button | Retry state when the store returns no plans | Done |
| Subscription terms in Terms | Terms §7 | Done |
| IAP products exist and are attached | App Store Connect: `runivo_plus_monthly`, `runivo_plus_annual` | **You** |
| RevenueCat keys set | `EXPO_PUBLIC_RC_API_KEY_IOS` in EAS secrets (empty in `eas.json`) | **You** |
| One switch, three places | `SUBSCRIPTIONS_ENABLED` (client), `app_settings.subscriptions_enabled` (database), `_shared/subscriptions.ts` (edge) all true in the submitted build | **You** (release step; not flipped here) |
| 3.2.2 / 5.3 No gift cards, gambling, contests | PACE cannot be bought; rewards are partner discounts | Pass. Keep sponsored challenges off, or add official rules |

## 4. Design (Guideline 4)

| Check | How to verify | Status |
|---|---|---|
| 4.8 Sign in with Apple beside Google | Auth screen | Pass |
| 4.5.4 Push not required, no promotions without opt-in | Settings → Notifications → "Offers and events" is off by default | **Deploy** `20261115000013` |
| 4.2 Minimum functionality | Native app with GPS, HealthKit, Live Activity | Pass |
| 4.1 Name / copycat | Trademark search for "Runivo" | **You** |
| Light/dark | `userInterfaceStyle: 'light'` matches `App.tsx` | Done |
| Touch targets 44pt, labels | 78 small buttons got hit slop; icon-only buttons got spoken labels (comments, kebabs, send, map style and more) | Done (scripted scan); **You**: a VoiceOver and Dynamic Type pass on a device |

## 5. Legal and privacy (Guideline 5)

| Check | How to verify | Status |
|---|---|---|
| 5.1.1(i) Privacy policy matches practice | `apps/web/app/privacy/page.tsx` names every recipient; points at controls that exist | Done; **You**: confirm the date and domain |
| 5.1.1(v) In-app account deletion | Settings → Legal → Delete Account | Done |
| 5.1.1(v) PostHog data deleted with the account | `delete-account` + `posthogDelete.ts` (3 tests) | **Deploy** + **You**: set `POSTHOG_PROJECT_ID` and `POSTHOG_PERSONAL_API_KEY` (a personal key, not the app's project key) |
| 5.1.1(v) Sign in with Apple token revoked | `delete-account` + `appleRevoke.ts` (5 tests) | **Deploy** + **You**: set `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `APPLE_CLIENT_ID` secrets, then delete an Apple-signed-in test account and check the function log shows no "not revoked" warning |
| 5.1.1 Purpose strings accurate | `expo config --type introspect` | Done |
| 5.1.1(ii) Consent withdrawable | Settings → Privacy and data: AI, analytics, imported health data | Done |
| 5.1.2(i) AI: disclose and ask first | Consent screen names Anthropic; server refuses without `ai_consent_at` | Done / **Deploy** `20261115000014` + `ai-coach` |
| 5.1.2 Tracking | No ads or attribution SDKs; declare "no tracking"; no ATT prompt | Pass |
| 5.1.3 HealthKit: only used types, honest data | Workout type only; no default-weight calories | Done. **You**: verify on a device that a run still appears in Health |
| Privacy manifest | `NSPrivacyCollectedDataTypes` set in `app.config.ts` | Done; **You**: archive and run Xcode "Generate Privacy Report" |
| App Privacy labels | Enter by hand from the inventory below | **You** |
| Age rating | Questionnaire: UGC, chat, social media, health topics = yes; expect 13+ | **You** |

## 6. Build

| Check | How to verify | Status |
|---|---|---|
| Xcode 26 / iOS 26 SDK | EAS build log (the default image for Expo SDK 55 uses Xcode 26) | **You**: confirm in the log |
| Deployment target | iOS 15.1 (Apple requires 13+) | Pass |
| Icon 1024, no alpha; bundle ID consistent | `sips -g hasAlpha apps/mobile/assets/icon.png`; `com.mehtabafsar.runivo` | Pass |
| Fresh clone builds | `git clone`, `npm ci`, `npm run typecheck`, `npm test` | **You** (commit first) |
| Real keys in `eas.json` / EAS secrets | RevenueCat, PostHog, map tiles | **You** |

## App Privacy label inventory (tracking: none for every row)

| Data type | Linked to the user | Purpose | Source |
|---|---|---|---|
| Precise location (run GPS) | Yes | App functionality | `locationTask.ts`, `runs.gps_points` |
| Coarse location (about 1 km home area) | Yes | App functionality | `homeArea.ts` |
| Health and fitness (workouts, heart rate, pace, distance) | Yes | App functionality, personalisation | `healthService.ts`, `ai-coach` |
| Contact info (email, phone, name) | Yes | App functionality | sign-in |
| Photos | Yes | App functionality | profile, run and shoe photos |
| Other user content (comments, chat, bio, club and event text) | Yes | App functionality | social features |
| User ID | Yes | App functionality, analytics | PostHog `identify` |
| Device ID (push token) | Yes | App functionality | `expo_push_tokens` |
| Product interaction | Yes | Analytics | PostHog events (opt-out in Settings) |
| Crash and performance data | No | App functionality | Sentry |
| Purchases | Yes | App functionality | RevenueCat, Apple |

Recipients to name: Supabase, Anthropic (only with consent), PostHog, Sentry, RevenueCat, Expo push, Resend, Twilio, Garmin/COROS/Polar (if connected), Google and Apple sign-in, CARTO, OpenStreetMap routing and OpenRouteService, Open-Meteo, Esri and OpenTopoMap.

## Not done (needs you or more work)

Apple token revocation needs your Apple key (above). Plus needs the App Store Connect products and the three-way switch. A hate-speech word list, a licensed map tile key, the demo account, App Store Connect forms and a device test of HealthKit are yours. In-app medical-disclaimer lines, an age gate and server-side two-way chat blocking are open.
