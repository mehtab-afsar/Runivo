# Runivo — App Store Submission Checklist

## Pre-build setup (one time)

- [ ] Run `eas init` in `apps/mobile/` to get a real EAS project ID, then replace `REPLACE_WITH_EAS_PROJECT_ID` in `app.config.ts`
- [ ] Set `owner` in `app.config.ts` to your Expo account name, or set `EXPO_ACCOUNT_NAME` env var
- [ ] Fill in `eas.json` submit section: `appleId`, `ascAppId`, `appleTeamId`
- [ ] Create `apps/mobile/google-services-key.json` (Google Play service account)
- [ ] Set Supabase secrets in EAS:
  ```bash
  eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value <url>
  eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <key>
  eas secret:create --scope project --name EXPO_PUBLIC_RC_API_KEY_IOS --value <key>
  eas secret:create --scope project --name EXPO_PUBLIC_RC_API_KEY_ANDROID --value <key>
  eas secret:create --scope project --name EAS_PROJECT_ID --value <uuid>
  ```
- [ ] Register RevenueCat webhook URL in RevenueCat dashboard:
  `https://<project-ref>.supabase.co/functions/v1/rc-webhook`
  with `RC_WEBHOOK_SECRET` matching the Supabase env var
- [ ] Set `RC_WEBHOOK_SECRET` in Supabase:
  ```bash
  supabase secrets set RC_WEBHOOK_SECRET=<secret>
  ```

## Assets (check sizes)

- [ ] `assets/icon.png` — 1024×1024 px, no transparency, no rounded corners (App Store adds them)
- [ ] `assets/splash-icon.png` — centred logo on `#0A0A0A` background, at least 1284×2778 px
- [ ] `assets/android-icon-foreground.png` — 512×512 px foreground layer (safe zone: 66%)
- [ ] `assets/android-icon-background.png` — 512×512 px solid `#0A0A0A`

## iOS screenshots (required before App Store submission)

App Store Connect requires screenshots for:
- [ ] 6.9" (iPhone 16 Pro Max): 1320×2868 px — at least 3 screenshots
- [ ] 6.5" (iPhone 14 Plus): 1284×2778 px — required if not using 6.9"
- [ ] 12.9" iPad Pro (optional but recommended)

Suggested screens to capture:
1. Territory map with claimed zones
2. Active run with live trail
3. Run summary with XP/stats
4. Dashboard with stats cards
5. Missions list with progress

## Android screenshots

- [ ] Phone: 1080×1920 px minimum — at least 2 screenshots
- [ ] 7" tablet (optional)
- [ ] 10" tablet (optional)

## TestFlight (iOS internal testing)

```bash
cd apps/mobile
eas build --platform ios --profile preview
```

- [ ] Add testers in App Store Connect → TestFlight
- [ ] Verify: background GPS tracking (lock screen during run, verify trail records)
- [ ] Verify: push notification received on device (trigger via Supabase edge function test)
- [ ] Verify: territory claims sync to Supabase after run
- [ ] Verify: Apple Health shows completed run after RunSummary
- [ ] Verify: RevenueCat purchase flow (use sandbox account)

## Internal Android testing

```bash
eas build --platform android --profile preview
```

- [ ] Upload AAB to Play Console → Internal testing
- [ ] Verify: background GPS (same as iOS)
- [ ] Verify: push notification
- [ ] Verify: Health Connect integration (Android 14+)
- [ ] Verify: Google Play Billing (RevenueCat handles this)

## Production build

```bash
# iOS
eas build --platform ios --profile production
eas submit --platform ios --latest

# Android
eas build --platform android --profile production
eas submit --platform android --latest
```

## App Store Connect review notes

When submitting for review, include these notes in the "Notes for reviewer" field:

```
Test account credentials:
  Email: reviewer@runivo-demo.com
  Password: ReviewerTest123!

Key features to test:
1. GPS run tracking: tap "Run" tab → select activity → tap Start
   The app will request location permission. Grant "Always Allow" to enable
   background tracking. Start a walk/run and lock your phone — the blue bar
   confirms background tracking is active.

2. Territory claiming: after finishing a run, territories appear on the Map tab.

3. Apple Health: completed runs automatically write to Apple Health Workouts.
   Grant Health permission when prompted on first run completion.

4. Push notifications: the app sends a push when another user claims your
   territory. Notifications permission is requested on first launch.

5. Camera / photos: tap Gear tab → Add Shoe → tap the photo area to attach
   a photo from library or camera.

Background location is used ONLY during an active run session initiated by
the user. The app does not track location outside of active run sessions.
```

## Post-submission

- [ ] Set up OTA updates for future patches:
  ```bash
  eas update --branch production --message "patch description"
  ```
- [ ] Monitor crash reports in Expo Dashboard
- [ ] Monitor RevenueCat dashboard for subscription events
- [ ] Monitor Supabase logs for edge function errors
