/**
 * safety-share — public live-location page for one activity (PRD R2).
 *
 *   GET /functions/v1/safety-share?t=<token>          → HTML page
 *   GET /functions/v1/safety-share?t=<token>&json=1   → latest position (polled)
 *
 * Deployed without JWT verification (anyone with the link may view):
 *   supabase functions deploy safety-share --no-verify-jwt
 * The token is the only key; the view function hides location 30 minutes
 * after the activity ends and returns nothing after 12 hours.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { renderPage, statusLine, type ShareView } from './page.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = (url.searchParams.get('t') ?? '').trim();
  const json = url.searchParams.get('json') === '1';
  let view: ShareView | null = null;
  if (/^[0-9a-f]{40,80}$/.test(token)) {
    const { data } = await admin.rpc('view_safety_share', { p_token: token });
    const row = (data as ShareView[] | null)?.[0];
    if (row) view = { ...row, distance_m: row.distance_m == null ? null : Number(row.distance_m) };
  }
  const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'no-referrer' };
  if (json) {
    return new Response(JSON.stringify(view ? { ...view, line: statusLine(view) } : null), {
      status: view ? 200 : 404, headers: { ...headers, 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
  const self = `${url.origin}${url.pathname}?t=${encodeURIComponent(token)}&json=1`;
  return new Response(renderPage(view, self), { status: view ? 200 : 404, headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
});
