// Register background GPS task at app startup — must be the first import
import './src/features/run/services/locationTask';

// MapLibre requires an access token call even for non-Mapbox tile sources
import { setAccessToken as maplibreSetAccessToken } from '@maplibre/maplibre-react-native';
maplibreSetAccessToken('');

import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  Barlow_300Light,
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
  Barlow_700Bold,
} from '@expo-google-fonts/barlow';
import { PlayfairDisplay_400Regular_Italic } from '@expo-google-fonts/playfair-display';
import {
  DMSans_300Light,
  DMSans_400Regular,
  DMSans_500Medium,
} from '@expo-google-fonts/dm-sans';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useAuth } from '@shared/hooks/useAuth';
import { getPlayer } from '@shared/services/store';
import { getProfile } from '@shared/services/profile';
import { pushProfile } from '@shared/services/sync';
import { supabase } from '@shared/services/supabase';
import { ToastProvider } from './src/shared/components/ToastProvider';
import { ErrorBoundary } from './src/shared/components/ErrorBoundary';
import { SplashView } from './src/shared/components/SplashView';
import { initSentry, captureException } from './src/shared/services/sentry';
import { ThemeProvider } from './src/theme/ThemeContext';
import { useSettings, SettingsProvider } from './src/features/settings/context/SettingsContext';
import { preloadSounds, setSoundEnabled } from './src/theme/sounds';
import { setHapticEnabled } from './src/theme/haptics';

initSentry();

// Catch unhandled JS exceptions and promise rejections in production so they
// reach Sentry instead of crashing silently or showing a cryptic RN red screen.
if (!__DEV__) {
  const handler = (error: Error, isFatal?: boolean) => {
    captureException(error, { isFatal });
  };
  ErrorUtils.setGlobalHandler(handler);
}

// Keep native Expo splash visible until fonts are loaded
SplashScreen.preventAutoHideAsync();

function Root({ fontsReady }: { fontsReady: boolean }) {
  const { user, loading } = useAuth();
  const { settings } = useSettings();

  useEffect(() => {
    preloadSounds().catch(() => {});
  }, []);

  useEffect(() => {
    setSoundEnabled(settings.soundEnabled ?? true);
    setHapticEnabled(settings.hapticEnabled ?? true);
  }, [settings.soundEnabled, settings.hapticEnabled]);
  const [needsOnboarding, setNeedsOnboarding]       = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [splashDone, setSplashDone]                 = useState(false);

  useEffect(() => {
    if (!user) { setCheckingOnboarding(false); return; }
    setCheckingOnboarding(true);
    Promise.resolve(
      supabase.from('profiles').select('onboarding_completed_at').eq('id', user.id).maybeSingle()
    )
      .then(async ({ data }) => {
        if (data !== null) {
          setNeedsOnboarding(!data.onboarding_completed_at);
          return;
        }
        const localProfile = await getProfile().catch(() => undefined);
        if (localProfile?.onboardingCompletedAt) {
          setNeedsOnboarding(false);
          pushProfile().catch(() => {});
          return;
        }
        setNeedsOnboarding(true);
      })
      .catch(() =>
        getPlayer()
          .then(player => setNeedsOnboarding(!player))
          .catch(() => setNeedsOnboarding(true))
      )
      .finally(() => setCheckingOnboarding(false));
  }, [user?.id]);

  // Native Expo splash stays while fonts load; custom SplashView takes over after
  if (!fontsReady) return null;

  const isDark    = settings.darkMode;
  const authReady = !loading && !checkingOnboarding;

  return (
    <ThemeProvider isDark={isDark}>
      <View style={[styles.root, { backgroundColor: isDark ? '#0D0D0D' : '#F8F6F3' }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {authReady && (
          <AppNavigator isAuthenticated={user !== null} needsOnboarding={needsOnboarding} />
        )}
        {!splashDone && (
          <SplashView
            ready={authReady}
            onLayout={() => SplashScreen.hideAsync().catch(() => {})}
            onHidden={() => setSplashDone(true)}
          />
        )}
      </View>
    </ThemeProvider>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Barlow_300Light,
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    Barlow_700Bold,
    PlayfairDisplay_400Regular_Italic,
    DMSans_300Light,
    DMSans_400Regular,
    DMSans_500Medium,
  });

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ToastProvider>
            <SettingsProvider>
              <Root fontsReady={fontsLoaded || !!fontError} />
            </SettingsProvider>
          </ToastProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },
});
