import { adminRoute, serviceClient, json } from '@/lib/adminServer';
import { campaignPayload, campaignProblem } from './fields';

export const dynamic = 'force-dynamic';

export const GET = adminRoute(async () => {
  const { data, error } = await serviceClient().from('notification_campaigns').select('*').order('send_at', { ascending: false }).limit(200);
  if (error) return json({ error: error.message }, 500);
  return json({ campaigns: data ?? [] });
});

export const POST = adminRoute(async (req) => {
  const p = campaignPayload(await req.json());
  const problem = campaignProblem(p);
  if (problem) return json({ error: problem }, 400);
  const { data, error } = await serviceClient().from('notification_campaigns').insert(p).select().single();
  if (error) return json({ error: error.message }, 400);
  return json({ campaign: data }, 201);
});
