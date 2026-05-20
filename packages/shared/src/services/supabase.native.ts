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
