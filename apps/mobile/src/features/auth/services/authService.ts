import { signIn as sharedSignIn, signUp as sharedSignUp, resetPassword as sharedResetPassword } from '@shared/services/auth';
import { supabase } from '@shared/services/supabase';
import { MAGIC_LINK_REDIRECT } from './magicLink';

export async function signIn(email: string, password: string, captchaToken?: string): Promise<void> {
  await sharedSignIn(email, password, captchaToken);
}

// Returns whether the account needs email confirmation before it can sign in
// (Supabase returns session: null in that case — App.tsx's auth listener never
// fires and the screen would otherwise sit there with a stopped spinner and no
// explanation).
export async function signUp(email: string, password: string, username: string): Promise<{ needsEmailConfirmation: boolean }> {
  const data = await sharedSignUp(email, password, username);
  return { needsEmailConfirmation: data.session === null };
}

export async function resetPassword(email: string): Promise<void> {
  await sharedResetPassword(email);
}

// ── Passwordless sign-in (v1) ────────────────────────────────────────────────
// Phone numbers get a 6-digit SMS code; email gets a magic link (which also
// carries the same 6-digit code, for when the link opens on another device).
// The first sign-in creates the account, so there is no separate sign-up.


export async function sendPhoneCode(e164: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ phone: e164, options: { channel: 'sms' } });
  if (error) throw new Error(friendlyAuthError(error.message));
}

export async function verifyPhoneCode(e164: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ phone: e164, token: code, type: 'sms' });
  if (error) throw new Error(friendlyAuthError(error.message));
}

export async function sendEmailLink(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: MAGIC_LINK_REDIRECT, shouldCreateUser: true },
  });
  if (error) throw new Error(friendlyAuthError(error.message));
}

export async function verifyEmailCode(email: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: 'email' });
  if (error) throw new Error(friendlyAuthError(error.message));
}

/** Supabase's messages are written for developers; runners get plain ones. */
export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('expired') || (m.includes('invalid') && m.includes('token'))) return 'That code has expired or is wrong. Ask for a new one.';
  if (m.includes('rate limit') || m.includes('too many') || m.includes('security purposes')) return 'Too many attempts. Wait a minute and try again.';
  if (m.includes('phone') && (m.includes('provider') || m.includes('unsupported') || m.includes('disabled'))) return 'Phone sign-in isn\'t available yet. Use email instead.';
  if (m.includes('signups not allowed')) return 'New sign-ups are paused right now.';
  if (m.includes('network') || m.includes('fetch')) return 'No connection. Check your internet and try again.';
  return message;
}
