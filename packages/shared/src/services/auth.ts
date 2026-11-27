import { supabase, authEmailClient } from './supabase';
import { clearLocalUserData } from './store';
import type { Session, User } from '@supabase/supabase-js';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------
export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

// ----------------------------------------------------------------
// Sign up with email + password
// Pass username in options.data — the DB trigger picks it up.
// ----------------------------------------------------------------
export async function signUp(email: string, password: string, username: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
    },
  });
  if (error) throw error;
  return data;
}

// ----------------------------------------------------------------
// Sign in with email + password
// ----------------------------------------------------------------
// `captchaToken` is threaded through so that turning on hCaptcha/Turnstile in the
// Supabase dashboard becomes a config change plus a widget, not a refactor of every
// auth call site. Server-side captcha + per-account rate limiting are the real
// brute-force controls; the client-side lockout in useLogin is only defence in depth.
export async function signIn(email: string, password: string, captchaToken?: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: captchaToken ? { captchaToken } : undefined,
  });
  if (error) throw error;
  return data;
}

// ----------------------------------------------------------------
// Sign out
// ----------------------------------------------------------------
// scope: 'global' revokes refresh tokens on every device, not just this one.
// Local data is cleared only after the server confirms — supabase-js keeps the
// session alive on a network failure, so wiping first would strand a still
// signed-in user with no data (same ordering as the native settingsService path).
export async function signOut() {
  const { error } = await supabase.auth.signOut({ scope: 'global' });
  if (error) throw error;
  clearLocalUserData();
}

// ----------------------------------------------------------------
// Get current session (sync — from memory/storage)
// ----------------------------------------------------------------
export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// ----------------------------------------------------------------
// Get current user
// ----------------------------------------------------------------
export async function getUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

// ----------------------------------------------------------------
// Listen to auth state changes
// Returns an unsubscribe function.
// ----------------------------------------------------------------
export function onAuthStateChange(callback: (state: AuthState) => void) {
  const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
    callback({
      user: session?.user ?? null,
      session,
      loading: false,
    });
  });
  return () => data.subscription.unsubscribe();
}

// ----------------------------------------------------------------
// Reset password (sends email)
// ----------------------------------------------------------------
// The canonical web page that can actually complete a password reset (native
// has no such screen, and no in-app deep-link handler for a recovery token).
// On native, `window` is a global polyfill (apps/mobile/index.ts) with
// `location.origin = ''`, so `typeof window !== 'undefined'` is true but
// produces a bare relative path '/reset-password' — a link the recovery
// email can't resolve to anything. Always target the real page unless a
// caller explicitly overrides it.
const RESET_PASSWORD_URL = 'https://runivo.in/reset-password';

// Sent via authEmailClient, not `supabase`: the native client is on the PKCE flow,
// which would produce a ?code= link redeemable only with a code_verifier stored on
// this phone — unusable from the browser that opens RESET_PASSWORD_URL. See
// supabase.native.ts. On web authEmailClient is just `supabase`.
export async function resetPassword(email: string, redirectTo?: string) {
  const { error } = await authEmailClient.auth.resetPasswordForEmail(email, {
    redirectTo: redirectTo ?? RESET_PASSWORD_URL,
  });
  if (error) throw error;
}
