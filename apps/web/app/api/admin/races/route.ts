import { adminRoute, serviceClient, json } from '@/lib/adminServer';

export const dynamic = 'force-dynamic';

/** Runner-added races waiting for review, soonest first, with how many have entered. */
export const GET = adminRoute(async () => {
  const { data, error } = await serviceClient()
    .from('races')
    .select('id, name, city, starts_on, website_url, created_at, race_distances(label, race_entries(count))')
    .eq('source', 'runner').eq('status', 'pending')
    .gte('starts_on', new Date().toISOString().slice(0, 10))
    .order('starts_on', { ascending: true })
    .limit(200);
  if (error) return json({ error: error.message }, 500);
  return json({ races: data ?? [] });
});

/** { id, approve } → approved into the catalogue, or rejected (stays private to its author). */
export const POST = adminRoute(async (req) => {
  const { id, approve } = (await req.json()) as { id?: string; approve?: boolean };
  if (!id || typeof approve !== 'boolean') return json({ error: 'id and approve are required' }, 400);
  const { data, error } = await serviceClient()
    .from('races')
    .update({ status: approve ? 'approved' : 'rejected', checked_at: new Date().toISOString() })
    .eq('id', id).eq('source', 'runner').eq('status', 'pending')
    .select('id').maybeSingle();
  if (error) return json({ error: error.message }, 400);
  if (!data) return json({ error: 'Already reviewed' }, 409);
  return json({ ok: true });
});
