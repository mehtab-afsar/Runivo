import { adminRoute, serviceClient, json } from '@/lib/adminServer';

export const dynamic = 'force-dynamic';

/** GET /api/admin/reports?partner=<id>&month=YYYY-MM */
export const GET = adminRoute(async (req) => {
  const url = new URL(req.url);
  const partner = url.searchParams.get('partner');
  const month = url.searchParams.get('month');
  if (!partner || !month || !/^\d{4}-\d{2}$/.test(month)) return json({ error: 'partner and month (YYYY-MM) are required' }, 400);
  const { data, error } = await serviceClient().rpc('partner_monthly_report', { p_partner_id: partner, p_month: `${month}-01` });
  if (error) return json({ error: error.message }, 400);
  if (!data) return json({ error: 'Partner not found' }, 404);
  return json({ report: data });
});
