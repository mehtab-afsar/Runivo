// food_scan: identify a photographed meal and estimate one serving's nutrition.
// A vision call on the fast model; the router validates and caps the request
// before it gets here.
import { FAST_MODEL, complete, logUsage, replyText } from '../anthropicClient.ts';
import type { AnthropicClient, ImageMediaType } from '../anthropicClient.ts';
import { FOOD_SCAN_INSTRUCTION, PERSONA_FOOD_SCAN, withGuardrails } from '../prompts.ts';
import type { Db } from '../types.ts';

/** The parsed food estimate, or null when the reply held no JSON object. */
export async function handleFoodScan(
  anthropic: AnthropicClient,
  supabase: Db,
  userId: string,
  imageBase64: string,
  mediaType: string,
): Promise<unknown | null> {
  const msg = await complete(anthropic, {
    model:     FAST_MODEL,
    maxTokens: 300,
    system:    withGuardrails(PERSONA_FOOD_SCAN),
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType as ImageMediaType, data: imageBase64 },
        },
        { type: 'text', text: FOOD_SCAN_INSTRUCTION },
      ],
    }],
  });

  await logUsage(supabase, userId, 'food_scan', msg.usage);
  const raw = replyText(msg).trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;

  return JSON.parse(match[0]);
}
