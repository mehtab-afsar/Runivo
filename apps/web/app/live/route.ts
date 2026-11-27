/**
 * runivo.in/live?t=<token> — the public safety-share page (PRD R2).
 *
 * The page itself is rendered by the safety-share edge function, but Supabase
 * serves text/html from *.supabase.co as text/plain (HTML needs a custom
 * domain), so a recipient opening the function URL saw raw markup. This route
 * fetches the same page and serves it from our own domain as HTML. The page's
 * 15-second position polling still calls the function's JSON endpoint directly
 * (JSON is allowed there, with CORS open).
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const TOKEN = /^[0-9a-f]{40,80}$/;

export async function GET(req: Request): Promise<Response> {
  const token = (new URL(req.url).searchParams.get('t') ?? '').trim();
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const headers = {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex',
    'Referrer-Policy': 'no-referrer',
  };
  if (!base || !TOKEN.test(token)) {
    return new NextResponse(EXPIRED, { status: 404, headers });
  }
  try {
    const res = await fetch(`${base}/functions/v1/safety-share?t=${token}`, { cache: 'no-store' });
    return new NextResponse(await res.text(), { status: res.status, headers });
  } catch {
    return new NextResponse(EXPIRED, { status: 502, headers });
  }
}

const EXPIRED = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Link expired · Runivo</title></head>
<body style="margin:0;font-family:-apple-system,system-ui,sans-serif;background:#f6f5f2;color:#141414;padding:24px">
<p style="font-weight:600;font-size:17px">This link has expired or was never valid.</p>
<p style="color:#8a8a8a;font-size:13px">Safety links stop working 12 hours after they start.</p></body></html>`;
