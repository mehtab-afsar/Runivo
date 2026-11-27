import { ExpoConfig, ConfigContext } from 'expo/config';

const LOCATION_WHEN_IN_USE =
  'Runivo uses your location to track your run, show it on the map and claim territory. Tracking continues while your screen is locked during a run.';

// Apple privacy manifest (PrivacyInfo.xcprivacy). Expo reads this from `ios.privacyManifests`;
// putting it inside the expo-build-properties plugin is silently ignored.
const PRIVACY_MANIFEST: NonNullable<NonNullable<ExpoConfig["ios"]>["privacyManifests"]> = {
  // What the app collects, as declared in App Store Connect's App Privacy
  // section. Keep the two in step (docs/APP_STORE_CHECKLIST.md).
  // Nothing is used to track (no ads, no cross-app identifiers).
  NSPrivacyTracking: false,
  NSPrivacyCollectedDataTypes: [
    ...[
      ['NSPrivacyCollectedDataTypePreciseLocation', true],
      ['NSPrivacyCollectedDataTypeCoarseLocation', true],
      ['NSPrivacyCollectedDataTypeHealth', true],
      ['NSPrivacyCollectedDataTypeFitness', true],
      ['NSPrivacyCollectedDataTypeEmailAddress', true],
      ['NSPrivacyCollectedDataTypePhoneNumber', true],
      ['NSPrivacyCollectedDataTypeName', true],
      ['NSPrivacyCollectedDataTypePhotosorVideos', true],
      ['NSPrivacyCollectedDataTypeOtherUserContent', true],
      ['NSPrivacyCollectedDataTypeDeviceID', true],
      // react-native-purchases (RevenueCat) sends the App Store purchase and
      // subscription record to RevenueCat, tied to the account id.
      ['NSPrivacyCollectedDataTypePurchaseHistory', true],
    ].map(([type, linked]) => ({
      NSPrivacyCollectedDataType: type as string,
      NSPrivacyCollectedDataTypeLinked: linked as boolean,
      NSPrivacyCollectedDataTypeTracking: false,
      NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
    })),
    // First-party product analytics (PostHog), tied to the account id.
    ...['NSPrivacyCollectedDataTypeUserID', 'NSPrivacyCollectedDataTypeProductInteraction'].map(type => ({
      NSPrivacyCollectedDataType: type,
      NSPrivacyCollectedDataTypeLinked: true,
      NSPrivacyCollectedDataTypeTracking: false,
      NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAnalytics', 'NSPrivacyCollectedDataTypePurposeAppFunctionality'],
    })),
    // Crash and performance reports (Sentry): not linked to the account.
    ...['NSPrivacyCollectedDataTypeCrashData', 'NSPrivacyCollectedDataTypePerformanceData'].map(type => ({
      NSPrivacyCollectedDataType: type,
      NSPrivacyCollectedDataTypeLinked: false,
      NSPrivacyCollectedDataTypeTracking: false,
      NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
    })),
  ],
  NSPrivacyAccessedAPITypes: [
    {
      NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
      NSPrivacyAccessedAPITypeReasons: ['C617.1'],
    },
    {
      NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
      NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
    },
    {
      NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
      NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
    },
    {
      NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
      NSPrivacyAccessedAPITypeReasons: ['E174.1'],
    },
  ],
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Runivo',
  slug: 'runivo',
  owner: process.env.EXPO_ACCOUNT_NAME ?? 'runivo',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  // The app draws its own light UI (App.tsx forces it). 'automatic' left system alerts,
  // the keyboard and sheets dark on a dark-mode phone while the app stayed light.
  userInterfaceStyle: 'light',
  // Bundle the sounds folder so MP3s placed in assets/sounds/ are included
  // in both development and production builds without extra configuration.
  assetBundlePatterns: ['assets/**/*', 'assets/sounds/*'],
  // Deep-link scheme — used by notification handler, OAuth, and universal links
  scheme: 'runivo',
  splash: {
    // One launch look: a thin orange hexagon over the runivo wordmark, still (no pulse).
    // The in-app SplashView shows the same image at the same size (280 pt), so the hand-off is invisible.
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#FFFFFF',
  },
  ios: {
    // iOS 18 darkens light icons on a dark Home Screen (that black tile). A dark
    // variant that keeps the white tile, plus a tinted one, stops that.
    icon: {
      light: './assets/icon.png',
      dark: './assets/icon.png',
      tinted: './assets/icon-tinted.png',
    },
    supportsTablet: false,
    // Must match the identity actually registered with EAS (projectId below) —
    // this used to be 'com.runivo.in' while the real EAS project was
    // registered under 'com.mehtabafsar.runivo' via a stray root-level
    // app.json, so `eas build` from this directory (the real Expo project
    // root) would fail projectId validation, or building from the repo root
    // would ship a binary with none of the permission strings below.
    bundleIdentifier: 'com.mehtabafsar.runivo',
    usesAppleSignIn: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      // "location": keeps tracking a run with the screen locked (expo-location adds it too).
      // "audio": spoken split cues (and the run sounds) with the screen locked, over the
      // user's own music. Nothing else in the app plays audio in the background. Listed
      // here, not via the expo-audio plugin, which would also add a microphone string and
      // Android recording permissions the app does not use. See docs/APP_REVIEW_NOTES.md.
      UIBackgroundModes: ['location', 'audio'],
      // While Using only. iOS keeps tracking a run with the screen locked through the
      // "location" background mode (blue status-bar indicator), so the app never asks for
      // "Always" and ships no NSLocationAlways* strings (the expo-location plugin below is
      // told to drop them too). Android is the platform that asks for background location.
      NSLocationWhenInUseUsageDescription: LOCATION_WHEN_IN_USE,
      NSCameraUsageDescription:
        'Runivo uses the camera to take your profile photo, photos of your shoes and feet for the gear log and foot scan, and to scan runner QR codes.',
      NSPhotoLibraryUsageDescription:
        'Runivo needs access to your photos so you can set your profile picture, add photos to your runs and posts, attach photos to your shoe log and add club images.',
      // "Save Image" in the share sheet (run, zone and profile cards). Without
      // this string iOS ends the app the moment someone taps it.
      NSPhotoLibraryAddUsageDescription:
        'Runivo saves your run, zone and profile cards to your photos when you tap Save Image.',
      NSHealthShareUsageDescription:
        'Runivo can read your past running workouts from Apple Health to set your starting baseline, if you choose to import them.',
      NSHealthUpdateUsageDescription:
        'Runivo saves your completed runs to Apple Health as running workouts.',
    },
    entitlements: {
      'com.apple.developer.healthkit': true,
      'com.apple.developer.healthkit.access': [],
    },
    privacyManifests: PRIVACY_MANIFEST,
  },
  android: {
    package: 'com.mehtabafsar.runivo',
    // The Supabase session (access + refresh token) is persisted in AsyncStorage, now
    // ENCRYPTED with a key in the Keystore (packages/shared/src/services/secureSessionStorage.ts).
    // Still disable Auto Backup: the rest of local state (runs, GPS traces, health data)
    // is plain SQLite, and nothing in this app needs cloud backup of it — everything
    // syncs from Supabase on sign-in.
    allowBackup: false,
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      monochromeImage: './assets/android-icon-monochrome.png',
      backgroundColor: '#FFFFFF',
    },
    permissions: [
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_BACKGROUND_LOCATION',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_LOCATION',
      'android.permission.CAMERA',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.VIBRATE',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.POST_NOTIFICATIONS',
    ],
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-font',
    './plugins/withoutBackgroundFetch',
    // faceIDPermission:false: the plugin otherwise adds a generic Face ID string and the app never uses biometrics.
    ['expo-secure-store', { faceIDPermission: false }],
    [
      'expo-sqlite',
      {
        enableFTS: true,
        useSQLCipher: false,
      },
    ],
    [
      'expo-location',
      {
        // false removes the key: the plugin otherwise injects both NSLocationAlways* strings
        // with a generic default. iOS tracks in the background on "While Using" (see ios.infoPlist).
        locationAlwaysAndWhenInUsePermission: false,
        locationAlwaysPermission: false,
        locationWhenInUsePermission: LOCATION_WHEN_IN_USE,
        // Adds UIBackgroundModes: ["location"].
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    [
      'expo-splash-screen',
      { image: './assets/splash-icon.png', imageWidth: 280, resizeMode: 'contain', backgroundColor: '#FFFFFF' },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: '#F2A43A',
        sounds: [],
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'Runivo uses the camera to take your profile photo, photos of your shoes and feet for the gear log and foot scan, and to scan runner QR codes.',
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    // Add to calendar for events (E2). Runivo only adds events you choose.
    [
      'expo-calendar',
      {
        calendarPermission: 'Runivo adds the events you choose to your calendar.',
        // Runivo never asks for Reminders access. The key must still exist: expo-calendar
        // 55 fatals at startup (MissingCalendarPListValueException) if it is absent, so
        // `false` (which omits it) crashes the app on launch.
        remindersPermission: 'Runivo never asks for your reminders; iOS requires this text for the calendar component.',
      },
    ],
    // Portrait-only and aps-environment from the build profile. Listed BEFORE expo-widgets:
    // mods run last-registered-first, and expo-widgets hard-codes aps-environment=development.
    './plugins/withIosReleaseConfig',
    // Live Activity on the lock screen and Dynamic Island during a run (L2).
    // Creates the widget extension target and an App Group
    // (group.<bundleIdentifier>); frequentUpdates lets the run update every few seconds.
    ['expo-widgets', { frequentUpdates: true, widgets: [] }],
    // L4: the Apple Watch companion (targets/watch). Opt in with RUNIVO_WATCH=1
    // so a phone-only build never depends on the watch target compiling.
    ...(process.env.RUNIVO_WATCH === '1' ? ['@bacons/apple-targets' as const] : []),
    // L4 on Android: the Wear OS app (targets/wear). Opt in with RUNIVO_WEAR=1.
    ...(process.env.RUNIVO_WEAR === '1' ? ['./plugins/withWearCompanion' as const] : []),
    [
      'expo-image-picker',
      {
        photosPermission: 'Runivo needs access to your photos so you can set your profile picture, add photos to your runs and posts, attach photos to your shoe log and add club images.',
        cameraPermission: 'Runivo uses the camera to take your profile photo, photos of your shoes and feet for the gear log and foot scan, and to scan runner QR codes.',
      },
    ],
    // Must be passed as [plugin, props] — the plugin dereferences
    // `props.NSHealthShareUsageDescription` with no undefined guard
    // (node_modules/@kingstinct/react-native-healthkit/app.plugin.js:62), so
    // registering it as a bare string crashes prebuild with
    // "Cannot read properties of undefined". Because apps/mobile/ios is
    // gitignored, EAS prebuilds too — this failed `eas build`, not just local.
    // Strings kept identical to the ios.infoPlist entries above.
    [
      '@kingstinct/react-native-healthkit',
      {
        NSHealthShareUsageDescription:
          'Runivo can read your past running workouts from Apple Health to set your starting baseline, if you choose to import them.',
        NSHealthUpdateUsageDescription:
          'Runivo saves your completed runs to Apple Health as running workouts.',
        // The plugin adds com.apple.developer.healthkit.background-delivery unless told
        // otherwise. The app registers no HealthKit observer queries, so it must not claim it.
        background: false,
      },
    ],
    '@maplibre/maplibre-react-native',
    '@sentry/react-native',
    'expo-updates',
  ],
  extra: {
    eas: {
      // The real EAS project id (registered under com.mehtabafsar.runivo).
      projectId: process.env.EAS_PROJECT_ID ?? '024aa932-e299-4d0c-bc08-bacb7617274a',
    },
  },
  updates: {
    url: 'https://u.expo.dev/024aa932-e299-4d0c-bc08-bacb7617274a',
    enabled: true,
    checkAutomatically: 'ON_LOAD',
    fallbackToCacheTimeout: 0,
    // OTA code signing. Without this the client executes ANY bundle served on the
    // production channel, so a leaked EAS token = arbitrary code execution inside a
    // binary holding background location, HealthKit and every user's session — with
    // no App Review gate. The certificate is public and committed; the matching
    // private key (keys/private-key.pem) is gitignored and must live in a secret
    // manager — `eas update` signs with it at publish time.
    codeSigningCertificate: './certs/certificate.pem',
    codeSigningMetadata: {
      keyid: 'main',
      alg: 'rsa-v1_5-sha256',
    },
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
});
