# App Review notes (paste into App Store Connect, App Review Information)

Fill the two `[ ]` fields last. Keep this file in step with the build you submit.

## Before you submit

- [ ] Production database is up to date: `npx supabase db push` (includes `20261123000001_launch_fixes.sql`: account-deletion fix, word filter list, club handover).
- [ ] Edge functions deployed: `npm run functions:deploy -- ai-coach delete-account foot-scan process-run-territory send-push-notification`.
- [ ] Secrets set (`npx supabase secrets list`): `ANTHROPIC_API_KEY`; the four `APPLE_*` keys (Sign in with Apple revoke on deletion); `SUBSCRIPTIONS_ENABLED` absent or `false`.
- [ ] Create the demo account in Supabase Auth (email + password, **email confirmed**), then run `supabase/seed/demo_data.sql` and `demo_data_v1.sql` with that email in `demo_cfg`. It seeds runs, 6 zones, a PACE balance, a club with chat, events and sample store rewards.
- [ ] Test account deletion three ways: a fresh email account, a Sign in with Apple account that created a club, and a copy of the demo account. Each must end on the sign-in screen with no error.
- [ ] `support@runivo.com` receives mail; `https://runivo.app/privacy`, `/terms` and `/support` open on a phone.
- [ ] No in-app purchase products attached to this version.
- [ ] After approval, run `supabase/seed/demo_cleanup.sql` so real runners do not see seeded runners and sample partners.

## Notes

**Sign in.** Open the app, tap "I already have an account", then **"Use a password instead"**. Email: `[ demo email ]`  Password: `[ demo password ]`. Sign in with Apple also works. The account already has run history, zones, a club with chat and events, so every screen has content.

**Age screen.** Every account sees a one-time "When were you born?" screen. Enter any month and a year that makes you 18 or older. Under-13 birth dates are refused.

**Pricing.** Version 1.0 is completely free. There are no in-app purchases or subscriptions in this build.

**The core loop without running outdoors.** The Map tab shows your zones (orange) and rivals' zones. Home shows the territory score and today's missions. To see a live claim, record a run of at least 200 m outdoors; zones are made from the GPS route. Treadmill runs are logged by hand and count for distance only.

**Location.** Used only during a run the user starts. Tracking continues with the screen locked (iOS shows the blue indicator). "Always" permission is never requested.

**Background audio (`UIBackgroundModes`: `location` and `audio`).** Both modes are used only during a run the user has started, and by nothing else. `location` records the route. `audio` lets the voice coach speak with the screen locked, which is how runners use it: phone in an armband or pocket, a spoken cue each kilometre ("Kilometre 3, split 5:12, total 15:40"), a heads-up when a loop closes or a zone is entered, and workout step changes. Without `audio`, iOS silences the app the moment the screen locks and the cues are never heard. The app plays no music, podcast or other media, shows no Now Playing or lock-screen media controls and does not record. It mixes with the user's own music and only lowers its volume for the length of a spoken cue, then restores it; the session is released when the run ends. The optional beat pacer (a metronome click, Settings → Run) plays in the foreground only. To hear it: voice cues are on by default (Settings → Run → Voice cues); start an outdoor run, lock the phone and keep moving; the kilometre cue is spoken over the locked screen.

**HealthKit.** Optional. Completed runs can be saved to Apple Health as workouts. Past running workouts are read only if the user opts in during onboarding, to set a starting baseline. Health data is never used for advertising and is not sold.

**AI (PaceX coach and Foot scan).** Off until the user reads a screen that names Anthropic as the AI provider and lists exactly what is sent, then agrees. It can be turned off in Profile → Settings → Privacy and data. The server refuses every AI request without that consent. PaceX gives general running guidance, not medical advice; messages that mention injury or health red flags get a fixed safety reply.

**PACE and the Store.** PACE is a free reward point earned by running. It cannot be bought, sold or cashed out. The demo account's store rewards are sample offers from invented brands for review; real partner offers launch city by city.

**User-generated content.** Report: on posts (⋯), comments (⋯), club chat messages, clubs, events and runner profiles. Block: on comments, club members and runner profiles (⋯ → Block); blocked runners are managed in Settings → Blocked runners. A server-side word filter rejects objectionable text in comments, chat, bios, names, post and run titles, clubs and events. Reports are reviewed within 24 hours and abusive accounts can be suspended. The Terms forbid objectionable content and are shown at sign-up. Contact: support@runivo.com (also in Settings → Support).

**Notifications.** Optional and never required. Promotional offers are off by default.

**Account deletion.** Profile → Settings (gear icon) → scroll to the bottom → "Delete account" → confirm. Sign in with Apple accounts are asked to confirm with Apple; the Apple token is then revoked and the account and all its data are deleted.

**Sign in with Apple** is offered first, alongside Google, email and phone.
