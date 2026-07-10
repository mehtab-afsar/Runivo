/**
 * Native (Expo) Supabase client.
 * - Reads credentials from EXPO_PUBLIC_SUPABASE_* environment variables.
 * - Uses AsyncStorage for session persistence (no size limit — SecureStore
 *   has a 2048-char value cap which Supabase session JSON routinely exceeds,
 *   causing setItem to fail silently and forcing login on every restart).
 * - Disables URL-based session detection (no browser URL on mobile).
 *
 * Metro automatically picks this file on iOS/Android; Vite picks supabase.ts on web.
 */
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

const supabaseUrl  = process.env.EXPO_PUBLIC_SUPABASE_URL  ?? 'https://placeholder.supabase.co';
const supabaseAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key';

export const supabaseConfigured =
  !!process.env.EXPO_PUBLIC_SUPABASE_URL && !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = createClient<any>(supabaseUrl, supabaseAnon, {
  auth: {
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: false,    // No URL on mobile
    storageKey:         'runivo-auth',
    storage:            AsyncStorage,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

// supabase-js's autoRefreshToken relies on a running timer, which the OS suspends
// while the app is backgrounded — without this, a session that expires during a
// long background period isn't refreshed until *something* triggers it, causing
// the first request(s) after foregrounding to fail with 401 until the next refresh
// tick. This is the documented React Native pattern.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
