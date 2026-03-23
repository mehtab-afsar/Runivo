import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ArchType = 'flat' | 'neutral' | 'high';

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

    // Parse body — expects { imageBase64: string, mimeType: 'image/jpeg' | 'image/png' | 'image/webp' }
    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64 || !mimeType) {
      return new Response('Missing imageBase64 or mimeType', { status: 400, headers: CORS_HEADERS });
    }

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '' });

    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
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
    console.error('foot-scan error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
