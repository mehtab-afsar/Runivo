/**
 * Invite links: runivo://invite?code=ABCD2345 (and https://runivo.app/invite?code=…).
 * The code is kept on the phone until someone is signed in, then used once
 * (redeem_referral). The server decides whether it counts (new accounts only,
 * not your own, once), so a stray link can do no more than a typed code.
 */
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@shared/services/supabase';

const KEY = 'runivo.pendingInviteCode';
const CODE_RE = /^[A-Z0-9]{6,12}$/;

/** The invite code in a URL, or null when the URL isn't an invite link. */
export function inviteCodeFromUrl(url: string | null): string | null {
  if (!url) return null;
  let u: URL;
  try { u = new URL(url); } catch { /* Not a parseable URL, so it carries no invite code. */ return null; }
  const path = `${u.host}${u.pathname}`.replace(/\/+$/, '');
  const isInvite = (u.protocol === 'runivo:' && path === 'invite')
    || (u.protocol === 'https:' && path === 'runivo.app/invite');
  if (!isInvite) return null;
  const code = (u.searchParams.get('code') ?? '').trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

async function redeemPending(): Promise<void> {
  const code = await AsyncStorage.getItem(KEY).catch(() => null);
  if (!code) return;
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) return;
  const { error } = await supabase.rpc('redeem_referral', { p_code: code });
  // Any answer from the server (ok, already, too_late…) is final; keep it only on a network error.
  if (!error) await AsyncStorage.removeItem(KEY).catch(() => {});
}

async function onUrl(url: string | null) {
  const code = inviteCodeFromUrl(url);
  if (!code) return;
  await AsyncStorage.setItem(KEY, code).catch(() => {});
  await redeemPending();
}

let installed = false;
export function installInviteLinkHandler(): void {
  if (installed) return;
  installed = true;
  Linking.getInitialURL().then(onUrl).catch(() => {});
  Linking.addEventListener('url', ({ url }) => { onUrl(url).catch(() => {}); });
  supabase.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_IN') redeemPending().catch(() => {});
  });
}

installInviteLinkHandler();
