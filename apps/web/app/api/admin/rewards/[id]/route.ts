import { adminRoute, serviceClient, json, num } from '@/lib/adminServer';
import { rewardPayload, rewardProblem } from '../fields';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = adminRoute(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await req.json() as Record<string, unknown>;
  const db = serviceClient();
  // Reorder only.
  if (Object.keys(body).length === 1 && 'sort_order' in body) {
    const { error } = await db.from('pace_store_rewards').update({ sort_order: Math.round(num(body.sort_order) ?? 0) }).eq('id', id);
    return error ? json({ error: error.message }, 400) : json({ ok: true });
  }
  const p = rewardPayload(body);
  const problem = rewardProblem(p);
  if (problem) return json({ error: problem }, 400);
  const { data, error } = await db.from('pace_store_rewards').update(p).eq('id', id).select().single();
  if (error) return json({ error: error.message }, 400);
  return json({ reward: data });
});

export const DELETE = adminRoute(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const db = serviceClient();
  // Rewards someone has redeemed keep their history: hide instead of delete.
  const { count } = await db.from('pace_redemptions').select('id', { count: 'exact', head: true }).eq('reward_id', id);
  if ((count ?? 0) > 0) {
    const { error } = await db.from('pace_store_rewards').update({ status: 'hidden' }).eq('id', id);
    return error ? json({ error: error.message }, 400) : json({ ok: true, hidden: true });
  }
  const { error } = await db.from('pace_store_rewards').delete().eq('id', id);
  return error ? json({ error: error.message }, 400) : json({ ok: true });
});
