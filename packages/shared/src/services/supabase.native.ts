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
    // PKCE, not the auth-js default of 'implicit'. Under implicit, signInWithOAuth
    // returns the access/refresh tokens in the redirect URL *fragment*, with nothing
    // binding the response to the app that started the flow. `runivo://` is a custom
    // scheme and on Android any installed app can claim it, so an interceptor got a
    // usable session. PKCE returns a one-time ?code= that is worthless without the
    // code_verifier held only by this client. Required by RFC 8252 for native apps.
    flowType:           'pkce',
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: false,    // No URL on mobile; socialAuth exchanges manually
    storageKey:         'runivo-auth',
    storage:            AsyncStorage,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

/**
 * Client used ONLY to send password-recovery emails. Not for anything else.
 *
 * Password reset is completed on the web page (https://runivo.app/reset-password —
 * there is no native reset screen; see resetPassword() in auth.ts). Under PKCE the
 * recovery link carries a ?code= that can only be redeemed with the code_verifier
 * stored on the device that requested it — which the browser on the web page cannot
 * reach, so the reset would dead-end as "invalid link". This client stays on the
 * implicit flow so the emailed link still carries recovery tokens the web page's
 * detectSessionInUrl can consume.
 *
 * persistSession:false + a distinct storageKey keep it from touching the real
 * session or the PKCE verifier above.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const authEmailClient = createClient<any>(supabaseUrl, supabaseAnon, {
  auth: {
    flowType:           'implicit',
    persistSession:     false,
    autoRefreshToken:   false,
    detectSessionInUrl: false,
    storageKey:         'runivo-auth-email',
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
