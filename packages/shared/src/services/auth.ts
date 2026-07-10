import { supabase } from './supabase';
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
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

// ----------------------------------------------------------------
// OAuth sign-in (Google, Apple)
// ----------------------------------------------------------------
export async function signInWithProvider(provider: 'google' | 'apple', redirectTo?: string) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: redirectTo ?? (typeof window !== 'undefined' ? window.location.origin : undefined) },
  });
  if (error) throw error;
  return data;
}

// ----------------------------------------------------------------
// Sign out
// ----------------------------------------------------------------
export async function signOut() {
  clearLocalUserData();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
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
const RESET_PASSWORD_URL = 'https://runivo.app/reset-password';

export async function resetPassword(email: string, redirectTo?: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectTo ?? RESET_PASSWORD_URL,
  });
  if (error) throw error;
}
