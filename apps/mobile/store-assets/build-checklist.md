# App Store Build Checklist

## Pre-build verification ✓

- [x] `icon.png` — 1024×1024 px, RGB (no alpha) ✓
- [x] `splash-icon.png` — 1024×1024 px ✓
- [x] `android-icon-foreground.png` — 512×512 px ✓
- [x] `eas.json` — development / preview / production profiles configured ✓
- [x] `app.config.ts` — bundleIdentifier `com.mehtabafsar.runivo`, permissions, HealthKit ✓
- [x] Background location plugin configured ✓
- [x] `assets/sounds/` directory present ✓

## Environment variables required

Set these in EAS dashboard (eas.com) for the `production` channel:
```
EXPO_PUBLIC_SUPABASE_URL         = https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY    = eyJhbGciOiJIUzI1NiIs...
EAS_PROJECT_ID                   = (from `eas init` — replaces app.config.ts's placeholder)
EXPO_ACCOUNT_NAME                = runivo
EXPO_PUBLIC_SENTRY_DSN           = (from your Sentry project settings)
EXPO_PUBLIC_POSTHOG_API_KEY      = (from your PostHog project settings)
EXPO_PUBLIC_POSTHOG_HOST         = https://us.i.posthog.com
```

RevenueCat IS part of this launch (Runivo Plus). Set these in the EAS dashboard
(Secrets / environment variables), not as empty strings in `eas.json`:

```
EXPO_PUBLIC_RC_API_KEY_IOS       = (RevenueCat public iOS SDK key)
EXPO_PUBLIC_RC_API_KEY_ANDROID   = (RevenueCat public Android SDK key)
```

`react-native-purchases` is installed. The client switch (`SUBSCRIPTIONS_ENABLED` in
`packages/shared/src/engine/entitlements.ts`), the server row
(`app_settings.subscriptions_enabled`) and the edge-function switch
(`supabase/functions/_shared/subscriptions.ts`) must all be true in the build you
submit. Create the two subscriptions in App Store Connect first.

## eas.json submit fields to fill in

In `eas.json` → `submit.production.ios`:
```json
"appleId":     "your@apple.id",
"ascAppId":    "123456789",   ← from App Store Connect
"appleTeamId": "XXXXXXXXXX"   ← 10-char team ID from developer.apple.com
```

## Build commands

```bash
cd apps/mobile

# 1. Configure EAS project (first time only — creates project ID)
eas build:configure

# 2. Development build (simulator, for testing)
eas build --platform ios --profile development

# 3. Preview build (TestFlight internal testing)
eas build --platform ios --profile preview
eas submit --platform ios --profile preview

# 4. Production build + submit
eas build --platform ios --profile production
eas submit --platform ios --profile production

# Android
eas build --platform android --profile production
eas submit --platform android --profile production
```

## App Store Connect setup (before first submit)

1. Go to https://appstoreconnect.apple.com
2. My Apps → "+" → New App
3. Platform: iOS, Name: "Runivo", Bundle ID: com.mehtabafsar.runivo
4. Fill in pricing (free), primary language (English), age rating
5. Upload screenshots (5 per device size)
6. Paste description, keywords, subtitle from `store-metadata/ios/en-US/` (see `app-store-listing.md` for the other fields)
7. Set privacy policy URL: https://runivo.in/privacy
8. Submit for review

## TestFlight before production

After `eas build --profile preview`:
1. In App Store Connect → TestFlight → Internal Testing
2. Add internal testers (up to 100 with no review)
3. Test: background location tracking, territory claim, push notifications, HealthKit, account deletion, Sentry error capture, PostHog event firing
4. Run at least one full run end-to-end before production submit — see the real-device test script for the full checklist
