# Runivo: App Store Connect fields (everything except listing text)

**The listing text lives in `apps/mobile/store-metadata/` and is the single source:** `ios/en-US/{description,subtitle,keywords,promotional_text,whats_new}.txt` and `android/en-US/*`. Edit it there, not here. Limits to respect: app name 30, subtitle 30, keywords 100, promotional text 170, description 4000. Check lengths with `wc -m` before pasting (the previous subtitle was 31 and the keywords 124, which App Store Connect rejects).

Keep the text true to the shipped build. A feature behind a flag in `apps/mobile/src/config/features.ts` that a reviewer cannot reach must not be described (Guideline 2.3.1). The Plus text is accurate only while `SUBSCRIPTIONS_ENABLED` is true in the same binary.

## Fields

| Field | Value |
|---|---|
| Name | Runivo (30 characters max; add a short suffix only if the plain name is taken) |
| Bundle ID | `com.mehtabafsar.runivo` (from `app.config.ts`) |
| Primary / secondary category | Health & Fitness / Sports |
| Support URL | https://runivo.app/support |
| Marketing URL | https://runivo.app |
| Privacy Policy URL | https://runivo.app/privacy |
| Terms of Use (EULA) | https://runivo.app/terms (also put it in the description, as the text already does) |
| Support email | one address on one domain, used on the support page, the Terms and in-app (it is currently runivo.com on the web pages and runivo.app elsewhere; confirm the mailbox exists) |
| Price | Free, with in-app purchases (Runivo Plus) |
| Copyright | the legal entity name |

## Age rating (answer the questionnaire; do not pick a rating directly)

Answer **yes** to: user-generated content, messaging and chat, social media (a public feed that spreads content), and health or wellness topics. Do not answer "none". Expect **13+**; confirm the final number in App Store Connect. The Terms already say 13+. A previous version of this file said 4+, which does not fit a public feed with comments and club chat.

## App Privacy ("nutrition labels")

Fill in by hand from `docs/APP_STORE_CHECKLIST.md` (data inventory). Tracking: **none** (no ad or attribution SDKs; PostHog is first-party analytics). Re-check if that changes.

## In-app purchases

Create `runivo_plus_monthly` and `runivo_plus_annual` as auto-renewable subscriptions in one subscription group, add a review screenshot of the paywall to each, attach them to the version, and accept the Paid Apps Agreement (banking and tax). They are reviewed with the build.

## App Review Information

Use `docs/APP_REVIEW_NOTES.md` (sign-in path, demo account, core loop, location, HealthKit, PACE, notifications, AI consent, moderation, deletion). Fill in the demo credentials last.

## Screenshots (iOS)

iPhone 6.9" is the required size (1320 × 2868). The app is iPhone-only (`supportsTablet: false`), so no iPad set is needed. Recommended five: territory map with own and rival zones, active run, run summary with PACE earned, dashboard, leaderboard. Screens must show the real app, not mock-ups (see `screenshot-guide.md`).

## Android (Google Play)

Title 30, short description 80 (both already within limits in `store-metadata/android/`). Content rating questionnaire: same answers as above.
