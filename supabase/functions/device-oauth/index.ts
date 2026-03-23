/**
 * device-oauth — handles OAuth connect/disconnect for Garmin, Coros, Polar.
 *
 * GET  ?provider=garmin|coros|polar&action=authorize  → { url: string }
 * POST { provider, action: 'callback', code?, oauth_token?, oauth_verifier? }
 *       → { connected: true }
 * DELETE { provider } → { disconnected: true }
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHmac } from 'node:crypto';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Provider = 'garmin' | 'coros' | 'polar';

// ─── Provider configs ──────────────────────────────────────────────────────────
const GARMIN = {
  requestTokenUrl: 'https://connectapi.garmin.com/oauth-service/oauth/request_token',
  authorizeUrl:    'https://connect.garmin.com/oauthConfirm',
  accessTokenUrl:  'https://connectapi.garmin.com/oauth-service/oauth/access_token',
};
const COROS = {
  authorizeUrl: 'https://open.coros.com/oauth2/authorize',
  tokenUrl:     'https://open.coros.com/oauth2/accesstoken',
  scope:        'activity',
};
const POLAR = {
  authorizeUrl: 'https://flow.polar.com/oauth2/authorization',
  tokenUrl:     'https://polarremote.com/v2/oauth2/token',
  scope:        'accesslink.read_all',
};

// ─── OAuth 1.0a helpers (Garmin) ──────────────────────────────────────────────
function oauthHeader(params: Record<string, string>): string {
  return 'OAuth ' + Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
    .join(', ');
}

function oauthBaseString(method: string, url: string, params: Record<string, string>): string {
  const sorted = Object.entries(params).sort(([a], [b]) => a.localeCompare(b));
  const paramStr = sorted.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramStr)}`;
}

function sign(baseStr: string, consumerSecret: string, tokenSecret = ''): string {
  const key = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  return createHmac('sha1', key).update(baseStr).digest('base64');
}

async function garminRequestToken(consumerKey: string, consumerSecret: string, callbackUrl: string) {
  const nonce     = crypto.randomUUID().replace(/-/g, '');
  const timestamp = String(Math.floor(Date.now() / 1000));

  const params: Record<string, string> = {
    oauth_consumer_key:     consumerKey,
    oauth_nonce:            nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp:        timestamp,
    oauth_version:          '1.0',
    oauth_callback:         callbackUrl,
  };

  const baseStr = oauthBaseString('POST', GARMIN.requestTokenUrl, params);
  params.oauth_signature = sign(baseStr, consumerSecret);

  const res = await fetch(GARMIN.requestTokenUrl, {
    method:  'POST',
    headers: { Authorization: oauthHeader(params) },
  });
  if (!res.ok) throw new Error(`Garmin request_token failed: ${await res.text()}`);

  const body = await res.text();
  const parsed = Object.fromEntries(new URLSearchParams(body));
  return { oauth_token: parsed.oauth_token, oauth_token_secret: parsed.oauth_token_secret };
}

async function garminAccessToken(
  consumerKey: string, consumerSecret: string,
  oauthToken: string, tokenSecret: string, oauthVerifier: string,
) {
  const nonce     = crypto.randomUUID().replace(/-/g, '');
  const timestamp = String(Math.floor(Date.now() / 1000));

  const params: Record<string, string> = {
    oauth_consumer_key:     consumerKey,
    oauth_nonce:            nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp:        timestamp,
    oauth_token:            oauthToken,
    oauth_verifier:         oauthVerifier,
    oauth_version:          '1.0',
  };

  const baseStr = oauthBaseString('POST', GARMIN.accessTokenUrl, params);
  params.oauth_signature = sign(baseStr, consumerSecret, tokenSecret);

  const res = await fetch(GARMIN.accessTokenUrl, {
    method:  'POST',
    headers: { Authorization: oauthHeader(params) },
  });
  if (!res.ok) throw new Error(`Garmin access_token failed: ${await res.text()}`);

  const body   = await res.text();
  const parsed = Object.fromEntries(new URLSearchParams(body));
  return { access_token: parsed.oauth_token, token_secret: parsed.oauth_token_secret };
}

// ─── OAuth 2 helpers (Coros / Polar) ──────────────────────────────────────────
async function oauth2Exchange(
  tokenUrl: string,
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
) {
  const body = new URLSearchParams({
    grant_type:    'authorization_code',
    client_id:     clientId,
    client_secret: clientSecret,
    code,
    redirect_uri:  redirectUri,
  });

  const res = await fetch(tokenUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });
  if (!res.ok) throw new Error(`OAuth2 exchange failed: ${await res.text()}`);
  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type: string;
  }>;
}

// ─── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // Auth
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!jwt) return new Response('Unauthorized', { status: 401, headers: CORS });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !user) return new Response('Unauthorized', { status: 401, headers: CORS });

  const appUrl    = Deno.env.get('APP_URL') ?? 'https://runivo.app';
  const callbackBase = `${appUrl}/settings/devices/callback`;

  try {
    // ── DELETE → disconnect ────────────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const { provider } = await req.json() as { provider: Provider };
      await supabase
        .from('device_connections')
        .update({ status: 'disconnected', metadata: {} })
        .eq('user_id', user.id)
        .eq('device_type', provider);
      return new Response(JSON.stringify({ disconnected: true }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);

    // ── GET → authorize URL ────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const provider = url.searchParams.get('provider') as Provider;
      const action   = url.searchParams.get('action');
      if (action !== 'authorize') return new Response('Bad request', { status: 400, headers: CORS });

      let authUrl = '';

      if (provider === 'garmin') {
        const key    = Deno.env.get('GARMIN_CONSUMER_KEY')    ?? '';
        const secret = Deno.env.get('GARMIN_CONSUMER_SECRET') ?? '';
        const callbackUrl = `${callbackBase}?provider=garmin`;
        const { oauth_token, oauth_token_secret } = await garminRequestToken(key, secret, callbackUrl);

        // Temporarily stash the request token secret so we can use it in the callback
        await supabase.from('device_connections').upsert({
          user_id:     user.id,
          device_type: 'garmin',
          status:      'disconnected',
          metadata:    { pending_token_secret: oauth_token_secret },
        }, { onConflict: 'user_id,device_type' });

        authUrl = `${GARMIN.authorizeUrl}?oauth_token=${oauth_token}`;

      } else if (provider === 'coros') {
        const clientId = Deno.env.get('COROS_CLIENT_ID') ?? '';
        const params   = new URLSearchParams({
          response_type: 'code',
          client_id:     clientId,
          redirect_uri:  `${callbackBase}?provider=coros`,
          scope:         COROS.scope,
        });
        authUrl = `${COROS.authorizeUrl}?${params}`;

      } else if (provider === 'polar') {
        const clientId = Deno.env.get('POLAR_CLIENT_ID') ?? '';
        const params   = new URLSearchParams({
          response_type: 'code',
          client_id:     clientId,
          redirect_uri:  `${callbackBase}?provider=polar`,
          scope:         POLAR.scope,
        });
        authUrl = `${POLAR.authorizeUrl}?${params}`;

      } else {
        return new Response('Unknown provider', { status: 400, headers: CORS });
      }

      return new Response(JSON.stringify({ url: authUrl }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // ── POST → callback / exchange ─────────────────────────────────────────────
    if (req.method === 'POST') {
      const body = await req.json() as {
        provider:        Provider;
        action:          'callback';
        code?:           string;    // OAuth 2
        oauth_token?:    string;    // Garmin
        oauth_verifier?: string;    // Garmin
      };

      const { provider } = body;
      let metadata: Record<string, string> = {};

      if (provider === 'garmin') {
        if (!body.oauth_token || !body.oauth_verifier) {
          return new Response('Missing oauth_token/verifier', { status: 400, headers: CORS });
        }
        // Retrieve the request token secret we stashed
        const { data: existing } = await supabase
          .from('device_connections')
          .select('metadata')
          .eq('user_id', user.id)
          .eq('device_type', 'garmin')
          .single();

        const tokenSecret = (existing?.metadata as Record<string, string>)?.pending_token_secret ?? '';
        const key    = Deno.env.get('GARMIN_CONSUMER_KEY')    ?? '';
        const secret = Deno.env.get('GARMIN_CONSUMER_SECRET') ?? '';

        const { access_token, token_secret } = await garminAccessToken(
          key, secret, body.oauth_token, tokenSecret, body.oauth_verifier,
        );
        metadata = { access_token, token_secret };

      } else if (provider === 'coros') {
        if (!body.code) return new Response('Missing code', { status: 400, headers: CORS });
        const tokens = await oauth2Exchange(
          COROS.tokenUrl,
          Deno.env.get('COROS_CLIENT_ID')     ?? '',
          Deno.env.get('COROS_CLIENT_SECRET') ?? '',
          body.code,
          `${callbackBase}?provider=coros`,
        );
        metadata = {
          access_token:  tokens.access_token,
          refresh_token: tokens.refresh_token ?? '',
          expires_at:    tokens.expires_in
            ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
            : '',
        };

      } else if (provider === 'polar') {
        if (!body.code) return new Response('Missing code', { status: 400, headers: CORS });
        const tokens = await oauth2Exchange(
          POLAR.tokenUrl,
          Deno.env.get('POLAR_CLIENT_ID')     ?? '',
          Deno.env.get('POLAR_CLIENT_SECRET') ?? '',
          body.code,
          `${callbackBase}?provider=polar`,
        );
        metadata = {
          access_token:  tokens.access_token,
          refresh_token: tokens.refresh_token ?? '',
          expires_at:    tokens.expires_in
            ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
            : '',
        };
      } else {
        return new Response('Unknown provider', { status: 400, headers: CORS });
      }

      await supabase.from('device_connections').upsert({
        user_id:      user.id,
        device_type:  provider,
        status:       'connected',
        last_sync_at: new Date().toISOString(),
        metadata,
      }, { onConflict: 'user_id,device_type' });

      return new Response(JSON.stringify({ connected: true }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method not allowed', { status: 405, headers: CORS });

  } catch (err) {
    console.error('device-oauth error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
