import { adminRoute, serviceClient, json } from '@/lib/adminServer';
import { rewardPayload, rewardProblem } from './fields';

export const dynamic = 'force-dynamic';

export const GET = adminRoute(async () => {
  const db = serviceClient();
  const { data, error } = await db.from('pace_store_rewards').select('*').order('sort_order', { ascending: true });
  if (error) return json({ error: error.message }, 500);
  // Codes left / given out per pool reward.
  const { data: codes } = await db.from('reward_codes').select('reward_id, assigned_to');
  const counts: Record<string, { total: number; assigned: number }> = {};
  for (const c of codes ?? []) {
    const k = c.reward_id as string;
    counts[k] ??= { total: 0, assigned: 0 };
    counts[k].total++;
    if (c.assigned_to) counts[k].assigned++;
  }
  return json({ rewards: data ?? [], codeCounts: counts });
});

export const POST = adminRoute(async (req) => {
  const p = rewardPayload(await req.json());
  const problem = rewardProblem(p);
  if (problem) return json({ error: problem }, 400);
  const { data, error } = await serviceClient().from('pace_store_rewards').insert(p).select().single();
  if (error) return json({ error: error.message }, 400);
  return json({ reward: data }, 201);
});
