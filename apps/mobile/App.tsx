// Register background GPS task at app startup — must be the first import
import './src/features/run/services/locationTask';

// MapLibre requires an access token call even for non-Mapbox tile sources
import { setAccessToken as maplibreSetAccessToken } from '@maplibre/maplibre-react-native';
maplibreSetAccessToken('');

import React, { useCallback, useState, useEffect } from 'react';
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
import { initSentry, captureException } from './src/shared/services/sentry';
import { ThemeProvider } from './src/theme/ThemeContext';
import { useSettings } from './src/features/settings/hooks/useSettings';
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

// Keep splash visible until fonts and auth state are ready
SplashScreen.preventAutoHideAsync();

function Root() {
  const { user, loading } = useAuth();
  const { settings } = useSettings();

  useEffect(() => {
    preloadSounds().catch(() => {});
  }, []);

  useEffect(() => {
    setSoundEnabled(settings.soundEnabled ?? true);
    setHapticEnabled(settings.hapticEnabled ?? true);
  }, [settings.soundEnabled, settings.hapticEnabled]);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  // Check Supabase profiles table to determine if this specific user has completed
  // onboarding. Local getPlayer() is NOT user-scoped (random UUID), so a leftover
  // record from a prior session would incorrectly skip onboarding for new users.
  useEffect(() => {
    if (!user) { setCheckingOnboarding(false); return; }
    setCheckingOnboarding(true);
    // Wrap in Promise.resolve so .catch()/.finally() are available (maybeSingle returns PromiseLike)
    Promise.resolve(
      supabase.from('profiles').select('onboarding_completed_at').eq('id', user.id).maybeSingle()
    )
      .then(async ({ data }) => {
        if (data !== null) {
          // Supabase has a profile row for this user — trust it completely.
          // Do NOT fall through to local getProfile(): local store is not user-scoped
          // and returns stale data from prior accounts on the same device.
          setNeedsOnboarding(!data.onboarding_completed_at);
          return;
        }
        // Supabase has no row at all (offline or trigger delay) — fall back to local store
        const localProfile = await getProfile().catch(() => undefined);
        if (localProfile?.onboardingCompletedAt) {
          setNeedsOnboarding(false);
          // Re-attempt the sync in the background so Supabase catches up
          pushProfile().catch(() => {});
          return;
        }
        setNeedsOnboarding(true);
      })
      .catch(() =>
        // Offline fallback — check local store; default to showing onboarding if unclear
        getPlayer()
          .then(player => setNeedsOnboarding(!player))
          .catch(() => setNeedsOnboarding(true))
      )
      .finally(() => setCheckingOnboarding(false));
  }, [user?.id]);

  const onLayoutRootView = useCallback(async () => {
    if (!loading && !checkingOnboarding) {
      await SplashScreen.hideAsync();
    }
  }, [loading, checkingOnboarding]);

  if (loading || checkingOnboarding) return null;

  const isDark = settings.darkMode;
  return (
    <ThemeProvider isDark={isDark}>
      <View style={[styles.root, { backgroundColor: isDark ? '#0D0D0D' : '#F8F6F3' }]} onLayout={onLayoutRootView}>
        <AppNavigator isAuthenticated={user !== null} needsOnboarding={needsOnboarding} />
        <StatusBar style={isDark ? 'light' : 'dark'} />
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

  if (!fontsLoaded && !fontError) return null;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ToastProvider>
            <Root />
          </ToastProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },
});
