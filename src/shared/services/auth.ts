import { supabase } from './supabase';
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
export async function signInWithProvider(provider: 'google' | 'apple') {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
  return data;
}

// ----------------------------------------------------------------
// Sign out
// ----------------------------------------------------------------
export async function signOut() {
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
export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}
