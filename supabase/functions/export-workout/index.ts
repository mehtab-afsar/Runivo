/**
 * export-workout (T7): sends a training-plan session to the runner's Garmin
 * (Training API) and schedules it on its date, so it shows on the watch.
 *
 *   POST { sessionId }  with the runner's JWT
 *
 * Needs GARMIN_CONSUMER_KEY / GARMIN_CONSUMER_SECRET and Garmin's approval of
 * the Training API (workout import) for this app. Apple Watch export is done
 * on the phone with WorkoutKit (native), not here.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHmac } from 'node:crypto';
import { toGarminWorkout, type Session } from './garminWorkout.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });

function oauthHeader(method: string, url: string, key: string, secret: string, token: string, tokenSecret: string): string {
  const p: Record<string, string> = {
    oauth_consumer_key: key, oauth_nonce: crypto.randomUUID().replace(/-/g, ''), oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)), oauth_token: token, oauth_version: '1.0',
  };
  const base = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(Object.entries(p).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&'))}`;
  p.oauth_signature = createHmac('sha1', `${encodeURIComponent(secret)}&${encodeURIComponent(tokenSecret)}`).update(base).digest('base64');
  return 'OAuth ' + Object.entries(p).map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`).join(', ');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
  const { data: { user } } = await admin.auth.getUser(jwt);
  if (!user) return json({ error: 'unauthorized' }, 401);
  const { sessionId } = await req.json().catch(() => ({})) as { sessionId?: string };
  if (!sessionId) return json({ error: 'missing_session' }, 400);

  const { data: plan } = await admin.from('training_plans').select('plan_data').eq('user_id', user.id).eq('status', 'active').maybeSingle();
  const weeks = ((plan?.plan_data as { weeks?: { sessions: Session[] }[] } | null)?.weeks) ?? [];
  const session = weeks.flatMap(w => w.sessions).find(s => s.id === sessionId);
  if (!session) return json({ error: 'session_not_found' }, 404);

  const { data: conn } = await admin.from('device_connections').select('secrets, status').eq('user_id', user.id).eq('device_type', 'garmin').maybeSingle();
  const sec = (conn?.secrets ?? {}) as { access_token?: string; token_secret?: string };
  if (conn?.status !== 'connected' || !sec.access_token) return json({ error: 'garmin_not_connected' }, 409);
  const key = Deno.env.get('GARMIN_CONSUMER_KEY') ?? '', secret = Deno.env.get('GARMIN_CONSUMER_SECRET') ?? '';

  const wUrl = 'https://apis.garmin.com/training-api/workout';
  const res = await fetch(wUrl, {
    method: 'POST',
    headers: { Authorization: oauthHeader('POST', wUrl, key, secret, sec.access_token, sec.token_secret ?? ''), 'Content-Type': 'application/json' },
    body: JSON.stringify(toGarminWorkout(session)),
  });
  if (res.status === 403 || res.status === 401) return json({ error: 'garmin_permission', detail: 'Reconnect Garmin and allow workout import.' }, 403);
  if (!res.ok) return json({ error: 'garmin_failed', detail: await res.text() }, 502);
  const { workoutId } = await res.json() as { workoutId: number };

  const sUrl = 'https://apis.garmin.com/training-api/schedule';
  await fetch(sUrl, {
    method: 'POST',
    headers: { Authorization: oauthHeader('POST', sUrl, key, secret, sec.access_token, sec.token_secret ?? ''), 'Content-Type': 'application/json' },
    body: JSON.stringify({ workoutId, date: session.date }),
  }).catch(() => null);
  return json({ ok: true, workoutId });
});
