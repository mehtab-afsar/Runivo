# App Review notes (paste into App Store Connect, App Review Information)

Fill the two `[ ]` fields last. Keep this file in step with the build you submit.

## Before you submit

- [ ] Create the demo account in Supabase Auth (email + password, **email confirmed**), then run `supabase/seed/demo_data.sql` and `demo_data_v1.sql` with that email in `demo_cfg`. It seeds San Francisco runs, 6 zones, a PACE balance, a club with chat, events and partner rewards with codes.
- [ ] Confirm the demo account is more than 14 days old with at least 3 runs (the seed backdates it) so store rewards are redeemable.
- [ ] Subscriptions: `SUBSCRIPTIONS_ENABLED` is true in this binary, `app_settings.subscriptions_enabled` is `true`, the edge function switch is on, and both subscription products are attached to this version.
- [ ] After approval, run `supabase/seed/demo_cleanup.sql` so real runners do not see seeded fake runners and partners.

## Notes

**Sign in.** Open the app, tap "I already have an account", then **"Use a password instead"**. Email: `[ demo email ]`  Password: `[ demo password ]`. Sign in with Apple also works. The account already has run history, claimed zones and a PACE balance, so every screen is populated.

**Age screen.** Every account sees a one-time "When were you born?" screen after signing in (we store only that it was passed, not the date). Enter any month and a year that makes you 18 or older. Under-13 birth dates are refused.

**The core loop without running outdoors.** The Map tab shows owned zones (orange) and rival zones. Home shows the territory score and today's missions. To see a live claim, record a run of at least 200 m outdoors with Location set to "While Using" or "Always"; zones are made from the GPS route. Treadmill runs are logged by hand and count for distance only.

**Location.** Precise location is used only during a run the user starts, so tracking continues with the screen locked (iOS shows the blue indicator). Background location is not used otherwise. If the user denies "Always", foreground tracking still works.

**HealthKit.** Completed runs are saved to Apple Health as workouts. Past running workouts are read only if the user opts in during onboarding, to set a starting baseline. Health data is never used for advertising and is not sold.

**Runivo Plus (in-app purchase).** Optional auto-renewing subscription (monthly and annual) that adds unlimited zones, the PaceX AI coach, training plans, hosting events and extra map styles. Restore Purchases is on the paywall and in Settings → Account. Terms of Use (EULA) and Privacy Policy links are on the paywall. Tracking, territory, clubs, the feed, missions and the PACE store are free.

**PACE.** A free loyalty point earned by running. It cannot be bought, sold or cashed out. Store rewards are partner discount codes for real-world goods, available in selected cities; the demo account is in an eligible city.

**AI coach (PaceX).** Off until the user reads a screen naming Anthropic and agrees; it can be turned off in Settings → Privacy and data. It is a Plus feature, so the demo account has Plus. The server refuses AI calls without consent.

**User-generated content.** Users can report and block from comments (the ⋯ on each comment), posts, club chat, clubs, events and profiles. Reports go to a moderation queue reviewed within 24 hours; abusive accounts can be suspended; a server-side filter rejects objectionable text. The Terms prohibit objectionable content and are shown at sign-up. Contact: support@runivo.com.

**Notifications.** Optional and never required. Gameplay alerts (zone attacked, streak) are on after the user allows notifications; promotional offers are **off by default** and are switched on in Settings → Notifications.

**Account deletion.** Settings → Legal → Delete Account. For Sign in with Apple accounts the app asks the user to confirm with Apple, then revokes the Apple token and deletes the account and all data.

**Sign in with Apple** is offered alongside Google, email and phone.
