import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  || 'https://placeholder.supabase.co';
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabaseConfigured =
  !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Single Supabase client instance for the entire app.
 * When VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set the client is
 * initialised with placeholder values so that all modules load successfully.
 * Network calls will silently fail — the app runs fully on local IndexedDB.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = createClient<any>(supabaseUrl, supabaseAnon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'runivo-auth',
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

/**
 * Web twin of the native `authEmailClient`. On web the recovery link is opened in the
 * same browser that requested it, so the ordinary client can complete the flow — this
 * is just an alias that lets shared code (auth.ts) call the same symbol on both
 * platforms. See supabase.native.ts for why native needs a separate instance.
 */
export const authEmailClient = supabase;
