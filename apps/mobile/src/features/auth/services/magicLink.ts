/**
 * Magic-link sign-in. The email link opens runivo://auth/magic?code=…
 * (PKCE: the code is useless without the verifier this device kept when it
 * asked for the link). Google sign-in uses runivo://auth/callback and is
 * handled by its own browser session, so the two never race.
 *
 * Installed once at import (LoginScreen imports it, and the navigator imports
 * LoginScreen at launch), so a link that cold-starts the app is handled too.
 */
import { Linking } from 'react-native';
import { supabase } from '@shared/services/supabase';

export const MAGIC_LINK_REDIRECT = 'runivo://auth/magic';

type Listener = (result: { ok: true } | { ok: false; error: string }) => void;
const listeners = new Set<Listener>();
const handled = new Set<string>();

/** Hear about magic-link results (e.g. to show an error on the sign-in screen). */
export function onMagicLinkResult(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function emit(result: Parameters<Listener>[0]) {
  listeners.forEach(fn => fn(result));
}

/** Returns true if the URL was a magic link (whatever the outcome). */
export async function handleMagicLinkUrl(url: string | null): Promise<boolean> {
  if (!url) return false;
  let parsed: URL;
  try { parsed = new URL(url); } catch { return false; }
  const isMagic = parsed.protocol === 'runivo:' && `${parsed.host}${parsed.pathname}`.replace(/\/+$/, '') === 'auth/magic';
  if (!isMagic) return false;

  const code = parsed.searchParams.get('code');
  const key = code ?? url;
  if (handled.has(key)) return true; // the same link can arrive twice (initial URL + event)
  handled.add(key);

  const linkError = parsed.searchParams.get('error_description') ?? parsed.searchParams.get('error');
  if (linkError) { emit({ ok: false, error: 'That link has expired. Ask for a new one.' }); return true; }

  // A magic link is only ever requested from the signed-out sign-in screen. If a
  // session already exists, a link arriving from elsewhere (a web page, a QR
  // code, another app) must not be able to swap the account under the user.
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session) return true;
  } catch { /* treat as signed out; the PKCE exchange below still needs our verifier */ }

  try {
    // PKCE only. The code is useless without the verifier this device stored
    // when it asked for the link, so a link crafted by someone else can't log
    // this phone into their account. A bare token_hash has no such binding and
    // is deliberately NOT accepted (security audit H2).
    if (!code) throw new Error('missing code');
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    emit({ ok: true });
  } catch {
    emit({ ok: false, error: 'That link didn\'t work on this phone. Enter the 6-digit code from the email instead.' });
  }
  return true;
}

let installed = false;
export function installMagicLinkHandler(): void {
  if (installed) return;
  installed = true;
  Linking.getInitialURL().then(handleMagicLinkUrl).catch(() => {});
  Linking.addEventListener('url', ({ url }) => { handleMagicLinkUrl(url).catch(() => {}); });
}

installMagicLinkHandler();
