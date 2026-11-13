/**
 * Safety share (PRD R2): a live link for this activity that anyone can open
 * in a browser, no app needed. You choose who gets it in the share sheet.
 */
import { Share } from 'react-native';
import { supabase } from '@shared/services/supabase';

const PUSH_EVERY_MS = 15_000;

let token: string | null = null;
let lastPush = 0;

export const isSharing = () => token != null;

export function shareUrl(t: string): string {
  return `${process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''}/functions/v1/safety-share?t=${t}`;
}

/** Starts (or reuses) the share for this run and opens the share sheet. */
export async function startAndSendSafetyShare(runId: string, sport: string, verb: string): Promise<boolean> {
  if (!token) {
    const { data, error } = await supabase.rpc('start_safety_share', { p_run_id: runId, p_sport: sport });
    if (error || typeof data !== 'string') throw new Error(error?.message ?? 'could not start');
    token = data;
    lastPush = 0;
  }
  const url = shareUrl(token);
  await Share.share({ message: `Follow my ${verb} live on Runivo: ${url}`, url });
  return true;
}

/** Throttled to every 15 s; quiet on errors (the run must never be affected). */
export function pushSafetyPosition(p: { lat: number; lng: number }, distanceM: number, elapsedSec: number, force = false): void {
  if (!token) return;
  const now = Date.now();
  if (!force && now - lastPush < PUSH_EVERY_MS) return;
  lastPush = now;
  void supabase.rpc('update_safety_share', {
    p_token: token, p_lat: p.lat, p_lng: p.lng, p_distance_m: Math.round(distanceM), p_elapsed_sec: Math.round(elapsedSec),
  });
}

export async function endSafetyShare(): Promise<void> {
  const t = token;
  token = null;
  if (t) await supabase.rpc('end_safety_share', { p_token: t }).then(() => {}, () => {});
}
