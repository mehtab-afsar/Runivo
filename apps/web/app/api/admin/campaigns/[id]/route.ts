import { adminRoute, serviceClient, json } from '@/lib/adminServer';
import { campaignPayload, campaignProblem } from '../fields';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** Edit a campaign that hasn't gone out, or cancel any scheduled one ({ status: 'cancelled' }). */
export const PATCH = adminRoute(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await req.json() as Record<string, unknown>;
  const db = serviceClient();
  const { data: current } = await db.from('notification_campaigns').select('status, sent_count').eq('id', id).single();
  if (!current) return json({ error: 'Campaign not found' }, 404);

  if (Object.keys(body).length === 1 && body.status === 'cancelled') {
    if (current.status === 'done') return json({ error: 'This campaign has already finished' }, 400);
    const { error } = await db.from('notification_campaigns').update({ status: 'cancelled' }).eq('id', id);
    return error ? json({ error: error.message }, 400) : json({ ok: true });
  }
  if (current.sent_count > 0) return json({ error: 'This campaign has started sending; cancel it and create a new one' }, 400);
  const p = campaignPayload(body);
  const problem = campaignProblem(p);
  if (problem) return json({ error: problem }, 400);
  const { data, error } = await db.from('notification_campaigns').update(p).eq('id', id).select().single();
  if (error) return json({ error: error.message }, 400);
  return json({ campaign: data });
});
