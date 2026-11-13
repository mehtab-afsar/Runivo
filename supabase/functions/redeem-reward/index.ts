import { createClient } from 'npm:@supabase/supabase-js@2';

// Proxies to redeem_reward(), a service_role-only RPC: verify the caller's
// own JWT here, then act with the service-role client. Every rule (live
// dates, region, Plus-only, rank gate, 14 days + 3 runs, one per runner,
// stock, code pool, balance) lives in the database function, atomically.

export type RedeemReason =
  | 'not_found' | 'profile_not_found' | 'not_available' | 'not_started' | 'expired'
  | 'not_in_region' | 'already_redeemed' | 'plus_only' | 'rank_locked' | 'new_account'
  | 'sold_out' | 'not_enough_pace';

export const REASON_MESSAGES: Record<RedeemReason, string> = {
  not_found:         'This reward no longer exists.',
  profile_not_found: 'We couldn\'t find your profile. Try signing in again.',
  not_available:     'This reward isn\'t available right now.',
  not_started:       'This reward isn\'t live yet.',
  expired:           'This reward has ended.',
  not_in_region:     'This reward is only for runners in another city or country.',
  already_redeemed:  'You\'ve already redeemed this reward.',
  plus_only:         'This reward is for Runivo Plus members.',
  rank_locked:       'Reach the required rank to unlock this reward.',
  new_account:       'Rewards unlock after 3 runs and 14 days on Runivo.',
  sold_out:          'This reward has run out.',
  not_enough_pace:   'You don\'t have enough PACE for this reward yet.',
};

const JSON_HEADERS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (authErr || !user) return new Response('Unauthorized', { status: 401 });

  const body = await req.json().catch(() => null) as { rewardId?: string; lat?: unknown; lng?: unknown } | null;
  if (!body?.rewardId) {
    return json({ success: false, reason: 'not_found', message: 'Missing rewardId' }, 400);
  }

  // The device's last known position, for city-limited rewards when the
  // profile has no saved location. Used for this check only, never stored;
  // the database ignores anything that isn't a real coordinate.
  const lat = typeof body.lat === 'number' && Number.isFinite(body.lat) ? body.lat : null;
  const lng = typeof body.lng === 'number' && Number.isFinite(body.lng) ? body.lng : null;

  const { data, error } = await supabase.rpc('redeem_reward', {
    p_user_id: user.id,
    p_reward_id: body.rewardId,
    ...(lat !== null && lng !== null && { p_lat: lat, p_lng: lng }),
  });

  if (error || !data) {
    return json({ success: false, reason: null, message: 'Redemption failed. Please try again.' }, 500);
  }

  const result = data as {
    ok: boolean; reason: RedeemReason | null; code?: string | null; how_to_use?: string | null;
    balance?: number | null; redemption_id?: string | null;
  };

  if (!result.ok) {
    const reason = result.reason ?? 'not_available';
    return json({
      success: false,
      reason,
      message: REASON_MESSAGES[reason] ?? 'This reward isn\'t available right now.',
      newBalance: result.balance ?? null,
    });
  }

  // Held for review (20261113000009): never hand out the code until staff approve.
  let held = false;
  if (result.redemption_id) {
    const { data: red } = await supabase.from('pace_redemptions').select('review_status').eq('id', result.redemption_id).maybeSingle();
    held = red?.review_status === 'held';
  }

  return json({
    success: true,
    reason: null,
    held,
    message: held ? 'Redeemed. We check some accounts before sending a code; yours will arrive within 48 hours.'
      : result.code ? 'Redeemed. Here\'s your code.' : 'Redeemed.',
    code: held ? null : (result.code ?? null),
    howToUse: result.how_to_use ?? null,
    newBalance: result.balance ?? null,
    redemptionId: result.redemption_id ?? null,
  });
});
