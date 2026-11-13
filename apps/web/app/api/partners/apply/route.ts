import { serviceClient, str, num, list, json } from '@/lib/adminServer';
import { PARTNER_CATEGORIES } from '@/app/api/admin/partners/fields';

export const dynamic = 'force-dynamic';

/**
 * Public partner application (runivo.app/partners). No sign-in: it writes
 * one partners row with status 'applied' through submit_partner_application,
 * which validates again and caps applications per email per day. The team
 * reviews it in the admin. Errors are never returned verbatim.
 */

// Simple per-IP limit: 5 applications per 10 minutes per server instance.
// The database cap (3 per email per day) is the real guard.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string, now = Date.now()): boolean {
  const recent = (hits.get(ip) ?? []).filter(t => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) { hits.set(ip, recent); return true; }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every(t => now - t >= WINDOW_MS)) hits.delete(k);
  }
  return false;
}

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0] : req.headers.get('x-real-ip') ?? 'unknown').trim();
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    const raw = await req.json();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('bad body');
    body = raw as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'Please send the form again.' }, 400);
  }

  // Honeypot: real people never fill the hidden "company_url" field.
  // Answer as if it worked so bots learn nothing.
  if (typeof body.company_url === 'string' && body.company_url.trim() !== '') {
    return json({ ok: true });
  }

  if (rateLimited(clientIp(req))) {
    return json({ ok: false, error: 'Too many applications from here. Try again in a few minutes.' }, 429);
  }

  const name = str(body.name, 120);
  const category = typeof body.category === 'string' && (PARTNER_CATEGORIES as readonly string[]).includes(body.category)
    ? body.category : null;
  const contactName = str(body.contact_name, 120);
  const email = str(body.contact_email, 200)?.toLowerCase() ?? null;
  const websiteRaw = str(body.website, 300);
  const website = websiteRaw && /^https?:\/\//i.test(websiteRaw) ? websiteRaw : websiteRaw ? `https://${websiteRaw}` : null;
  const countries = list(body.countries, 20)?.map(c => c.toUpperCase().slice(0, 2)).filter(c => /^[A-Z]{2}$/.test(c)) ?? null;
  const cities = list(body.cities, 50)?.map(c => c.slice(0, 60)) ?? null;
  const offer = str(body.offer, 1000);
  const stockN = num(body.estimated_stock);
  const stock = stockN === null ? null : Math.max(0, Math.min(1_000_000, Math.round(stockN)));

  const missing: string[] = [];
  if (!name || name.length < 2) missing.push('company name');
  if (!category) missing.push('category');
  if (!email || !EMAIL_RE.test(email)) missing.push('a valid email');
  if (!offer || offer.length < 5) missing.push('your offer');
  if (missing.length) {
    return json({ ok: false, error: `Please add ${missing.join(', ')}.` }, 400);
  }

  try {
    const { error } = await serviceClient().rpc('submit_partner_application', {
      p_name: name,
      p_category: category,
      p_contact_name: contactName,
      p_contact_email: email,
      p_website: website,
      p_countries: countries && countries.length ? countries : null,
      p_cities: cities && cities.length ? cities : null,
      p_offer: offer,
      p_estimated_stock: stock,
    });
    if (error) {
      if (/rate_limited/.test(error.message)) {
        return json({ ok: false, error: 'We already have your applications from today. We’ll be in touch.' }, 429);
      }
      if (/invalid/.test(error.message)) {
        return json({ ok: false, error: 'Some details look wrong. Check the form and try again.' }, 400);
      }
      console.error('[partners/apply]', error.message);
      return json({ ok: false, error: 'Something went wrong. Please try again, or email partners@runivo.app.' }, 500);
    }
  } catch (e) {
    console.error('[partners/apply]', e);
    return json({ ok: false, error: 'Something went wrong. Please try again, or email partners@runivo.app.' }, 500);
  }

  return json({ ok: true }, 201);
}
