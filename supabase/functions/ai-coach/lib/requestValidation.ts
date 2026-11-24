// Shape and size checks on the request body, run before any database write or
// model call. `message` used to be unbounded: it is logged to coach_messages
// (even on the red-flag path, which runs before the Plus and consent gates) and
// sent whole to the model, so one multi-megabyte message cost far more than the
// spend reservation accounts for. Every refusal is thrown as a 400 Response.
import { textResponse } from './http.ts';
import type { RequestBody } from './types.ts';

const FEATURES = new Set<string>([
  'weekly_brief', 'post_run', 'training_plan', 'coach_chat', 'nutrition_insights', 'quick_prompts',
  'territory_strategy', 'adapt_plan', 'pace_intelligence', 'habit_tracking', 'food_scan',
]);
const MAX_MESSAGE_CHARS = 4_000;
const MAX_GOAL_CHARS    = 500;
const MAX_RUN_ID_CHARS  = 64;
const FOOD_SCAN_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/** Parse and validate the JSON body of an ai-coach request. */
export async function parseRequest(req: Request): Promise<RequestBody> {
  const body = await req.json().catch(() => null) as RequestBody | null;
  if (!body || typeof body !== 'object') throw textResponse(400, 'Invalid JSON');
  const { feature, runId, message, goal } = body;

  if (!feature) throw textResponse(400, 'Missing feature');
  if (typeof feature !== 'string' || !FEATURES.has(feature)) throw textResponse(400, 'Unknown feature');
  if (message !== undefined && (typeof message !== 'string' || message.length > MAX_MESSAGE_CHARS)) {
    throw textResponse(400, 'Invalid message');
  }
  if (goal !== undefined && (typeof goal !== 'string' || goal.length > MAX_GOAL_CHARS)) {
    throw textResponse(400, 'Invalid goal');
  }
  if (runId !== undefined && (typeof runId !== 'string' || runId.length > MAX_RUN_ID_CHARS)) {
    throw textResponse(400, 'Invalid runId');
  }
  return body;
}

/** The photo of a food_scan request, checked for presence, type and size. */
export function parseFoodScanInput(body: RequestBody): { imageBase64: string; mediaType: string } {
  const { imageBase64, mediaType = 'image/jpeg' } = body;
  if (typeof imageBase64 !== 'string' || !imageBase64) throw textResponse(400, 'Missing imageBase64');
  if (typeof mediaType !== 'string' || !FOOD_SCAN_MIME.has(mediaType)) throw textResponse(400, 'Unsupported mediaType');
  // A base64 image over ~7MB is rejected before it reaches Claude.
  if (imageBase64.length > 7_000_000) throw textResponse(413, 'Image too large');
  return { imageBase64, mediaType };
}
