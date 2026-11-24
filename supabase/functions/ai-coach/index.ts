// ai-coach — PaceX, the Runivo AI Coach. One POST endpoint, one `feature` per call.
//
// This file is only the router: CORS preflight, request parsing, and the order in
// which the lib/ modules run. Who may call and how much they may spend is in
// lib/authAndRateLimit.ts, what we know about the runner in lib/contextBuilder.ts,
// what we tell the model in lib/prompts.ts, how we reach it in lib/anthropicClient.ts,
// and each feature's logic in lib/handlers/.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { authenticate, requirePlusAndConsent, reserveSpend } from './lib/authAndRateLimit.ts';
import { createAnthropic, describeProviderError } from './lib/anthropicClient.ts';
import { buildUserContext } from './lib/contextBuilder.ts';
import { handleCoachChat } from './lib/handlers/coachChat.ts';
import { handleFoodScan } from './lib/handlers/foodScan.ts';
import { handleHabitTracking } from './lib/handlers/habitTracking.ts';
import { handleNutritionInsights } from './lib/handlers/nutritionInsights.ts';
import { handlePaceIntelligence } from './lib/handlers/paceIntelligence.ts';
import { handlePostRun } from './lib/handlers/postRun.ts';
import { handleQuickPrompts } from './lib/handlers/quickPrompts.ts';
import { handleTerritoryStrategy } from './lib/handlers/territoryStrategy.ts';
import { handleWeeklyBrief } from './lib/handlers/weeklyBrief.ts';
import { jsonResponse, preflightResponse, textResponse } from './lib/http.ts';
import { SAFE_REDIRECT_MESSAGE, detectRedFlag } from './lib/redFlags.ts';
import { parseFoodScanInput, parseRequest } from './lib/requestValidation.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflightResponse();

  const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

  // Set once this request has reserved spend; always run when it ends.
  let releaseSpend: (() => Promise<void>) | null = null;
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const user = await authenticate(supabase, req);

    // Shape and size checks before ANY database write or model call.
    const body = await parseRequest(req);
    const { feature, runId, message } = body;

    // Deterministic safety check — runs before ANY Claude call, cost, or context
    // build, for the one free-form text surface (coach_chat). SAFETY_GUARDRAILS
    // is an instruction the model could be talked past; this is a fixed response
    // for the highest-risk signals so the model's judgment is never the only
    // thing standing between a user and an unsafe reply. Still logs the exchange
    // to coach_messages so the chat history reflects what was actually said.
    // It stays free: safety is never charged for, so it sits before the Plus gate.
    if (feature === 'coach_chat' && detectRedFlag(message)) {
      await supabase.from('coach_messages').insert({ user_id: user.id, role: 'user', content: message ?? '' });
      await supabase.from('coach_messages').insert({ user_id: user.id, role: 'assistant', content: SAFE_REDIRECT_MESSAGE });
      return jsonResponse(200, { data: SAFE_REDIRECT_MESSAGE });
    }

    // Everything below calls Claude: Plus runners who have consented to AI only.
    await requirePlusAndConsent(supabase, user.id);

    // Everything past here calls Anthropic: say so plainly instead of a 500 from the SDK.
    if (!ANTHROPIC_KEY && feature !== 'quick_prompts') {
      console.error('ai-coach: ANTHROPIC_API_KEY is not set');
      return jsonResponse(503, { error: 'ai_not_configured' });
    }

    // food_scan is a vision call — handled before the shared context build, but it
    // MUST still be behind the per-user daily spend cap (it was previously returning
    // before the cap, so a user could spam uncapped vision requests) and its input
    // must be bounded before it reaches Claude.
    if (feature === 'food_scan') {
      const { imageBase64, mediaType } = parseFoodScanInput(body);

      releaseSpend = await reserveSpend(supabase, user.id, feature);

      const food = await handleFoodScan(createAnthropic(ANTHROPIC_KEY), supabase, user.id, imageBase64, mediaType);
      if (!food) return jsonResponse(422, { error: 'Could not identify food' });
      return jsonResponse(200, { data: food });
    }

    // Reserve against the per-user daily spend cap before touching Claude;
    // released when this request ends, whatever happens (finally below).
    releaseSpend = await reserveSpend(supabase, user.id, feature);

    const anthropic = createAnthropic(ANTHROPIC_KEY);

    // Build full user context once — shared across all handlers
    const ctx = await buildUserContext(supabase, user.id);

    let result: unknown;

    switch (feature) {
      case 'weekly_brief':
        result = await handleWeeklyBrief(anthropic, supabase, user.id, ctx);
        break;

      case 'post_run':
        if (!runId) return textResponse(400, 'Missing runId');
        result = await handlePostRun(anthropic, supabase, user.id, runId, ctx);
        break;

      // Retired: these wrote an older plan format into training_plans, which
      // overwrote the runner's real plan. Plans now come from the plan engine
      // (PaceX → Approve this plan, the plan builder, onboarding).
      case 'training_plan':
      case 'adapt_plan':
        return jsonResponse(410, { error: 'retired', detail: 'Plans are built in the app now. Update Runivo.' });

      case 'coach_chat':
        if (!message) return textResponse(400, 'Missing message');
        result = await handleCoachChat(anthropic, supabase, user.id, message, ctx);
        break;

      case 'nutrition_insights':
        result = await handleNutritionInsights(anthropic, supabase, user.id, ctx);
        break;

      case 'pace_intelligence':
        result = await handlePaceIntelligence(anthropic, supabase, user.id, ctx);
        break;

      case 'quick_prompts':
        result = handleQuickPrompts(ctx);
        break;

      case 'territory_strategy':
        result = await handleTerritoryStrategy(anthropic, ctx);
        break;

      case 'habit_tracking':
        result = await handleHabitTracking(anthropic, supabase, user.id, ctx);
        break;

      default:
        return textResponse(400, 'Unknown feature');
    }

    return jsonResponse(200, { data: result });
  } catch (err) {
    // Auth, validation, plan, consent and spend-cap refusals are thrown as ready-made Responses
    if (err instanceof Response) return err;
    console.error('ai-coach error:', err);
    // Anthropic SDK errors carry the provider's status: name the cause for the app and the logs.
    const providerError = describeProviderError(err);
    if (providerError) return jsonResponse(502, { error: providerError.code, detail: providerError.detail });
    return jsonResponse(500, { error: 'internal' });
  } finally {
    await releaseSpend?.();
  }
});
