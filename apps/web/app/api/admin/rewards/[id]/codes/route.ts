import { adminRoute, serviceClient, json } from '@/lib/adminServer';
import { parseCodes } from '@/lib/csvCodes';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const MAX_CODES = 20_000;

export const GET = adminRoute(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const db = serviceClient();
  const [{ count: total }, { count: assigned }] = await Promise.all([
    db.from('reward_codes').select('id', { count: 'exact', head: true }).eq('reward_id', id),
    db.from('reward_codes').select('id', { count: 'exact', head: true }).eq('reward_id', id).not('assigned_to', 'is', null),
  ]);
  return json({ total: total ?? 0, assigned: assigned ?? 0, left: (total ?? 0) - (assigned ?? 0) });
});

export const POST = adminRoute(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { csv } = await req.json() as { csv?: string };
  const codes = parseCodes(csv ?? '');
  if (codes.length === 0) return json({ error: 'No codes found. Put one code per line (first column).' }, 400);
  if (codes.length > MAX_CODES) return json({ error: `At most ${MAX_CODES} codes per upload` }, 400);

  const db = serviceClient();
  const { data: reward } = await db.from('pace_store_rewards').select('id, code_mode').eq('id', id).single();
  if (!reward) return json({ error: 'Reward not found' }, 404);
  if (reward.code_mode !== 'pool') return json({ error: 'Set the reward to "Code pool" before uploading codes' }, 400);

  let added = 0;
  for (let i = 0; i < codes.length; i += 1000) {
    const chunk = codes.slice(i, i + 1000).map(code => ({ reward_id: id, code }));
    const { data, error } = await db.from('reward_codes')
      .upsert(chunk, { onConflict: 'reward_id,code', ignoreDuplicates: true })
      .select('id');
    if (error) return json({ error: error.message, added }, 400);
    added += data?.length ?? 0;
  }
  return json({ received: codes.length, added, duplicates: codes.length - added });
});
