// Everything that talks to Anthropic: client construction (timeout + retry),
// model ids, request shape, reply parsing, provider-error mapping, usage logging.
import Anthropic from 'npm:@anthropic-ai/sdk@0';
import type { Db, Feature } from './types.ts';

export type AnthropicClient = Anthropic;

// Model ids in one place; override per project with secrets instead of redeploying.
export const MODEL      = Deno.env.get('ANTHROPIC_MODEL')      ?? 'claude-sonnet-4-6';
export const FAST_MODEL = Deno.env.get('ANTHROPIC_FAST_MODEL') ?? 'claude-haiku-4-5-20251001';

const REQUEST_TIMEOUT_MS = 45_000;
const MAX_RETRIES        = 1;

export function createAnthropic(apiKey: string): AnthropicClient {
  return new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: MAX_RETRIES });
}

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: ImageMediaType; data: string } };

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

export interface CompletionRequest {
  /** Defaults to MODEL; the vision food scan passes FAST_MODEL. */
  model?: string;
  maxTokens: number;
  system: string;
  messages: ChatMessage[];
}

/** One non-streaming Messages API call. */
export function complete(anthropic: AnthropicClient, req: CompletionRequest) {
  return anthropic.messages.create({
    model:      req.model ?? MODEL,
    max_tokens: req.maxTokens,
    system:     req.system,
    messages:   req.messages,
  });
}

/** The first text block of a reply (newer models can put other blocks first). */
export function replyText(msg: { content: Array<{ type: string; text?: string }> }): string {
  return msg.content.find(b => b.type === 'text')?.text ?? '';
}

/** Parse a model reply that should be JSON, tolerating ```json fences. Throws on invalid JSON. */
export function parseJsonReply(text: string): unknown {
  return JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
}

// ─── Cost logging ─────────────────────────────────────────────────────────────
// Sonnet rate card: $3 per million input tokens, $15 per million output tokens.
const INPUT_USD_PER_MTOK  = 3;
const OUTPUT_USD_PER_MTOK = 15;

export async function logUsage(
  supabase: Db,
  userId: string,
  feature: Feature,
  usage: { input_tokens: number; output_tokens: number },
): Promise<void> {
  const costUsd = (usage.input_tokens * INPUT_USD_PER_MTOK + usage.output_tokens * OUTPUT_USD_PER_MTOK) / 1_000_000;
  await supabase.from('ai_usage_log').insert({
    user_id:       userId,
    feature,
    input_tokens:  usage.input_tokens,
    output_tokens: usage.output_tokens,
    cost_usd:      costUsd,
  }).then(() => {});
}

// ─── Provider errors ──────────────────────────────────────────────────────────
/**
 * Anthropic SDK errors carry the provider's status: name the cause for the app
 * and the logs. Null when the error did not come from the provider.
 */
export function describeProviderError(err: unknown): { code: string; detail: string } | null {
  if (!(err instanceof Anthropic.APIError)) return null;
  const st = err.status ?? 0;
  const code = st === 401 || st === 403 ? 'ai_provider_auth'
    : st === 404 ? 'ai_model_unavailable'
    : st === 429 ? 'ai_provider_rate_limited'
    : st >= 500 ? 'ai_provider_down'
    : 'ai_provider_error';
  return { code, detail: String(err.message).slice(0, 300) };
}
