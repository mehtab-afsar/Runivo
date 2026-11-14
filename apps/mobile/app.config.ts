import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Runivo',
  slug: 'runivo',
  owner: process.env.EXPO_ACCOUNT_NAME ?? 'runivo',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  // Bundle the sounds folder so MP3s placed in assets/sounds/ are included
  // in both development and production builds without extra configuration.
  assetBundlePatterns: ['assets/**/*', 'assets/sounds/*'],
  // Deep-link scheme — used by notification handler, OAuth, and universal links
  scheme: 'runivo',
  splash: {
    // Plain white on purpose: the in-app launch screen (SplashView) draws the
    // hexagon from nothing on the same white, so the hand-off doesn't show.
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#FFFFFF',
  },
  ios: {
    supportsTablet: false,
    // Must match the identity actually registered with EAS (projectId below) —
    // this used to be 'com.runivo.app' while the real EAS project was
    // registered under 'com.mehtabafsar.runivo' via a stray root-level
    // app.json, so `eas build` from this directory (the real Expo project
    // root) would fail projectId validation, or building from the repo root
    // would ship a binary with none of the permission strings below.
    bundleIdentifier: 'com.mehtabafsar.runivo',
    usesAppleSignIn: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSLocationWhenInUseUsageDescription:
        'Runivo uses your location to track your run and claim territory.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'Runivo uses your location in the background to continue tracking after you lock your screen.',
      NSLocationAlwaysUsageDescription:
        'Runivo uses your location in the background to continue tracking after you lock your screen.',
      NSCameraUsageDescription:
        'Runivo uses the camera to photograph your shoes and scan your foot.',
      NSPhotoLibraryUsageDescription:
        'Runivo needs access to your photos to attach images to your shoe log.',
      NSHealthShareUsageDescription:
        'Runivo reads your past workouts to calculate baselines and passive income.',
      NSHealthUpdateUsageDescription:
        'Runivo saves completed runs to Apple Health.',
    },
    entitlements: {
      'com.apple.developer.healthkit': true,
      'com.apple.developer.healthkit.access': [],
    },
  },
  android: {
    package: 'com.mehtabafsar.runivo',
    // The Supabase session (access + refresh token) is persisted in AsyncStorage —
    // see packages/shared/src/services/supabase.native.ts, which documents why
    // SecureStore's 2048-char value cap ruled it out. With Android's default
    // allowBackup=true that plaintext file is swept into the user's Google Drive by
    // Auto Backup and is extractable via `adb backup` on older devices. Disable it:
    // nothing in this app needs cloud backup of local state (everything syncs from
    // Supabase on sign-in).
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
    [
      // iOS 17+ required-reason API declarations (App Store Review)
      'expo-build-properties',
      {
        ios: {
          privacyManifests: {
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
          },
        },
      },
    ],
    'expo-font',
    'expo-secure-store',
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
        locationAlwaysAndWhenInUsePermission:
          'Runivo uses your location in the background to continue tracking after you lock your screen.',
        locationAlwaysPermission:
          'Runivo uses your location in the background to continue tracking after you lock your screen.',
        locationWhenInUsePermission:
          'Runivo uses your location to track your run and claim territory.',
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: '#D93518',
        sounds: [],
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'Runivo uses the camera to photograph your shoes and scan your foot.',
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    // Add to calendar for events (E2). Runivo only adds events you choose.
    [
      'expo-calendar',
      {
        calendarPermission: 'Runivo adds the events you choose to your calendar.',
        remindersPermission: false,
      },
    ],
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
        photosPermission: 'Runivo needs access to your photos to attach images to your shoe log.',
        cameraPermission: 'Runivo uses the camera to photograph your shoes.',
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
          'Runivo reads your past workouts to calculate baselines and passive income.',
        NSHealthUpdateUsageDescription:
          'Runivo saves completed runs to Apple Health.',
      },
    ],
    '@maplibre/maplibre-react-native',
    '@sentry/react-native',
    'expo-updates',
  ],
  web: {
    favicon: './assets/favicon.png',
  },
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
