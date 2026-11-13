import { adminRoute, serviceClient, json, oneOf } from '@/lib/adminServer';
import { partnerPayload, PARTNER_STATUSES } from '../fields';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = adminRoute(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const b = (await req.json()) as Record<string, unknown>;

  // Approve / reject an application: a status-only change that keeps every
  // other field the partner sent.
  if (Object.keys(b).length === 1 && 'status' in b) {
    const status = oneOf(b.status, PARTNER_STATUSES, 'applied');
    const now = new Date().toISOString();
    const { data, error } = await serviceClient()
      .from('partners').update({ status, reviewed_at: now, updated_at: now }).eq('id', id).select().single();
    if (error) return json({ error: 'Could not update the partner.' }, 400);
    return json({ partner: data });
  }

  const p = partnerPayload(b);
  if (!p.name) return json({ error: 'Partner name is required' }, 400);
  const { data, error } = await serviceClient()
    .from('partners').update({ ...p, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) return json({ error: error.message }, 400);
  return json({ partner: data });
});
