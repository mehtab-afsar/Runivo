import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';

// ─── Types ────────────────────────────────────────────────────────────────────
type Feature = 'weekly_brief' | 'post_run' | 'training_plan' | 'coach_chat' | 'nutrition_insights' | 'quick_prompts' | 'territory_strategy' | 'adapt_plan' | 'pace_intelligence' | 'habit_tracking' | 'food_scan';

interface RequestBody {
  feature:       Feature;
  runId?:        string;
  message?:      string;
  goal?:         string;
  planId?:       string;
  imageBase64?:  string;
  mediaType?:    string;
}

interface WeeklyBriefPayload {
  headline: string;
  insights: string[];
  tip: string;
  nutrition?: {
    summary: string;
    connection: string;
    priority: string;
  };
}

interface PostRunPayload {
  praise: string;
  analysis: string;
  suggestion: string;
  recovery?: string;
}

interface TrainingPlanPayload {
  planId?: string;
  weeks: Array<{
    week: number;
    focus: string;
    sessions: Array<{ day: string; type: string; description: string }>;
  }>;
}

interface NutritionInsightsPayload {
  cards: Array<{
    title: string;
    body: string;
    icon: string;
  }>;
  generatedAt: string;
}

interface PaceIntelligencePayload {
  insights: Array<{
    icon: string;
    headline: string;
    body: string;
    recommendation: string;
  }>;
  generatedAt: string;
}

interface RunRecord {
  id: string;
  distance_m: number | null;
  duration_sec: number | null;
  avg_pace: string | null;
  started_at: string;
  territories_claimed: string[] | null;
}

interface NutritionDayLog {
  date: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

interface PlanCompliance {
  goal: string;
  weekCurrent: number;
  weeksTotal: number;
  sessionsPlannedThisWeek: number;
  sessionsCompletedThisWeek: number;
  sessionsMissedThisWeek: number;
  kmActualThisWeek: number;
  streakDays: number;
  consistencyLast8Weeks: number[];
  avgConsistencyLast8Weeks: number | null;
}

interface UserContext {
  runs90d: RunRecord[];
  totalKm90d: number;
  weeklyKm: number;
  trend: string;
  paceZones: { easy: number; moderate: number; tempo: number; hard: number };
  easyPace: string;
  tempoPace: string;
  prs: { fastestPace: string | null; longestRun: number; best5kPace: string | null };
  racePredictions: { fiveK: string; tenK: string; half: string; full: string } | null;
  staleZoneCount: number;
  avgFreshness: number;
  totalAreaM2: number;
  largestTierHeld: string;
  territoryScore: number;
  runnerRank: string;
  paceWeeklyEarned: number;
  paceWeeklyCapLimit: number;
  planCompliance: PlanCompliance | null;
  nutrition: {
    dailyGoalKcal: number;
    proteinGoalG: number;
    goal: string;
    weightKg: number;
    recentAvgKcal: number;
    recentAvgProteinG: number;
    daysHitKcalTarget: number;
    daysUnderProtein80g: number;
    dailyLogs: NutritionDayLog[];
    daysUntilEvent: number | null;
  } | null;
  shoes: Array<{
    name: string;
    totalKm: number;
    maxKm: number;
    pctWorn: number;
    isDefault: boolean;
  }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function todayISODate(): string {
  return new Date().toISOString().split('T')[0];
}

function paceSecPerKm(r: RunRecord): number {
  if (!r.distance_m || !r.duration_sec) return 0;
  return r.duration_sec / (r.distance_m / 1000);
}

function fmtPaceSec(sPerKm: number): string {
  const m = Math.floor(sPerKm / 60);
  const s = Math.round(sPerKm % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function fmtTime(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.round(totalSec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function fmtDist(m: number | null): string {
  if (!m) return '0 km';
  return (m / 1000).toFixed(1) + ' km';
}

function fmtDuration(sec: number | null): string {
  if (!sec) return '0 min';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function meanSec(runs: RunRecord[]): number {
  const valid = runs.filter(r => r.distance_m && r.duration_sec);
  if (!valid.length) return 0;
  return valid.reduce((s, r) => s + paceSecPerKm(r), 0) / valid.length;
}

async function contextHash(obj: unknown): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(obj));
  const buf = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Cost protection ──────────────────────────────────────────────────────────
// Per-user daily spend caps (USD). Cached features (weekly_brief, post_run,
// training_plan, nutrition_insights) cost fractions of a cent per day in
// normal use. coach_chat is the only unbounded endpoint.
const DAILY_CAP_USD         = 0.12;  // ~22 coach_chat messages / user / day
const CHAT_DAILY_CAP_USD    = 0.08;  // ~15 messages for coach_chat alone

/**
 * Check whether the user has exceeded their daily spend cap.
 * Throws a Response with status 429 if they have.
 */
async function enforceDailyCap(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  feature: Feature,
  corsHeaders: Record<string, string>,
): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Total spend across all features in the last 24 hours
  const { data: totalRows } = await supabase
    .from('ai_usage_log')
    .select('cost_usd')
    .eq('user_id', userId)
    .gte('created_at', since);

  const totalUsd = (totalRows ?? []).reduce(
    (s: number, r: { cost_usd: number }) => s + (r.cost_usd ?? 0), 0,
  );

  if (totalUsd >= DAILY_CAP_USD) {
    throw new Response(
      JSON.stringify({ error: 'daily_limit_reached', detail: 'Daily AI usage limit reached. Try again tomorrow.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Tighter cap for coach_chat specifically
  if (feature === 'coach_chat') {
    const { data: chatRows } = await supabase
      .from('ai_usage_log')
      .select('cost_usd')
      .eq('user_id', userId)
      .eq('feature', 'coach_chat')
      .gte('created_at', since);

    const chatUsd = (chatRows ?? []).reduce(
      (s: number, r: { cost_usd: number }) => s + (r.cost_usd ?? 0), 0,
    );

    if (chatUsd >= CHAT_DAILY_CAP_USD) {
      throw new Response(
        JSON.stringify({ error: 'chat_limit_reached', detail: 'Daily coach chat limit reached. Try again tomorrow.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
  }
}

// ─── Cost logging ─────────────────────────────────────────────────────────────
async function logUsage(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  feature: Feature,
  usage: { input_tokens: number; output_tokens: number },
): Promise<void> {
  const costUsd = (usage.input_tokens * 3 + usage.output_tokens * 15) / 1_000_000;
  await supabase.from('ai_usage_log').insert({
    user_id:       userId,
    feature,
    input_tokens:  usage.input_tokens,
    output_tokens: usage.output_tokens,
    cost_usd:      costUsd,
  }).then(() => {});
}

// ─── Context builder ──────────────────────────────────────────────────────────
async function buildUserContext(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<UserContext> {
  const ninetyDaysAgo   = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const todayStr        = todayISODate();

  const mondayISO = (() => {
    const now = new Date();
    const diff = (now.getUTCDay() + 6) % 7;
    const mon  = new Date(now);
    mon.setUTCDate(now.getUTCDate() - diff);
    return mon.toISOString().split('T')[0];
  })();

  const [runsRes, polygonsRes, profileRes, nutritionProfileRes, nutritionLogsRes, eventsRes, shoesRes, activePlanRes, consistencyHistRes] = await Promise.all([
    supabase
      .from('runs')
      .select('id, distance_m, duration_sec, avg_pace, started_at, territories_claimed, avg_hr, max_hr, avg_cadence, elevation_gain_m, hrv_ms, calories_kcal')
      .eq('user_id', userId)
      .gt('distance_m', 500)
      .gte('started_at', ninetyDaysAgo)
      .order('started_at', { ascending: false }),
    supabase
      .from('territory_polygons')
      .select('area_m2, freshness, last_defended_at, tier')
      .eq('owner_id', userId)
      .limit(100),
    supabase
      .from('profiles')
      .select('runner_rank, pace_weekly_earned, pace_total_earned, subscription_tier, territory_score, streak_days')
      .eq('id', userId)
      .single(),
    supabase
      .from('nutrition_profiles')
      .select('daily_goal_kcal, protein_goal_g, goal, weight_kg')
      .eq('user_id', userId)
      .single(),
    supabase
      .from('nutrition_logs')
      .select('log_date, kcal, protein_g, carbs_g, fat_g')
      .eq('user_id', userId)
      .gte('log_date', fourteenDaysAgo),
    // Nearest upcoming event the user is registered for
    supabase
      .from('event_participants')
      .select('events!inner(date)')
      .eq('user_id', userId)
      .gte('events.date', todayStr)
      .order('events.date', { ascending: true })
      .limit(1)
      .maybeSingle(),
    // Active shoes with computed km
    supabase
      .from('shoe_stats')
      .select('brand, model, nickname, total_km, max_km, is_default')
      .eq('user_id', userId)
      .eq('is_retired', false)
      .order('is_default', { ascending: false })
      .limit(5),
    // Active training plan
    supabase
      .from('training_plans')
      .select('id, goal, week_current, weeks_total, plan_data')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Consistency history (last 8 weeks)
    supabase
      .rpc('get_consistency_history', { p_user_id: userId, p_weeks: 8 }),
  ]);

  const runs90d = (runsRes.data ?? []) as RunRecord[];

  // ── Weekly avg (last 8 weeks) ────────────────────────────────────────────────
  const eightWeeksAgo = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000).toISOString();
  const last8wRuns    = runs90d.filter(r => r.started_at >= eightWeeksAgo);
  const totalKm8w     = last8wRuns.reduce((s, r) => s + (r.distance_m ?? 0) / 1000, 0);
  const weeklyKm      = totalKm8w / 8;

  // ── Pace trend ───────────────────────────────────────────────────────────────
  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();
  const recentRuns   = last8wRuns.filter(r => r.started_at >= fourWeeksAgo);
  const olderRuns    = last8wRuns.filter(r => r.started_at < fourWeeksAgo);
  const recentAvg    = meanSec(recentRuns);
  const olderAvg     = meanSec(olderRuns);
  const trend        = recentAvg > 0 && olderAvg > 0
    ? recentAvg < olderAvg - 5 ? 'improving'
      : recentAvg > olderAvg + 5 ? 'declining'
      : 'stable'
    : 'building base';

  // ── Pace zones ───────────────────────────────────────────────────────────────
  const validForZones = runs90d.filter(r => (r.distance_m ?? 0) > 1000 && (r.duration_sec ?? 0) > 60);
  const zoneCounts    = { easy: 0, moderate: 0, tempo: 0, hard: 0 };
  const zonePaces: { easy: number[]; moderate: number[]; tempo: number[]; hard: number[] } =
    { easy: [], moderate: [], tempo: [], hard: [] };

  validForZones.forEach(r => {
    const pace = paceSecPerKm(r);
    if      (pace >= 390) { zoneCounts.easy++;     zonePaces.easy.push(pace);     }
    else if (pace >= 330) { zoneCounts.moderate++;  zonePaces.moderate.push(pace); }
    else if (pace >= 285) { zoneCounts.tempo++;     zonePaces.tempo.push(pace);    }
    else                  { zoneCounts.hard++;      zonePaces.hard.push(pace);     }
  });
  const total     = Math.max(1, validForZones.length);
  const paceZones = {
    easy:     Math.round(zoneCounts.easy     / total * 100),
    moderate: Math.round(zoneCounts.moderate / total * 100),
    tempo:    Math.round(zoneCounts.tempo    / total * 100),
    hard:     Math.round(zoneCounts.hard     / total * 100),
  };

  const mean       = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const allPaces   = runs90d.filter(r => r.distance_m && r.duration_sec).map(r => paceSecPerKm(r)).sort((a, b) => a - b);
  const medianAll  = allPaces.length > 0 ? allPaces[Math.floor(allPaces.length / 2)] : 0;
  const easyAvg    = mean(zonePaces.easy);
  const tempoAvg   = mean(zonePaces.tempo);
  const easyPace   = fmtPaceSec(easyAvg  > 0 ? easyAvg  : medianAll + 90);
  const tempoPace  = fmtPaceSec(tempoAvg > 0 ? tempoAvg : Math.max(240, medianAll - 30));

  // ── PRs ──────────────────────────────────────────────────────────────────────
  let fastestPaceSec = Infinity;
  let longestRunKm   = 0;
  let best5kPaceSec  = Infinity;

  runs90d.filter(r => (r.distance_m ?? 0) > 0 && (r.duration_sec ?? 0) > 0).forEach(r => {
    const pace   = paceSecPerKm(r);
    const distKm = (r.distance_m ?? 0) / 1000;
    if (pace   < fastestPaceSec) fastestPaceSec = pace;
    if (distKm > longestRunKm)   longestRunKm   = distKm;
    if (distKm >= 4.8 && pace < best5kPaceSec) best5kPaceSec = pace;
  });

  const prs = {
    fastestPace: fastestPaceSec < Infinity ? fmtPaceSec(fastestPaceSec) : null,
    longestRun:  parseFloat(longestRunKm.toFixed(1)),
    best5kPace:  best5kPaceSec  < Infinity ? fmtPaceSec(best5kPaceSec)  : null,
  };

  // ── Race predictions ─────────────────────────────────────────────────────────
  const refRun = runs90d
    .filter(r => (r.distance_m ?? 0) >= 3000 && (r.duration_sec ?? 0) > 0)
    .sort((a, b) => (b.distance_m ?? 0) - (a.distance_m ?? 0))[0] ?? null;

  let racePredictions = null;
  if (refRun) {
    const t1      = refRun.duration_sec!;
    const d1      = refRun.distance_m! / 1000;
    const predict = (d2: number) => t1 * Math.pow(d2 / d1, 1.06);
    racePredictions = {
      fiveK: fmtTime(predict(5)),
      tenK:  fmtTime(predict(10)),
      half:  fmtTime(predict(21.0975)),
      full:  fmtTime(predict(42.195)),
    };
  }

  // ── Territory ────────────────────────────────────────────────────────────────
  const polygonRows  = (polygonsRes.data ?? []) as { area_m2: number; freshness: number; last_defended_at: string; tier: string }[];
  const profileRow   = profileRes.data as { runner_rank: string | null; pace_weekly_earned: number | null; pace_total_earned: number | null; subscription_tier: string | null; territory_score: number | null; streak_days: number | null } | null;

  const MS_PER_DAY  = 86_400_000;
  const now         = Date.now();
  const tierOrder   = ['patch', 'block', 'district', 'quarter', 'domain'];

  let staleZoneCount  = 0;
  let totalArea       = 0;
  let weightedFresh   = 0;
  let largestTierHeld = 'patch';

  for (const p of polygonRows) {
    const daysSince        = (now - new Date(p.last_defended_at).getTime()) / MS_PER_DAY;
    const currentFreshness = Math.max(0, p.freshness - Math.floor(daysSince * 10));
    if (currentFreshness < 40) staleZoneCount++;
    totalArea     += p.area_m2;
    weightedFresh += currentFreshness * p.area_m2;
    if (tierOrder.indexOf(p.tier) > tierOrder.indexOf(largestTierHeld)) largestTierHeld = p.tier;
  }

  const avgFreshness       = totalArea > 0 ? Math.round(weightedFresh / totalArea) : 100;
  const isPremium          = profileRow?.subscription_tier === 'premium';
  const paceWeeklyCapLimit = isPremium ? 150 : 100;

  // ── Nutrition ────────────────────────────────────────────────────────────────
  let nutrition = null;
  if (nutritionProfileRes.data) {
    const np = nutritionProfileRes.data as {
      daily_goal_kcal: number;
      protein_goal_g: number;
      goal: string;
      weight_kg: number;
    };

    // Build per-day aggregates from raw logs
    const rawLogs = (nutritionLogsRes.data ?? []) as {
      log_date: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number;
    }[];

    const dayMap = new Map<string, NutritionDayLog>();
    rawLogs.forEach(l => {
      const existing = dayMap.get(l.log_date) ?? { date: l.log_date, kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
      existing.kcal     += l.kcal     ?? 0;
      existing.proteinG += l.protein_g ?? 0;
      existing.carbsG   += l.carbs_g  ?? 0;
      existing.fatG     += l.fat_g    ?? 0;
      dayMap.set(l.log_date, existing);
    });
    const dailyLogs = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Last 7 days for averages
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const last7Logs    = dailyLogs.filter(d => d.date >= sevenDaysAgo);
    const recentAvgKcal     = last7Logs.length > 0 ? Math.round(last7Logs.reduce((s, d) => s + d.kcal, 0) / 7) : 0;
    const recentAvgProteinG = last7Logs.length > 0 ? Math.round(last7Logs.reduce((s, d) => s + d.proteinG, 0) / last7Logs.length) : 0;
    const daysHitKcalTarget  = last7Logs.filter(d => d.kcal >= np.daily_goal_kcal * 0.9).length;
    const daysUnderProtein80g = last7Logs.filter(d => d.proteinG < 80).length;

    // Days until next registered event
    let daysUntilEvent: number | null = null;
    try {
      const ev = eventsRes.data as { events: { date: string } } | null;
      if (ev?.events?.date) {
        const diff = (new Date(ev.events.date).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
        daysUntilEvent = Math.max(0, Math.round(diff));
      }
    } catch { /* no event data — leave null */ }

    nutrition = {
      dailyGoalKcal:      np.daily_goal_kcal,
      proteinGoalG:       np.protein_goal_g ?? 0,
      goal:               np.goal ?? 'maintain',
      weightKg:           np.weight_kg,
      recentAvgKcal,
      recentAvgProteinG,
      daysHitKcalTarget,
      daysUnderProtein80g,
      dailyLogs,
      daysUntilEvent,
    };
  }

  // ── Plan compliance ──────────────────────────────────────────────────────────
  const activePlanRow = activePlanRes.data as {
    id: string; goal: string; week_current: number; weeks_total: number;
    plan_data: { weeks: Array<{ week: number; focus: string; sessions: Array<{ day: string; type: string; description: string }> }> };
  } | null;

  const DAY_OFFSET: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

  let planCompliance: PlanCompliance | null = null;
  if (activePlanRow) {
    const weekIdx       = activePlanRow.week_current - 1;
    const currentWeek   = activePlanRow.plan_data.weeks[weekIdx];
    const sessions      = currentWeek?.sessions ?? [];
    const runSessions   = sessions.filter(s => s.type !== 'Rest');

    // Which of this week's run sessions have a matching run date?
    const thisWeekRunDates = new Set(
      runs90d
        .filter(r => r.started_at >= mondayISO + 'T00:00:00Z')
        .map(r => r.started_at.split('T')[0])
    );

    let completed = 0;
    let missed    = 0;
    const todayISO = new Date().toISOString().split('T')[0];

    for (const s of runSessions) {
      const offset = DAY_OFFSET[s.day] ?? 0;
      const d      = new Date(mondayISO);
      d.setUTCDate(d.getUTCDate() + offset);
      const dateStr = d.toISOString().split('T')[0];
      if (thisWeekRunDates.has(dateStr)) {
        completed++;
      } else if (dateStr < todayISO) {
        missed++;
      }
    }

    const kmThisWeek = runs90d
      .filter(r => r.started_at >= mondayISO + 'T00:00:00Z')
      .reduce((s, r) => s + (r.distance_m ?? 0) / 1000, 0);

    const histRows = (consistencyHistRes.data ?? []) as Array<{
      week_start: string; consistency_score: number; sessions_completed: number;
      sessions_planned: number; km_actual: number; streak_days_eow: number;
    }>;
    const scores = histRows.map(w => w.consistency_score);
    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length)
      : null;

    planCompliance = {
      goal:                      activePlanRow.goal,
      weekCurrent:               activePlanRow.week_current,
      weeksTotal:                activePlanRow.weeks_total,
      sessionsPlannedThisWeek:   runSessions.length,
      sessionsCompletedThisWeek: completed,
      sessionsMissedThisWeek:    missed,
      kmActualThisWeek:          parseFloat(kmThisWeek.toFixed(1)),
      streakDays:                profileRow?.streak_days ?? 0,
      consistencyLast8Weeks:     scores.reverse(),
      avgConsistencyLast8Weeks:  avgScore,
    };
  }

  return {
    runs90d,
    totalKm90d:    parseFloat(runs90d.reduce((s, r) => s + (r.distance_m ?? 0) / 1000, 0).toFixed(1)),
    weeklyKm:      parseFloat(weeklyKm.toFixed(1)),
    trend,
    paceZones,
    easyPace,
    tempoPace,
    prs,
    racePredictions,
    staleZoneCount,
    avgFreshness,
    totalAreaM2:        totalArea,
    largestTierHeld,
    territoryScore:     profileRow?.territory_score ?? 0,
    runnerRank:         profileRow?.runner_rank ?? 'pacer',
    paceWeeklyEarned:   profileRow?.pace_weekly_earned ?? 0,
    paceWeeklyCapLimit,
    planCompliance,
    nutrition,
    shoes: (shoesRes.data ?? []).map((s: { brand: string; model: string; nickname: string | null; total_km: number; max_km: number; is_default: boolean }) => ({
      name:      s.nickname ?? `${s.brand} ${s.model}`,
      totalKm:   Math.round(s.total_km ?? 0),
      maxKm:     s.max_km ?? 700,
      pctWorn:   Math.round(((s.total_km ?? 0) / (s.max_km ?? 700)) * 100),
      isDefault: s.is_default ?? false,
    })),
  };
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleWeeklyBrief(
  anthropic: Anthropic,
  supabase: ReturnType<typeof createClient>,
  userId: string,
  ctx: UserContext,
): Promise<WeeklyBriefPayload> {
  const eightWeeksAgo = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000).toISOString();
  const runList   = ctx.runs90d.filter(r => r.started_at >= eightWeeksAgo);
  const totalKm   = runList.reduce((s, r) => s + (r.distance_m ?? 0) / 1000, 0);
  const totalRuns = runList.length;
  const avgPace   = runList[Math.floor(runList.length / 2)]?.avg_pace ?? '–';
  const lastRunId = runList[0]?.id ?? null;

  const hashInput = {
    lastRunId,
    totalRuns,
    totalKm: totalKm.toFixed(1),
    trend:   ctx.trend,
    paceZones: ctx.paceZones,
    fastestPace: ctx.prs.fastestPace,
    // bust if nutrition changes significantly
    daysHitKcal:      ctx.nutrition?.daysHitKcalTarget ?? null,
    avgProtein:       ctx.nutrition?.recentAvgProteinG ?? null,
    paceWeeklyEarned: ctx.paceWeeklyEarned,
    staleZoneCount:   ctx.staleZoneCount,
    territoryScore:   ctx.territoryScore,
  };
  const hash = await contextHash(hashInput);

  const { data: cached } = await supabase
    .from('ai_cache')
    .select('payload, context_hash')
    .eq('user_id', userId)
    .eq('feature', 'weekly_brief')
    .single();

  if (cached?.context_hash === hash) return cached.payload as WeeklyBriefPayload;

  // ── Build nutrition context for brief ────────────────────────────────────────
  let nutritionBlock = '';
  let nutritionJsonInstruction = '';
  if (ctx.nutrition) {
    const n = ctx.nutrition;
    // Compute run-day vs rest-day protein averages
    const runDates = new Set(runList.map(r => r.started_at.split('T')[0]));
    const runDayLogs  = n.dailyLogs.filter(d => runDates.has(d.date));
    const restDayLogs = n.dailyLogs.filter(d => !runDates.has(d.date));
    const avg = (arr: NutritionDayLog[], key: keyof NutritionDayLog) =>
      arr.length > 0 ? Math.round(arr.reduce((s, d) => s + (d[key] as number), 0) / arr.length) : 0;
    const runDayProtein  = avg(runDayLogs,  'proteinG');
    const restDayProtein = avg(restDayLogs, 'proteinG');

    const avgDeficit  = n.dailyGoalKcal - n.recentAvgKcal;
    const deficitLine = avgDeficit >= 0
      ? `Avg daily deficit: ${avgDeficit} kcal`
      : `Avg daily surplus: ${Math.abs(avgDeficit)} kcal`;

    nutritionBlock = `
Nutrition last 7 days:
- Hit calorie target (±10%): ${n.daysHitKcalTarget}/7 days
- ${deficitLine} (goal: ${n.dailyGoalKcal} kcal/day, avg consumed: ${n.recentAvgKcal} kcal/day)
- Average protein: ${n.recentAvgProteinG}g vs ${n.proteinGoalG}g target
- Days under 80g protein: ${n.daysUnderProtein80g}
- Run-day protein avg: ${runDayProtein}g | Rest-day protein avg: ${restDayProtein}g
`;
    nutritionJsonInstruction = `Also add a "nutrition" field:
{"nutrition":{"summary":"one sentence on nutrition adherence this week ≤20 words","connection":"one sentence connecting nutrition data to run performance — if correlation exists reference specific days/paces; if no clear correlation say so briefly ≤25 words","priority":"one actionable nutrition priority for next week ≤15 words"}}`;
  }

  const prLine  = ctx.prs.fastestPace
    ? `Fastest pace (90 days): ${ctx.prs.fastestPace}/km. Longest run: ${ctx.prs.longestRun} km.` : '';
  const raceLine = ctx.racePredictions
    ? `Predicted race times: 5K ${ctx.racePredictions.fiveK} | 10K ${ctx.racePredictions.tenK} | Half ${ctx.racePredictions.half}.` : '';

  const response = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 384,
    system:     'You are Runivo Intelligence — a terse, motivating running coach. Return only valid JSON.',
    messages: [{
      role:    'user',
      content: `Runner data — last 8 weeks:
Total: ${totalKm.toFixed(1)} km across ${totalRuns} runs. Weekly avg: ${ctx.weeklyKm} km/wk.
Avg pace: ${avgPace}/km. Trend: ${ctx.trend}.
Pace zones: ${ctx.paceZones.easy}% easy / ${ctx.paceZones.moderate}% moderate / ${ctx.paceZones.tempo}% tempo / ${ctx.paceZones.hard}% hard.
${prLine}
${raceLine}
${nutritionBlock}
Territory status:
- PACE earned this week: ${ctx.paceWeeklyEarned} / ${ctx.paceWeeklyCapLimit}
- Territory Score: ${ctx.territoryScore} TS
- Stale zones: ${ctx.staleZoneCount} (easy to steal by rivals)
- Average freshness: ${ctx.avgFreshness}%

Respond ONLY with valid JSON (no markdown fences):
{"headline":"one punchy motivating line ≤12 words","insights":["specific insight 1","specific insight 2","specific insight 3"],"tip":"one actionable tip for this week ≤20 words"${ctx.nutrition ? `,"nutrition":{"summary":"...","connection":"...","priority":"..."}` : ''}}

Be specific to their numbers. Reference actual paces and distances.
${nutritionJsonInstruction}`,
    }],
  });

  await logUsage(supabase, userId, 'weekly_brief', response.usage);

  let payload: WeeklyBriefPayload;
  try {
    const text = (response.content[0] as { type: 'text'; text: string }).text;
    payload = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
  } catch {
    payload = {
      headline:  `${totalKm.toFixed(0)} km banked — keep building.`,
      insights:  [`${totalRuns} runs completed.`, `Avg pace: ${avgPace}/km.`, `Trend: ${ctx.trend}.`],
      tip:       'Add one tempo run this week to push your pace forward.',
    };
  }

  await supabase.from('ai_cache').upsert({
    user_id:      userId,
    feature:      'weekly_brief',
    payload,
    context_hash: hash,
    generated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,feature' });

  return payload;
}

async function handlePostRun(
  anthropic: Anthropic,
  supabase: ReturnType<typeof createClient>,
  userId: string,
  runId: string,
  ctx: UserContext,
): Promise<PostRunPayload | null> {
  const { data: run } = await supabase
    .from('runs')
    .select('distance_m, duration_sec, avg_pace, started_at')
    .eq('id', runId)
    .single();

  if (!run) throw new Error('Run not found');
  if ((run.distance_m ?? 0) < 500) return null;

  const input = { runId, distanceM: run.distance_m, durationSec: run.duration_sec };
  const hash  = await contextHash(input);

  const { data: cached } = await supabase
    .from('ai_cache')
    .select('payload, context_hash')
    .eq('user_id', userId)
    .eq('feature', 'post_run')
    .single();

  if (cached?.context_hash === hash) return cached.payload as PostRunPayload;

  // Recent avg pace from ctx (last 4 weeks, excluding this run)
  const fourWeeksAgo  = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();
  const recentOther   = ctx.runs90d.filter(r => r.id !== runId && r.started_at >= fourWeeksAgo);
  const mid           = Math.floor(recentOther.length / 2);
  const avgRecentPace = recentOther[mid]?.avg_pace ?? '–';

  // PR detection
  const historicFastest = ctx.runs90d
    .filter(r => r.id !== runId && (r.distance_m ?? 0) > 0 && (r.duration_sec ?? 0) > 0)
    .reduce((best, r) => Math.min(best, paceSecPerKm(r)), Infinity);
  const thisRunPace = run.duration_sec / (run.distance_m / 1000);
  const isPR        = historicFastest < Infinity && thisRunPace < historicFastest;

  // Pace zone
  let zoneName: string;
  if      (thisRunPace >= 390) zoneName = 'Easy';
  else if (thisRunPace >= 330) zoneName = 'Moderate';
  else if (thisRunPace >= 285) zoneName = 'Tempo';
  else                         zoneName = 'Hard';

  // Today's nutrition context (for recovery prescription)
  const todayStr     = todayISODate();
  const todayLog     = ctx.nutrition?.dailyLogs.find(d => d.date === todayStr) ?? null;
  const todayKcal    = todayLog?.kcal    ?? 0;
  const todayProtein = todayLog?.proteinG ?? 0;
  const targetKcal   = ctx.nutrition?.dailyGoalKcal ?? 0;
  const targetProtein = ctx.nutrition?.proteinGoalG  ?? 0;
  const caloriesBurned = Math.round((run.distance_m / 1000) * (ctx.nutrition?.weightKg ?? 70) * 1.036);
  const remaining    = Math.max(0, targetKcal - todayKcal + caloriesBurned);

  let recoveryInstruction = '';
  if (ctx.nutrition && targetKcal > 0) {
    recoveryInstruction = `
Today's nutrition: ${todayKcal} kcal consumed, ${todayProtein}g protein logged.
Run burned: ~${caloriesBurned} kcal. Remaining budget incl. burn: ${remaining} kcal.
Protein target: ${targetProtein}g. Protein still needed: ${Math.max(0, Math.round(targetProtein - todayProtein))}g.
${ctx.nutrition.daysUnderProtein80g >= 3 ? `Note: protein has been low ${ctx.nutrition.daysUnderProtein80g} of the last 7 days.` : ''}

Add a "recovery" field: a specific 2-sentence recovery prescription. Sentence 1: what to eat in the next 2 hours (be concrete — specific foods) and why. Sentence 2: reference today's logged nutrition numbers.`;
  }

  const distKm = fmtDist(run.distance_m);
  const dur    = fmtDuration(run.duration_sec);
  const pace   = run.avg_pace ?? fmtPaceSec(thisRunPace);

  const response = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 192,
    system:     'You are the Runivo AI Coach — a concise running coach. Return only valid JSON.',
    messages: [{
      role:    'user',
      content: `Post-run feedback.
This run: ${distKm} in ${dur}, pace ${pace}/km. Effort zone: ${zoneName}.
Recent avg pace (last 4 weeks): ${avgRecentPace}/km.
${isPR ? '★ THIS IS A NEW PERSONAL RECORD (fastest pace in last 90 days).' : ''}
${recoveryInstruction}

Respond ONLY with valid JSON (no markdown):
{"praise":"motivating 1-sentence praise ≤15 words","analysis":"specific 1-sentence performance note ≤20 words","suggestion":"1 actionable improvement ≤15 words"${ctx.nutrition && targetKcal > 0 ? `,"recovery":"..."` : ''}}

${isPR ? 'Acknowledge the PR in the praise.' : ''}`,
    }],
  });

  await logUsage(supabase, userId, 'post_run', response.usage);

  let payload: PostRunPayload;
  try {
    const text = (response.content[0] as { type: 'text'; text: string }).text;
    payload = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
  } catch {
    payload = {
      praise:     `${isPR ? 'New personal record! ' : ''}Great effort on that ${distKm} run!`,
      analysis:   `You ran ${pace}/km — ${zoneName.toLowerCase()} effort zone.`,
      suggestion: 'Stay hydrated and aim for 7–8 hours of sleep tonight.',
    };
  }

  await supabase.from('ai_cache').upsert({
    user_id:      userId,
    feature:      'post_run',
    payload,
    context_hash: hash,
    generated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,feature' });

  return payload;
}

async function handleTrainingPlan(
  anthropic: Anthropic,
  supabase: ReturnType<typeof createClient>,
  userId: string,
  goal: string,
  ctx: UserContext,
): Promise<TrainingPlanPayload> {
  // Check for an existing active plan with the same goal first
  const { data: activePlan } = await supabase
    .from('training_plans')
    .select('id, plan_data, goal')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activePlan && activePlan.goal === (goal || '')) {
    return { ...(activePlan.plan_data as TrainingPlanPayload), planId: activePlan.id };
  }

  const hashInput = { goal, weeklyKm: ctx.weeklyKm, runCount: ctx.runs90d.length, staleZoneCount: ctx.staleZoneCount };
  const hash      = await contextHash(hashInput);

  const response = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 1024,
    system:     'You are Runivo Intelligence — a running coach. Return only valid JSON.',
    messages: [{
      role:    'user',
      content: `Create a 4-week running training plan.
Current weekly avg: ${ctx.weeklyKm} km/week.
Pace zones: ${ctx.paceZones.easy}% easy / ${ctx.paceZones.moderate}% moderate / ${ctx.paceZones.tempo}% tempo / ${ctx.paceZones.hard}% hard.
Easy pace: ~${ctx.easyPace}/km. Tempo pace: ~${ctx.tempoPace}/km.
${ctx.prs.longestRun > 0 ? `Longest run ever: ${ctx.prs.longestRun} km.` : ''}
Territory: ${ctx.staleZoneCount} stale zones need defense runs. Territory Score: ${ctx.territoryScore} TS.
Goal: ${goal || 'improve general fitness and consistency'}.

Include zone-specific target paces in session descriptions (e.g. "5km at ${ctx.easyPace}/km easy").
Respond ONLY with valid JSON (no markdown):
{"weeks":[{"week":1,"focus":"short focus label","sessions":[{"day":"Mon","type":"Easy Run","description":"brief description with target pace"},{"day":"Wed","type":"Tempo","description":"brief description with target pace"},{"day":"Fri","type":"Long Run","description":"brief description with target pace"},{"day":"Sun","type":"Rest","description":"light stretching or walk"}]},{"week":2,...},{"week":3,...},{"week":4,...}]}

Keep descriptions under 15 words. Progressively overload each week.`,
    }],
  });

  await logUsage(supabase, userId, 'training_plan', response.usage);

  let payload: TrainingPlanPayload;
  try {
    const text = (response.content[0] as { type: 'text'; text: string }).text;
    payload = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
  } catch {
    const wkly = ctx.weeklyKm;
    payload = {
      weeks: [1, 2, 3, 4].map(w => ({
        week: w,
        focus: `Week ${w}: Build base`,
        sessions: [
          { day: 'Mon', type: 'Easy Run',  description: `${(wkly * 0.3 + w).toFixed(1)} km at ${ctx.easyPace}/km` },
          { day: 'Wed', type: 'Tempo',     description: `20 min at ${ctx.tempoPace}/km` },
          { day: 'Fri', type: 'Easy Run',  description: `${(wkly * 0.25 + w * 0.5).toFixed(1)} km easy recovery` },
          { day: 'Sun', type: 'Long Run',  description: `${(wkly * 0.4 + w).toFixed(1)} km at ${ctx.easyPace}/km` },
        ],
      })),
    };
  }

  await supabase.from('ai_cache').upsert({
    user_id:      userId,
    feature:      'training_plan',
    payload,
    context_hash: hash,
    generated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,feature' });

  // Persist into training_plans table
  let planId: string = '';
  if (activePlan) {
    // Replace existing plan with fresh generation for new goal
    await supabase
      .from('training_plans')
      .update({ goal, plan_data: payload, week_current: 1, updated_at: new Date().toISOString() })
      .eq('id', activePlan.id);
    planId = activePlan.id;
  } else {
    const { data: newPlan } = await supabase
      .from('training_plans')
      .insert({
        user_id:     userId,
        goal:        goal || 'improve general fitness',
        weeks_total: payload.weeks.length,
        week_current: 1,
        status:      'active',
        plan_data:   payload,
      })
      .select('id')
      .single();
    planId = newPlan?.id ?? '';
  }

  return { ...payload, planId };
}

async function handleCoachChat(
  anthropic: Anthropic,
  supabase: ReturnType<typeof createClient>,
  userId: string,
  userMessage: string,
  ctx: UserContext,
): Promise<string> {
  await supabase.from('coach_messages').insert({ user_id: userId, role: 'user', content: userMessage });

  const { data: history } = await supabase
    .from('coach_messages')
    .select('role, content')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  const messages = (history ?? [])
    .reverse()
    .map((m: { role: string; content: string }) => ({
      role:    m.role as 'user' | 'assistant',
      content: m.content,
    }));

  const recentRunLines = ctx.runs90d.slice(0, 20).map(r => {
    const d    = new Date(r.started_at);
    const date = `${d.getMonth() + 1}/${d.getDate()}`;
    const km   = ((r.distance_m ?? 0) / 1000).toFixed(1);
    const pace = r.avg_pace ?? '–';
    const min  = Math.round((r.duration_sec ?? 0) / 60);
    const extras: string[] = [];
    if (r.avg_hr)           extras.push(`HR ${r.avg_hr}bpm`);
    if (r.avg_cadence)      extras.push(`${r.avg_cadence}spm`);
    if (r.elevation_gain_m) extras.push(`↑${Math.round(r.elevation_gain_m)}m`);
    if (r.calories_kcal)    extras.push(`${r.calories_kcal}kcal`);
    const extraStr = extras.length ? ` [${extras.join(', ')}]` : '';
    return `${date}: ${km}km @ ${pace}/km (${min}min)${extraStr}`;
  }).join('\n');

  const prLines = [
    ctx.prs.fastestPace ? `Fastest pace: ${ctx.prs.fastestPace}/km`  : '',
    ctx.prs.longestRun  ? `Longest run: ${ctx.prs.longestRun} km`     : '',
    ctx.prs.best5kPace  ? `Best 5K pace: ${ctx.prs.best5kPace}/km`   : '',
  ].filter(Boolean).join(' | ');

  const raceLine = ctx.racePredictions
    ? `Race predictions: 5K ${ctx.racePredictions.fiveK} | 10K ${ctx.racePredictions.tenK} | Half ${ctx.racePredictions.half} | Full ${ctx.racePredictions.full}`
    : 'Not enough run data for race predictions yet.';

  const nutritionLine = ctx.nutrition
    ? `Daily goal: ${ctx.nutrition.dailyGoalKcal} kcal | Protein goal: ${ctx.nutrition.proteinGoalG}g | Goal: ${ctx.nutrition.goal} | Recent 7-day avg: ${ctx.nutrition.recentAvgKcal} kcal / ${ctx.nutrition.recentAvgProteinG}g protein | Days hit target: ${ctx.nutrition.daysHitKcalTarget}/7 | Days under 80g protein: ${ctx.nutrition.daysUnderProtein80g}/7`
    : 'No nutrition data logged.';

  const systemPrompt = `You are the Runivo AI Coach — an elite running coach and territory strategist embedded in the Runivo app.

ABOUT RUNIVO:
Runivo is a gamified running app where runners claim real-world territory by running through it. Your GPS path generates a corridor polygon. Rivals can steal your territory by running through it. Territory freshness decays over time (−10/day) — stale zones (freshness < 40) are easy to steal. Runners win by running consistently to defend and expand their ground.

ECONOMY (never mention XP, coins, energy, or levels):
- PACE: runners earn 1 PACE per km, 5 per new zone, 10 per rival zone stolen. Weekly cap: ${ctx.paceWeeklyCapLimit} PACE. Resets Monday.
- Territory Score (TS): sum of all polygon area × freshness multiplier. Competitive ranking.
- Runner Rank: Pacer → Strider → Chaser → Hunter → Sovereign. Based on total PACE earned all-time.
- Freshness: each polygon decays from 100 to 0 over 10 days. Below 40 = stale = easy to steal.

== RUNNER PROFILE ==
Rank: ${ctx.runnerRank} | PACE this week: ${ctx.paceWeeklyEarned} / ${ctx.paceWeeklyCapLimit}
Last 90 days: ${ctx.totalKm90d} km across ${ctx.runs90d.length} runs. Weekly avg: ${ctx.weeklyKm} km/wk.
Pace trend: ${ctx.trend}.

== RECENT RUNS (last 20) ==
${recentRunLines || 'No runs logged yet.'}

== PACE ZONE DISTRIBUTION ==
Easy (≥6:30/km): ${ctx.paceZones.easy}%
Moderate (5:30–6:29): ${ctx.paceZones.moderate}%
Tempo (4:45–5:29): ${ctx.paceZones.tempo}%
Hard (<4:45): ${ctx.paceZones.hard}%
Typical easy pace: ~${ctx.easyPace}/km. Typical tempo pace: ~${ctx.tempoPace}/km.

== PERSONAL RECORDS ==
${prLines || 'No personal records yet.'}
${raceLine}

== TERRITORY ==
Territory Score: ${ctx.territoryScore} TS | Largest tier: ${ctx.largestTierHeld}
Total area: ${Math.round(ctx.totalAreaM2).toLocaleString()} m²
Stale zones (freshness < 40): ${ctx.staleZoneCount} — rivals can steal these now
Average freshness: ${ctx.avgFreshness}%

== TRAINING PLAN & HABIT ==
${ctx.planCompliance ? `Goal: ${ctx.planCompliance.goal} (Week ${ctx.planCompliance.weekCurrent}/${ctx.planCompliance.weeksTotal})
This week: ${ctx.planCompliance.sessionsCompletedThisWeek}/${ctx.planCompliance.sessionsPlannedThisWeek} sessions completed, ${ctx.planCompliance.kmActualThisWeek} km run${ctx.planCompliance.sessionsMissedThisWeek > 0 ? `, ${ctx.planCompliance.sessionsMissedThisWeek} missed` : ' — on track'}
Run streak: ${ctx.planCompliance.streakDays} day${ctx.planCompliance.streakDays !== 1 ? 's' : ''}${ctx.planCompliance.avgConsistencyLast8Weeks !== null ? `
Avg consistency last 8 weeks: ${ctx.planCompliance.avgConsistencyLast8Weeks}%` : ''}` : `No active training plan. Current run streak: ${ctx.planCompliance?.streakDays ?? 0} days.`}

== NUTRITION ==
${nutritionLine}

== GEAR ==
${ctx.shoes.length > 0
  ? ctx.shoes.map(s => `${s.isDefault ? '[default] ' : ''}${s.name}: ${s.totalKm}km / ${s.maxKm}km (${s.pctWorn}% worn${s.pctWorn >= 85 ? ', NEAR RETIREMENT' : ''})`).join('\n')
  : 'No shoes tracked yet.'}

COACHING PHILOSOPHY:
1. Connect training advice to territorial benefit where relevant.
2. Be direct and specific — cite actual data (distances, paces, zones, PACE earned).
3. Never give generic advice when you have real data.
4. Injury: give general advice and recommend a physio. Never diagnose.
5. Off-topic: redirect warmly — "I'm your running and territory coach."

TONE: Confident, warm, competitive. Like a coach who has run 50 marathons and also plays chess. Keep responses under 180 words unless generating a structured plan.

GUARDRAILS:
- Only discuss: running, training, fitness, recovery, athlete nutrition, gear, Runivo territory strategy, PACE economy.
- Never: medical diagnosis, financial advice, political opinions.
- Never promise specific race times — give ranges.`;

  const response = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 512,
    system:     systemPrompt,
    messages,
  });

  await logUsage(supabase, userId, 'coach_chat', response.usage);

  const assistantText = (response.content[0] as { type: 'text'; text: string }).text;

  await supabase.from('coach_messages').insert({ user_id: userId, role: 'assistant', content: assistantText });

  return assistantText;
}

async function handleNutritionInsights(
  anthropic: Anthropic,
  supabase: ReturnType<typeof createClient>,
  userId: string,
  ctx: UserContext,
): Promise<NutritionInsightsPayload> {
  if (!ctx.nutrition) {
    return { cards: [], generatedAt: new Date().toISOString() };
  }

  const n          = ctx.nutrition;
  const lastRunId  = ctx.runs90d[0]?.id ?? null;
  const lastLogDate = n.dailyLogs[n.dailyLogs.length - 1]?.date ?? null;
  const hash       = await contextHash({
    lastRunId, lastLogDate,
    avgProtein: n.recentAvgProteinG, daysHit: n.daysHitKcalTarget,
  });

  const { data: cached } = await supabase
    .from('ai_cache')
    .select('payload, context_hash')
    .eq('user_id', userId)
    .eq('feature', 'nutrition_insights')
    .single();

  if (cached?.context_hash === hash) return cached.payload as NutritionInsightsPayload;

  // Build day-by-day run+nutrition table for Claude
  const runDates = new Set(ctx.runs90d.map(r => r.started_at.split('T')[0]));
  const logTable = n.dailyLogs.slice(-14).map(d => {
    const ran = runDates.has(d.date);
    return `${d.date}: ${ran ? 'RUN' : 'rest'} | ${Math.round(d.kcal)} kcal | ${Math.round(d.proteinG)}g protein | ${Math.round(d.carbsG)}g carbs`;
  }).join('\n');

  const response = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 512,
    system:     'You are Runivo Intelligence — a data-driven running and nutrition coach. Return only valid JSON.',
    messages: [{
      role:    'user',
      content: `Analyse this runner's last 14 days of nutrition and training data and generate 3-4 insight cards.

Protein goal: ${n.proteinGoalG}g/day. Calorie goal: ${n.dailyGoalKcal} kcal/day.
Days/nutrition for last 14 days:
${logTable}

Generate 3-4 cards that reveal patterns. Look for:
- Run-day vs rest-day nutrition differences
- Pre-run fuelling patterns (did they eat the day before big runs?)
- Protein consistency and its correlation with run performance
- Calorie deficit/surplus patterns

Respond ONLY with valid JSON (no markdown):
{"cards":[{"title":"short title ≤5 words","body":"2-3 sentences, specific and data-driven, referencing actual numbers from the data","icon":"one emoji"},{"title":"...","body":"...","icon":"..."},...]}

Be specific: reference actual grams, days, and patterns you can see in the data. Do not give generic nutrition advice.`,
    }],
  });

  await logUsage(supabase, userId, 'nutrition_insights', response.usage);

  let payload: NutritionInsightsPayload;
  try {
    const text = (response.content[0] as { type: 'text'; text: string }).text;
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
    payload = { cards: parsed.cards ?? [], generatedAt: new Date().toISOString() };
  } catch {
    payload = {
      cards: [{
        title: 'Log more data',
        body:  'Keep logging meals for a week and I\'ll find patterns in your nutrition and running.',
        icon:  '📊',
      }],
      generatedAt: new Date().toISOString(),
    };
  }

  await supabase.from('ai_cache').upsert({
    user_id:      userId,
    feature:      'nutrition_insights',
    payload,
    context_hash: hash,
    generated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,feature' });

  return payload;
}

// ─── Pace intelligence ────────────────────────────────────────────────────────
async function handlePaceIntelligence(
  anthropic: Anthropic,
  supabase: ReturnType<typeof createClient>,
  userId: string,
  ctx: UserContext,
): Promise<PaceIntelligencePayload> {
  const recentRuns = ctx.runs90d.slice(0, 30);
  const hash = await contextHash({
    runCount: recentRuns.length,
    lastDate: recentRuns[0]?.started_at?.slice(0, 10),
    avgPace: ctx.easyPace,
    weeklyKm: Math.round(ctx.weeklyKm),
    trend: ctx.trend,
    paceEarned: ctx.paceWeeklyEarned,
  });

  const { data: cached } = await supabase
    .from('ai_cache')
    .select('payload, context_hash')
    .eq('user_id', userId)
    .eq('feature', 'pace_intelligence')
    .single();

  if (cached?.context_hash === hash) return cached.payload as PaceIntelligencePayload;

  const prompt = `You are Pace, the Runivo running coach. Analyze this runner's data and return exactly 3 insight cards as JSON.

RUNNER: ${ctx.totalKm90d.toFixed(1)} km in 90 days, ${recentRuns.length} runs, trend: ${ctx.trend}
EASY PACE: ${ctx.easyPace} /km, TEMPO: ${ctx.tempoPace} /km
WEEKLY AVG (last 8 weeks): ${ctx.weeklyKm.toFixed(1)} km/wk
BEST: longest ${ctx.prs.longestRun.toFixed(1)} km, fastest pace ${ctx.prs.fastestPace ?? 'N/A'}

Generate 3 insight cards. Each must cite SPECIFIC numbers from the data. Do not be generic.
Required types: (1) PACING pattern, (2) WEEKLY LOAD trend, (3) ONE concrete improvement.

Return ONLY valid JSON:
{"insights":[{"icon":"emoji","headline":"≤12 words specific claim","body":"2 sentences with actual numbers","recommendation":"≤15 words concrete action"}]}`;

  const response = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 400,
    system:     'You are Runivo Intelligence — a data-driven running coach. Return only valid JSON.',
    messages: [{ role: 'user', content: prompt }],
  });

  await logUsage(supabase, userId, 'pace_intelligence', response.usage);

  let parsed: PaceIntelligencePayload;
  try {
    const text = (response.content[0] as { type: 'text'; text: string }).text;
    const raw = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
    parsed = { insights: raw.insights ?? [], generatedAt: new Date().toISOString() };
  } catch {
    parsed = { insights: [], generatedAt: new Date().toISOString() };
  }

  await supabase.from('ai_cache').upsert({
    user_id:      userId,
    feature:      'pace_intelligence',
    payload:      parsed,
    context_hash: hash,
    generated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,feature' });

  return parsed;
}

// ─── Territory strategy ───────────────────────────────────────────────────────
async function handleTerritoryStrategy(
  anthropic: Anthropic,
  ctx: UserContext,
): Promise<string> {
  const staleDesc = ctx.staleZoneCount > 0
    ? `${ctx.staleZoneCount} stale zone(s) with avg freshness ${ctx.avgFreshness}% — rivals can steal these now.`
    : 'All zones are currently fresh (freshness ≥ 40).';

  const recentRunLines = ctx.runs90d.slice(0, 5)
    .map(r => `- ${((r.distance_m ?? 0) / 1000).toFixed(1)}km at ${r.avg_pace ?? '–'}/km`)
    .join('\n');

  const response = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 400,
    system:     'You are the Runivo AI Coach — a territory strategist. Be specific and competitive.',
    messages: [{
      role:    'user',
      content: `Plan a territory strategy for ${ctx.runnerRank}-ranked runner.

TERRITORY STATUS:
- Score: ${ctx.territoryScore} TS | Largest tier: ${ctx.largestTierHeld}
- Total area: ${Math.round(ctx.totalAreaM2).toLocaleString()} m²
- ${staleDesc}
- PACE this week: ${ctx.paceWeeklyEarned} / ${ctx.paceWeeklyCapLimit}

RECENT RUNS:
${recentRunLines || 'No recent runs.'}

Give a specific 3-run strategy: which zones to prioritize defending, optimal route types (loop for park capture vs corridor for street claiming), and how to balance defense vs expansion given their current fitness. Under 250 words. Be competitive — frame it as protecting their empire.`,
    }],
  });

  return (response.content[0] as { type: 'text'; text: string }).text;
}

// ─── Quick prompts ────────────────────────────────────────────────────────────
function handleQuickPrompts(ctx: UserContext): Array<{ label: string; message: string }> {
  const prompts: Array<{ label: string; message: string }> = [];

  // Days since last run
  const lastRun = ctx.runs90d[0];
  const daysSince = lastRun
    ? Math.floor((Date.now() - new Date(lastRun.started_at).getTime()) / 86_400_000)
    : 999;

  if (daysSince >= 4) {
    prompts.push({
      label:   `${daysSince} days off — plan a comeback run?`,
      message: `It's been ${daysSince} days since my last run. Help me plan a good comeback run based on my fitness.`,
    });
  } else if (ctx.trend === 'declining') {
    prompts.push({
      label:   'Your pace has dropped — why?',
      message: 'My pace has been declining recently. Based on my data, what could be causing it and how do I fix it?',
    });
  } else if (ctx.trend === 'improving') {
    prompts.push({
      label:   "You're improving — what's next?",
      message: 'My pace has been improving lately. Based on my current fitness, what should my next goal be?',
    });
  }

  // Weekly volume check
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const thisWeekKm   = ctx.runs90d
    .filter(r => r.started_at >= sevenDaysAgo)
    .reduce((s, r) => s + (r.distance_m ?? 0) / 1000, 0);
  const weeklyGoal   = ctx.weeklyKm * 1.1; // 10% more than current avg = goal
  if (prompts.length < 2 && thisWeekKm < weeklyGoal * 0.5) {
    prompts.push({
      label:   'Behind weekly goal — catch up plan?',
      message: `I'm only at ${thisWeekKm.toFixed(1)} km this week. Help me catch up to my weekly goal without overtraining.`,
    });
  }

  // Nutrition prompt
  if (prompts.length < 3 && ctx.nutrition && ctx.nutrition.daysUnderProtein80g >= 4) {
    prompts.push({
      label:   'Low protein this week — fix it?',
      message: `I've been under 80g protein for ${ctx.nutrition.daysUnderProtein80g} days this week. How should I adjust my diet to support my training?`,
    });
  }

  // Shoe wear warning
  if (prompts.length < 3) {
    const wornShoe = ctx.shoes.find(s => s.pctWorn >= 85 && s.isDefault);
    if (wornShoe) {
      prompts.push({
        label:   `${wornShoe.name} at ${wornShoe.pctWorn}% — replace soon?`,
        message: `My main running shoes (${wornShoe.name}) are at ${wornShoe.pctWorn}% worn (${wornShoe.totalKm}/${wornShoe.maxKm} km). Should I replace them now and what should I look for?`,
      });
    }
  }

  // Pad with quality static fallbacks
  const fallbacks: Array<{ label: string; message: string }> = [
    { label: 'Build me a training plan',       message: 'Build me a personalised training plan based on my current fitness and weekly schedule.' },
    { label: 'Analyse my last run',            message: 'Analyse my most recent run and tell me what it reveals about my current fitness.' },
    { label: 'How to improve my pace?',        message: 'Based on my recent runs, what is the most effective way for me to improve my pace?' },
    { label: 'What to eat before a long run?', message: 'What should I eat the day before and morning of a long run, based on my nutrition goals?' },
  ];
  for (const fb of fallbacks) {
    if (prompts.length >= 4) break;
    if (!prompts.some(p => p.message === fb.message)) prompts.push(fb);
  }

  return prompts.slice(0, 4);
}

async function handleAdaptPlan(
  anthropic: Anthropic,
  supabase: ReturnType<typeof createClient>,
  userId: string,
  planId: string,
  ctx: UserContext,
): Promise<{ planId: string; adaptedWeek: Array<{ day: string; type: string; description: string }> }> {
  const { data: plan } = await supabase
    .from('training_plans')
    .select('id, goal, week_current, weeks_total, plan_data')
    .eq('id', planId)
    .eq('user_id', userId)
    .single();

  if (!plan) throw new Error('Plan not found');

  const weekIdx     = (plan.week_current as number) - 1;
  const planData    = plan.plan_data as TrainingPlanPayload;
  const currentWeek = planData.weeks[weekIdx];

  // Find runs from the past 7 days to assess adherence
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const recentRuns   = ctx.runs90d.filter(r => r.started_at >= sevenDaysAgo);
  const totalRecentKm = recentRuns.reduce((s, r) => s + (r.distance_m ?? 0) / 1000, 0);
  const runDays       = new Set(recentRuns.map(r => r.started_at.split('T')[0])).size;

  // Count completed vs planned sessions
  const plannedActive = currentWeek?.sessions.filter(s => s.type !== 'Rest').length ?? 0;

  const response = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 512,
    system:     'You are Runivo Intelligence — a running coach. Return only valid JSON.',
    messages: [{
      role:    'user',
      content: `Adapt training plan for next week (Week ${(plan.week_current as number) + 1}).
Goal: ${plan.goal}.
Last week planned: ${plannedActive} active sessions. Actual: ${runDays} run days, ${totalRecentKm.toFixed(1)} km.
Weekly avg (90d): ${ctx.weeklyKm} km/wk. Easy pace: ~${ctx.easyPace}/km. Tempo: ~${ctx.tempoPace}/km.
Trend: ${ctx.trend}.

Rules: if actual km < 70% of planned, reduce next week by 10%. If actual km ≥ planned, increase by 5–10%.
Respond ONLY with valid JSON:
{"note":"one sentence explaining the adaptation ≤20 words","sessions":[{"day":"Mon","type":"Easy Run","description":"brief ≤12 words"},{"day":"Wed","type":"Tempo","description":"brief ≤12 words"},{"day":"Fri","type":"Long Run","description":"brief ≤12 words"},{"day":"Sun","type":"Rest","description":"light stretching"}]}`,
    }],
  });

  await logUsage(supabase, userId, 'adapt_plan', response.usage);

  let adaptedNote    = 'Adapted based on last week\'s performance.';
  let adaptedSessions: Array<{ day: string; type: string; description: string }> = currentWeek?.sessions ?? [];

  try {
    const text   = (response.content[0] as { type: 'text'; text: string }).text;
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
    adaptedNote    = parsed.note ?? adaptedNote;
    adaptedSessions = parsed.sessions ?? adaptedSessions;
  } catch { /* use defaults */ }

  // Update plan_data for current week with adapted sessions
  const updatedWeeks = planData.weeks.map((w, i) =>
    i === weekIdx ? { ...w, sessions: adaptedSessions } : w
  );

  await supabase
    .from('training_plans')
    .update({ plan_data: { weeks: updatedWeeks }, updated_at: new Date().toISOString() })
    .eq('id', planId);

  await supabase
    .from('plan_adaptations')
    .insert({
      plan_id:          planId,
      week_number:      plan.week_current,
      adaptation_note:  adaptedNote,
      adapted_sessions: adaptedSessions,
    });

  return { planId, adaptedWeek: adaptedSessions };
}

// ─── Habit tracking ───────────────────────────────────────────────────────────
async function handleHabitTracking(
  anthropic: Anthropic,
  supabase: ReturnType<typeof createClient>,
  userId: string,
  ctx: UserContext,
): Promise<string> {
  const pc      = ctx.planCompliance;
  const streak  = pc?.streakDays ?? 0;
  const history = pc?.consistencyLast8Weeks ?? [];
  const avg8w   = pc?.avgConsistencyLast8Weeks;

  // Recent run day pattern (last 28 days)
  const twentyEightDaysAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();
  const recentRuns = ctx.runs90d.filter(r => r.started_at >= twentyEightDaysAgo);
  const dayNames   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayCounts: Record<string, number> = {};
  for (const r of recentRuns) {
    const name = dayNames[new Date(r.started_at).getDay()];
    dayCounts[name] = (dayCounts[name] ?? 0) + 1;
  }
  const dayPattern = dayNames
    .map(d => `${d}:${dayCounts[d] ?? 0}`)
    .join(' ');

  const runLines = recentRuns.slice(0, 14).map(r => {
    const d = new Date(r.started_at);
    return `${dayNames[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}: ${((r.distance_m ?? 0) / 1000).toFixed(1)}km`;
  }).join(', ');

  const planSection = pc
    ? `TRAINING PLAN: "${pc.goal}" (Week ${pc.weekCurrent}/${pc.weeksTotal})
This week: ${pc.sessionsCompletedThisWeek}/${pc.sessionsPlannedThisWeek} sessions completed${pc.sessionsMissedThisWeek > 0 ? `, ${pc.sessionsMissedThisWeek} missed` : ', on track'}
Consistency last 8 weeks (oldest→newest): ${history.length > 0 ? history.join('%, ') + '%' : 'no history yet'}
8-week average: ${avg8w !== null ? avg8w + '%' : 'N/A'}`
    : 'No active training plan — running without a curriculum.';

  const content = `You are Pace, the Runivo running coach. Give ${ctx.runnerRank}-ranked runner a habit analysis.

STREAK: ${streak} day${streak !== 1 ? 's' : ''} current run streak

${planSection}

DAY PATTERN (last 28 days, runs per day):
${dayPattern}

RECENT RUNS:
${runLines || 'No recent runs.'}

Write a habit analysis in EXACTLY these 4 sections. Label each section clearly.

1. STREAK — Comment on the ${streak}-day streak specifically. Is ${streak} days impressive for their level? Compare to typical runners.
2. CONSISTENCY — Interpret the plan compliance data. What does the trend say — building, plateauing, declining?
3. PATTERN — Which days do they actually run vs avoid? Name the specific days. Is there a gap that hurts progress?
4. ONE FOCUS — One specific, actionable habit change. Not generic. Reference their actual data.

Be direct. Use real numbers. Under 220 words total. Conversational, not clinical.`;

  const response = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 400,
    system:     'You are Pace — a direct, data-driven running coach embedded in the Runivo app.',
    messages:   [{ role: 'user', content }],
  });

  await logUsage(supabase, userId, 'coach_chat', response.usage);

  const reply = (response.content[0] as { type: 'text'; text: string }).text;

  await supabase.from('coach_messages').insert({
    user_id:    userId,
    role:       'assistant',
    content:    reply,
    created_at: new Date().toISOString(),
  });

  return reply;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!jwt) return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });

    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });

    const body: RequestBody = await req.json();
    const { feature, runId, message, goal } = body;

    if (!feature) return new Response('Missing feature', { status: 400, headers: CORS_HEADERS });

    // food_scan is a lightweight vision call — handle before context build + cap check
    if (feature === 'food_scan') {
      const { imageBase64, mediaType = 'image/jpeg' } = body;
      if (!imageBase64) return new Response('Missing imageBase64', { status: 400, headers: CORS_HEADERS });

      const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '' });
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: imageBase64 },
            },
            {
              type: 'text',
              text: 'Identify this food and estimate its nutrition for one typical serving. Be concise. Respond ONLY with valid JSON, no markdown: {"name":"...","kcal":0,"proteinG":0,"carbsG":0,"fatG":0,"servingSize":"..."}',
            },
          ],
        }],
      });

      const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return new Response(JSON.stringify({ error: 'Could not identify food' }), { status: 422, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

      return new Response(JSON.stringify({ data: JSON.parse(match[0]) }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Enforce per-user daily spend cap before touching Claude
    await enforceDailyCap(supabase, user.id, feature, CORS_HEADERS);

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '' });

    // Build full user context once — shared across all handlers
    const ctx = await buildUserContext(supabase, user.id);

    let result: unknown;

    switch (feature) {
      case 'weekly_brief':
        result = await handleWeeklyBrief(anthropic, supabase, user.id, ctx);
        break;

      case 'post_run':
        if (!runId) return new Response('Missing runId', { status: 400, headers: CORS_HEADERS });
        result = await handlePostRun(anthropic, supabase, user.id, runId, ctx);
        break;

      case 'training_plan':
        result = await handleTrainingPlan(anthropic, supabase, user.id, goal ?? '', ctx);
        break;

      case 'coach_chat':
        if (!message) return new Response('Missing message', { status: 400, headers: CORS_HEADERS });
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

      case 'adapt_plan': {
        const apPlanId = body.planId;
        if (!apPlanId) return new Response('Missing planId', { status: 400, headers: CORS_HEADERS });
        result = await handleAdaptPlan(anthropic, supabase, user.id, apPlanId, ctx);
        break;
      }

      case 'habit_tracking':
        result = await handleHabitTracking(anthropic, supabase, user.id, ctx);
        break;

      default:
        return new Response('Unknown feature', { status: 400, headers: CORS_HEADERS });
    }

    return new Response(JSON.stringify({ data: result }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    // enforceDailyCap throws a pre-built Response for 429s — pass it through
    if (err instanceof Response) return err;
    console.error('ai-coach error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
