/**
 * Native (Expo) Supabase client.
 * - Reads credentials from EXPO_PUBLIC_SUPABASE_* environment variables.
 * - Uses expo-secure-store for token persistence (encrypted Keychain/Keystore).
 * - Disables URL-based session detection (no browser URL on mobile).
 *
 * Metro automatically picks this file on iOS/Android; Vite picks supabase.ts on web.
 */
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl  = process.env.EXPO_PUBLIC_SUPABASE_URL  ?? 'https://placeholder.supabase.co';
const supabaseAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key';

export const supabaseConfigured =
  !!process.env.EXPO_PUBLIC_SUPABASE_URL && !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * SecureStore-backed auth storage.
 * expo-secure-store limits key length to 255 chars and value length to 2048 chars.
 * Supabase's default storage key prefix is "sb-*", well within limits.
 */
const secureStorage = {
  getItem:    (key: string) => SecureStore.getItemAsync(key),
  setItem:    (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = createClient<any>(supabaseUrl, supabaseAnon, {
  auth: {
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: false,    // No URL on mobile
    storageKey:         'runivo-auth',
    storage:            secureStorage,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});
