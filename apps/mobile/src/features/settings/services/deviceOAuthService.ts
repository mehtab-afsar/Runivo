/**
 * Garmin / COROS / Polar connection through the device-oauth edge function.
 * Shared by Settings → Connected devices and the onboarding watch step.
 */
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@shared/services/supabase';

export const OAUTH_REDIRECT = 'runivo://settings/devices';

async function getSupabaseFnUrl(path: string): Promise<string> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  return `${supabaseUrl}/functions/v1/${path}`;
}

export async function getOAuthAuthUrl(provider: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');
  const fnUrl = await getSupabaseFnUrl(`device-oauth?provider=${provider}&action=authorize`);
  const res = await fetch(fnUrl, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  const { url } = await res.json() as { url: string };
  return url;
}

export async function completeOAuthCallback(
  provider: string,
  params: { code?: string; state?: string; oauth_token?: string; oauth_verifier?: string },
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');
  const fnUrl = await getSupabaseFnUrl('device-oauth');
  const res = await fetch(fnUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body:    JSON.stringify({ provider, action: 'callback', ...params }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function disconnectOAuth(provider: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const fnUrl = await getSupabaseFnUrl('device-oauth');
  await fetch(fnUrl, {
    method:  'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body:    JSON.stringify({ provider }),
  });
}


/**
 * Runs the whole connection in an in-app browser and returns when it's done:
 * 'connected', 'cancelled', or throws with the provider's error.
 */
export async function connectProvider(provider: string): Promise<'connected' | 'cancelled'> {
  const authUrl = await getOAuthAuthUrl(provider);
  const res = await WebBrowser.openAuthSessionAsync(authUrl, OAUTH_REDIRECT);
  if (res.type !== 'success' || !res.url) return 'cancelled';
  const parsed = new URL(res.url.replace('runivo://', 'https://runivo.in/'));
  const q = (k: string) => parsed.searchParams.get(k) ?? undefined;
  if (q('error')) throw new Error(`Couldn't connect ${provider}`);
  await completeOAuthCallback(provider, { code: q('code'), state: q('state'), oauth_token: q('oauth_token'), oauth_verifier: q('oauth_verifier') });
  return 'connected';
}
