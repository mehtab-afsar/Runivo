import { createClient } from 'npm:@supabase/supabase-js@2';

// Proxies to redeem_reward(), a service_role-only RPC — the same pattern as
// process-run-territory: verify the caller's own JWT here, then act with the
// service-role client so the atomic balance debit isn't silently reverted by
// protect_profile_columns() (which only lets service_role write pace_balance).

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

  const body = await req.json().catch(() => null) as { rewardId?: string } | null;
  if (!body?.rewardId) {
    return new Response(JSON.stringify({ success: false, message: 'Missing rewardId' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data, error } = await supabase.rpc('redeem_reward', {
    p_user_id: user.id,
    p_reward_id: body.rewardId,
  });

  if (error) {
    return new Response(JSON.stringify({ success: false, message: 'Redemption failed. Please try again.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = (data as { success: boolean; message: string; new_balance: number | null; redemption_id: string | null }[])[0]
    ?? { success: false, message: 'Unknown error', new_balance: null, redemption_id: null };

  return new Response(JSON.stringify({
    success: result.success,
    message: result.message,
    newBalance: result.new_balance,
    redemptionId: result.redemption_id,
  }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
});
