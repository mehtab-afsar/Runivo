// Register background GPS task at app startup — must be the first import
import { ensureLocalDataBelongsTo } from '@mobile/shared/services/localOwner';
import './src/features/run/services/locationTask';
import { onOnboardingComplete } from '@mobile/shared/lib/onboardingEvents';

// MapLibre requires an access token call even for non-Mapbox tile sources
import { setAccessToken as maplibreSetAccessToken } from '@maplibre/maplibre-react-native';
maplibreSetAccessToken('');

import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
// One file per weight: the package's index requires all nine weights.
import { Outfit_400Regular } from '@expo-google-fonts/outfit/400Regular';
import { Outfit_500Medium } from '@expo-google-fonts/outfit/500Medium';
import { Outfit_600SemiBold } from '@expo-google-fonts/outfit/600SemiBold';
import { Outfit_700Bold } from '@expo-google-fonts/outfit/700Bold';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import AgeGateScreen from './src/features/auth/screens/AgeGateScreen';
import { useAuth } from '@shared/hooks/useAuth';
import { getPlayer } from '@shared/services/store';
import { getProfile } from '@shared/services/profile';
import { pushProfile, initialSync, pushUnsyncedRuns, setAiCoachEnabled } from '@shared/services/sync';
import { FEATURES } from './src/config/features';
import { supabase } from '@shared/services/supabase';
import { ToastProvider } from './src/shared/components/ToastProvider';
import { AlertLayer } from './src/shared/components/AppAlert';
import { CaptureHost } from './src/shared/components/CaptureHost';
import { ErrorBoundary } from './src/shared/components/ErrorBoundary';
import { SplashView } from './src/shared/components/SplashView';
import { initSentry, captureException } from './src/shared/services/sentry';
import { initAnalytics, identify, track } from '@shared/services/analytics';
import { ThemeProvider } from './src/theme/ThemeContext';
import { useSettings, SettingsProvider } from './src/features/settings/context/SettingsContext';
import { preloadSounds, setSoundEnabled } from './src/theme/sounds';
import { loadRunivoMapStyle } from './src/theme/runivoMapStyle';
import { setHapticEnabled } from './src/theme/haptics';
import { watchHomeArea } from './src/shared/location/homeArea';

initSentry();
initAnalytics(
  process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? '',
  process.env.EXPO_PUBLIC_POSTHOG_HOST
);

// Catch unhandled JS exceptions and promise rejections in production so they
// reach Sentry instead of crashing silently or showing a cryptic RN red screen.
// Chains to the previous handler (RN's default, and the one Sentry.init() installs)
// instead of replacing it outright — without this, a fatal JS error left the app in
// an undefined frozen state instead of the platform's normal crash/restart behavior.
if (!__DEV__) {
  const previousHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    captureException(error, { isFatal });
    previousHandler?.(error, isFatal);
  });
}

// Keep native Expo splash visible until fonts are loaded
SplashScreen.preventAutoHideAsync();

function Root({ fontsReady }: { fontsReady: boolean }) {
  const { user, loading } = useAuth();
  const { settings } = useSettings();

  useEffect(() => {
    preloadSounds().catch(() => {});
    loadRunivoMapStyle();
    setAiCoachEnabled(FEATURES.AI_COACH);
  }, []);

  useEffect(() => {
    setSoundEnabled(settings.soundEnabled ?? true);
    setHapticEnabled(settings.hapticEnabled ?? true);
  }, [settings.soundEnabled, settings.hapticEnabled]);

  const [needsOnboarding, setNeedsOnboarding]       = useState(false);
  // Not yet through the age screen (profiles.age_confirmed_at is null): shown before anything else.
  const [needsAgeGate, setNeedsAgeGate]               = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [splashDone, setSplashDone]                 = useState(false);

  // Adjust state during render (React's documented pattern for "reset derived state
  // when a prop changes") the instant `user` flips from null to signed-in, rather
  // than waiting for the effect below to run after this render commits. Without
  // this, sign-in produced one painted frame where `loading` was already false but
  // `checkingOnboarding` still held its stale pre-sign-in value (false), so
  // `authReady` was briefly true with a stale `needsOnboarding` — flashing the Main
  // navigator (and mounting its data hooks) before the real onboarding check
  // resolved.
  const prevUserIdRef = useRef<string | null>(null);
  if (user?.id !== prevUserIdRef.current) {
    prevUserIdRef.current = user?.id ?? null;
    if (user && !checkingOnboarding) setCheckingOnboarding(true);
  }

  useEffect(() => {
    if (!user) { setNeedsAgeGate(false); setCheckingOnboarding(false); return; }
    setCheckingOnboarding(true);
    // Guards against a rapid sign-out→sign-in-as-different-account race: without
    // it, the PREVIOUS user's in-flight profile response could resolve after the
    // new user's effect run and set needsOnboarding for the wrong account.
    let cancelled = false;
    // Another account's data on this phone must not count for this one
    // (it used to make a new sign-up skip onboarding and show their runs).
    ensureLocalDataBelongsTo(user.id).catch(() => false)
      .then(() => supabase.from('profiles').select('onboarding_completed_at, age_confirmed_at').eq('id', user.id).maybeSingle())
      .then(async ({ data, error }) => {
        if (cancelled) return;
        // supabase-js reports a network/RLS failure as { data: null, error }, it
        // does not reject. Reading that as "no profile data" sent returning users
        // (reinstall + a flaky connection) back through onboarding. Treat it as
        // "unknown" and let the local-state fallback below decide.
        if (error) throw error;
        setNeedsAgeGate(!(data as { age_confirmed_at?: string | null } | null)?.age_confirmed_at);
        // The handle_new_user trigger always creates a profile row, so `data` is
        // essentially never null — trusting it exclusively meant a swallowed
        // pushProfile() failure at the end of onboarding (saveOnboardingData)
        // left the server's onboarding_completed_at permanently null, forcing
        // the user through onboarding again on every future launch even though
        // they'd already completed it (and, before the fix above, silently
        // resetting their local progress each time they did). Trust local
        // completion too, and retry the push instead of re-forcing onboarding.
        const localProfile = await getProfile().catch(() => undefined);
        const serverComplete = !!data?.onboarding_completed_at;
        const localComplete  = !!localProfile?.onboardingCompletedAt;

        if (serverComplete || localComplete) {
          setNeedsOnboarding(false);
          if (!serverComplete) pushProfile().catch(() => {});
          return;
        }
        setNeedsOnboarding(true);
      })
      .catch(async () => {
        if (cancelled) return;
        // Server unreachable: do not lock a returning runner out; the screen is asked again next launch.
        setNeedsAgeGate(false);
        // Unknown server state: finished onboarding on this phone counts.
        const localProfile = await getProfile().catch(() => undefined);
        if (localProfile?.onboardingCompletedAt) { setNeedsOnboarding(false); return; }
        return getPlayer()
          .then(player => setNeedsOnboarding(!player))
          .catch(() => setNeedsOnboarding(true));
      })
      .finally(() => { if (!cancelled) setCheckingOnboarding(false); });
    return () => { cancelled = true; };
  }, [user?.id]);

  // CRITICAL PATH: restores territory/profile/runs/saved routes from the server on
  // the signed-out→signed-in transition (fresh install, reinstall, new device).
  // Without this, a returning user's real claimed territory looks gone until they
  // finish another run. initialSync()'s pulls merge with local data — territory and
  // run records that are saved locally but not yet pushed are never overwritten (see
  // pullTerritories/pullRuns in sync.ts) — so this is safe to call on every sign-in,
  // including a brand-new signup where there is nothing yet to pull or push.
  // Guarded by ref (not just the [user?.id] dep) so React 18 StrictMode's dev-only
  // double-invoke of effects doesn't fire it twice for the same session.
  const initialSyncedUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user || initialSyncedUserIdRef.current === user.id) return;
    initialSyncedUserIdRef.current = user.id;
    ensureLocalDataBelongsTo(user.id).catch(() => false).then(() => initialSync()).catch(() => {});
    identify(user.id);
  }, [user?.id]);

  // A run saved offline used to wait for the next cold start (or the next run) to
  // upload. Retry whenever the app comes back to the foreground, at most once a
  // minute; pushUnsyncedRuns() already de-duplicates concurrent calls and is a
  // no-op when nothing is pending or the user is signed out.
  useEffect(() => {
    if (!user) return;
    let lastTry = 0;
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      const now = Date.now();
      if (now - lastTry < 60_000) return;
      lastTry = now;
      pushUnsyncedRuns().catch(() => {});
    });
    return () => sub.remove();
  }, [user?.id]);

  // Home area for the "near you" lists; waits for onboarding, which sets it first.
  // Finishing onboarding doesn't change needsOnboarding (that would reset the
  // navigator), so it's signalled separately.
  const [onboardedNow, setOnboardedNow] = useState(false);
  useEffect(() => onOnboardingComplete(() => setOnboardedNow(true)), []);
  useEffect(() => { setOnboardedNow(false); }, [user?.id]);
  useEffect(() => {
    if (!user || checkingOnboarding || (needsOnboarding && !onboardedNow)) return;
    return watchHomeArea();
  }, [user?.id, checkingOnboarding, needsOnboarding, onboardedNow]);

  // CRITICAL PATH (App.tsx auth): app_opened funnel event, fired once per mount after
  // auth/onboarding resolve — never blocks rendering, analytics wrapper never throws.
  const appOpenedTrackedRef = useRef(false);
  const authReadyForTracking = !loading && !checkingOnboarding;
  useEffect(() => {
    if (!authReadyForTracking || appOpenedTrackedRef.current) return;
    appOpenedTrackedRef.current = true;
    track('app_opened');
  }, [authReadyForTracking]);

  // Native Expo splash stays while fonts load; custom SplashView takes over after
  if (!fontsReady) return null;

  // v1 ships the mock's light design only; the saved dark-mode choice is kept for later.
  const isDark    = false;
  const authReady = !loading && !checkingOnboarding;

  return (
    <ThemeProvider isDark={isDark}>
      <View style={[styles.root, { backgroundColor: isDark ? '#0D0D0D' : '#F4F5F1' }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {authReady && user && needsAgeGate ? (
          <AgeGateScreen userId={user.id} onConfirmed={() => setNeedsAgeGate(false)} />
        ) : authReady && (
          <AppNavigator isAuthenticated={user !== null} needsOnboarding={needsOnboarding} />
        )}
        <AlertLayer />
        <CaptureHost />
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
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
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
  root: { flex: 1, backgroundColor: '#FFFFFF' },
});
