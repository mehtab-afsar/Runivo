import { adminRoute, serviceClient, json } from '@/lib/adminServer';
import { partnerPayload } from './fields';

export const dynamic = 'force-dynamic';

export const GET = adminRoute(async () => {
  const { data, error } = await serviceClient().from('partners').select('*').order('created_at', { ascending: false });
  if (error) return json({ error: error.message }, 500);
  return json({ partners: data ?? [] });
});

export const POST = adminRoute(async (req) => {
  const p = partnerPayload(await req.json());
  if (!p.name) return json({ error: 'Partner name is required' }, 400);
  const { data, error } = await serviceClient().from('partners').insert(p).select().single();
  if (error) return json({ error: error.message }, 400);
  return json({ partner: data }, 201);
});
