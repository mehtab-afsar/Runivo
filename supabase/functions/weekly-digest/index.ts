/**
 * weekly-digest (N5): emails last week's numbers to runners who turned push
 * off but kept the weekly summary. Run once a week (Monday morning) from a
 * Supabase scheduled job:
 *   select net.http_post(url := '<project>/functions/v1/weekly-digest', headers := '{"Authorization":"Bearer <service key>"}');
 * Needs RESEND_API_KEY and DIGEST_FROM (e.g. "Runivo <hello@runivo.app>").
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { digestHtml, digestSubject, type DigestRow } from './email.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  // Only the scheduler (service role) may trigger a send.
  const auth = req.headers.get('Authorization') ?? '';
  if (auth !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) return new Response('Forbidden', { status: 403 });
  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('DIGEST_FROM');
  if (!key || !from) return new Response(JSON.stringify({ error: 'email_not_configured' }), { status: 500 });

  const { data, error } = await admin.rpc('weekly_digest_rows');
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  const rows = (data ?? []) as (DigestRow & { email: string })[];
  let sent = 0, failed = 0;
  for (const r of rows) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: r.email, subject: digestSubject(r), html: digestHtml(r, 'runivo://', 'runivo://settings') }),
    }).catch(() => null);
    if (res?.ok) sent++; else failed++;
  }
  return new Response(JSON.stringify({ sent, failed }), { headers: { 'Content-Type': 'application/json' } });
});
