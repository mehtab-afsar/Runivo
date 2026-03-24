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
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0A0A0A',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.runivo.app',
    infoPlist: {
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
    package: 'com.runivo.app',
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundColor: '#0A0A0A',
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
    [
      'expo-image-picker',
      {
        photosPermission: 'Runivo needs access to your photos to attach images to your shoe log.',
        cameraPermission: 'Runivo uses the camera to photograph your shoes.',
      },
    ],
    '@kingstinct/react-native-healthkit',
    '@maplibre/maplibre-react-native',
  ],
  web: {
    favicon: './assets/favicon.png',
  },
  extra: {
    eas: {
      // Replace with the UUID from `eas init` after running `eas build:configure`
      projectId: process.env.EAS_PROJECT_ID ?? 'REPLACE_WITH_EAS_PROJECT_ID',
    },
  },
  updates: {
    url: 'https://u.expo.dev/REPLACE_WITH_EAS_PROJECT_ID',
    enabled: true,
    checkAutomatically: 'ON_LOAD',
    fallbackToCacheTimeout: 0,
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
});
