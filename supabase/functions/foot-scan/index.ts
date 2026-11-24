import Anthropic from 'npm:@anthropic-ai/sdk@0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ArchType = 'flat' | 'neutral' | 'high';

// Mirrors ai-coach/index.ts:185. foot-scan was the one AI endpoint with neither a
// size cap nor a spend cap, so any signed-in user could loop it with large payloads
// and bill the Anthropic key without limit.
const DAILY_CAP_USD  = 0.12;
const MAX_IMAGE_B64  = 7 * 1024 * 1024;   // same ceiling as ai-coach:1545
const ALLOWED_MIME   = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Worst case for one scan (image + 256 output tokens at Sonnet prices), held while the
// request runs so parallel requests can't each pass a read-then-check and overrun the cap.
const RESERVE_USD = 0.02;

/**
 * Reserve this request's spend in one locked step (ai_reserve_spend, shared with
 * ai-coach). Returns the reservation id, or a ready 429/503 Response to send.
 * The old version summed ai_usage_log and then called Anthropic, so N parallel
 * requests all saw the same total and all went through.
 */
async function reserveSpend(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
): Promise<{ id: string | null } | Response> {
  const { data, error } = await supabase.rpc('ai_reserve_spend', {
    p_user: userId, p_feature: 'foot_scan', p_estimate_usd: RESERVE_USD,
    p_daily_cap_usd: DAILY_CAP_USD, p_chat_cap_usd: DAILY_CAP_USD,
  });
  // Fail closed: if the cap can't be checked, don't spend.
  if (error) {
    return new Response(JSON.stringify({ error: 'limit_check_failed' }), {
      status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
  const row = (Array.isArray(data) ? data[0] : data ?? null) as { reservation_id: string | null; refused: string | null } | null;
  if (row?.refused) {
    return new Response(
      JSON.stringify({ error: 'daily_limit_reached', detail: 'Daily AI usage limit reached. Try again tomorrow.' }),
      { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
  return { id: row?.reservation_id ?? null };
}

/** Drop the held reservation once the real cost is logged (or the call failed). */
async function releaseReservation(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  id: string | null,
): Promise<void> {
  if (!id) return;
  await supabase.from('ai_usage_log').delete().eq('id', id).eq('reservation', true).then(() => {}, () => {});
}

/** Record spend so this endpoint counts against the same budget as ai-coach. */
async function logUsage(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  usage: { input_tokens: number; output_tokens: number },
): Promise<void> {
  // Same rate card as ai-coach/index.ts:247 ($3/Mtok in, $15/Mtok out).
  const costUsd = (usage.input_tokens * 3 + usage.output_tokens * 15) / 1_000_000;
  await supabase.from('ai_usage_log').insert({
    user_id:       userId,
    feature:       'foot_scan',
    input_tokens:  usage.input_tokens,
    output_tokens: usage.output_tokens,
    cost_usd:      costUsd,
  });
}

interface FootScanResult {
  archType:            ArchType;
  confidence:          number;   // 0–100
  explanation:         string;
  shoeRecommendation:  string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  // Set once this request has reserved spend; released when it ends, whatever happens.
  let reservationId: string | null = null;
  // deno-lint-ignore no-explicit-any
  let db: any = null;
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Auth
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!jwt) return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });

    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
    if (authErr || !user) return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });

    // The photo goes to Anthropic: same explicit AI consent as PaceX (App Store
    // 5.1.2(i)), enforced here so a modified client can't skip it.
    const { data: gate } = await supabase.from('profiles').select('ai_consent_at').eq('id', user.id).single();
    if (!(gate as { ai_consent_at: string | null } | null)?.ai_consent_at) {
      return new Response(JSON.stringify({ error: 'ai_consent_required' }), {
        status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    if (!Deno.env.get('ANTHROPIC_API_KEY')) {
      return new Response(JSON.stringify({ error: 'ai_not_configured' }), {
        status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Parse body — expects { imageBase64: string, mimeType: 'image/jpeg' | 'image/png' | 'image/webp' }
    const parsed = await req.json().catch(() => null) as { imageBase64?: unknown; mimeType?: unknown } | null;
    if (!parsed || typeof parsed !== 'object') {
      return new Response('Invalid JSON', { status: 400, headers: CORS_HEADERS });
    }
    const { imageBase64, mimeType } = parsed;
    if (typeof imageBase64 !== 'string' || typeof mimeType !== 'string' || !imageBase64 || !mimeType) {
      return new Response('Missing or invalid imageBase64/mimeType', { status: 400, headers: CORS_HEADERS });
    }
    // mimeType previously went straight into the Anthropic media_type field unchecked.
    if (!ALLOWED_MIME.has(mimeType)) {
      return new Response('Unsupported mimeType', { status: 400, headers: CORS_HEADERS });
    }
    if (imageBase64.length > MAX_IMAGE_B64) {
      return new Response('Image too large', { status: 413, headers: CORS_HEADERS });
    }

    const reserved = await reserveSpend(supabase, user.id);
    if (reserved instanceof Response) return reserved;
    reservationId = reserved.id;
    db = supabase;

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '' });

    const response = await anthropic.messages.create({
      model:      Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-6',
      max_tokens: 256,
      messages: [{
        role:    'user',
        content: [
          {
            type:   'image',
            source: { type: 'base64', media_type: mimeType, data: imageBase64 },
          },
          {
            type: 'text',
            text: `Analyse this foot image to determine arch type. The image may be:
- A wet footprint on a surface (most reliable)
- A photo of the bottom of a bare foot
- A photo of the inside sole of a shoe

Determine the arch type:
- flat: full foot contact, little or no inward curve visible
- neutral: moderate curve on inner side, typical contact pattern
- high: minimal mid-foot contact, prominent arch visible

Respond with ONLY valid JSON, no markdown:
{
  "archType": "flat" | "neutral" | "high",
  "confidence": 0-100,
  "explanation": "one concise sentence describing what you observed",
  "shoeRecommendation": "one sentence on what type of running shoe suits this arch"
}`,
          },
        ],
      }],
    });

    await logUsage(supabase, user.id, response.usage);

    const raw = (response.content[0] as { type: 'text'; text: string }).text.trim();

    let result: FootScanResult;
    try {
      result = JSON.parse(raw) as FootScanResult;
    } catch {
      // Attempt to extract JSON from the response if Claude wrapped it
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Could not parse Claude response');
      result = JSON.parse(match[0]) as FootScanResult;
    }

    // Validate archType
    if (!['flat', 'neutral', 'high'].includes(result.archType)) {
      result.archType = 'neutral';
    }

    // Store in profiles table
    await supabase
      .from('profiles')
      .update({
        foot_type:    result.archType,
        foot_scan_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    return new Response(JSON.stringify({ data: result }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    // Detail stays in the logs: provider and SDK messages can echo request content.
    console.error('foot-scan error:', err);
    return new Response(
      JSON.stringify({ error: 'scan_failed' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  } finally {
    if (db) await releaseReservation(db, reservationId);
  }
});
