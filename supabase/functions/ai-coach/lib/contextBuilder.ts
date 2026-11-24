// Fetches the runner's data (runs, territory, profile, nutrition, events, gear,
// training plan) in one parallel fan-out and assembles the UserContext every
// handler reasons from. The calculations live in contextMetrics / planCompliance.
import { isPlusTier } from './authAndRateLimit.ts';
import { computeNutrition, computeRunMetrics, computeTerritory } from './contextMetrics.ts';
import type { EventRow, NutritionLogRow, NutritionProfileRow, PolygonRow } from './contextMetrics.ts';
import { todayISODate } from './format.ts';
import { computePlanCompliance } from './planCompliance.ts';
import type { ActivePlanRow } from './planCompliance.ts';
import type { Db, RunRecord, UserContext } from './types.ts';

interface ProfileRow {
  runner_rank: string | null; pace_weekly_earned: number | null; pace_total_earned: number | null;
  subscription_tier: string | null; territory_score: number | null; streak_days: number | null;
  primary_goal: string | null; experience_level: string | null; weekly_frequency: number | null;
  weekly_goal_km: number | null; usual_distance_km: number | null; recent_5k_seconds: number | null;
  pacex_tone: string | null; age_range: string | null; health_baseline: unknown; health_consent_at: string | null;
  race_distance: string | null; race_date: string | null; race_goal_seconds: number | null; run_days: number[] | null;
  long_run_day: number | null; usual_run_time: string | null; weekday_minutes: number | null; niggles: string[] | null; returning_from_break: boolean | null;
}

interface ShoeRow {
  brand: string; model: string; nickname: string | null; total_km: number; max_km: number; is_default: boolean;
}

export async function buildUserContext(supabase: Db, userId: string): Promise<UserContext> {
  const ninetyDaysAgo   = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const todayStr        = todayISODate();

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
      .select('runner_rank, pace_weekly_earned, pace_total_earned, subscription_tier, territory_score, streak_days, primary_goal, experience_level, weekly_frequency, weekly_goal_km, usual_distance_km, recent_5k_seconds, pacex_tone, age_range, health_baseline, health_consent_at, race_distance, race_date, race_goal_seconds, run_days, long_run_day, usual_run_time, weekday_minutes, niggles, returning_from_break')
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
      .select('events!inner(starts_at)')
      .eq('user_id', userId)
      .gte('events.starts_at', todayStr)
      .order('starts_at', { ascending: true, referencedTable: 'events' })
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

  const runs90d    = (runsRes.data ?? []) as RunRecord[];
  const profileRow = profileRes.data as ProfileRow | null;
  const metrics    = computeRunMetrics(runs90d);
  const territory  = computeTerritory((polygonsRes.data ?? []) as PolygonRow[]);

  const nutrition = nutritionProfileRes.data
    ? computeNutrition(
        nutritionProfileRes.data as NutritionProfileRow,
        (nutritionLogsRes.data ?? []) as NutritionLogRow[],
        eventsRes.data as EventRow | null,
      )
    : null;

  const planCompliance = computePlanCompliance(
    activePlanRes.data as ActivePlanRow | null,
    runs90d,
    profileRow?.streak_days ?? 0,
    (consistencyHistRes.data ?? []) as Array<{ consistency_score: number }>,
  );

  return {
    runs90d,
    totalKm90d:    parseFloat(runs90d.reduce((s, r) => s + (r.distance_m ?? 0) / 1000, 0).toFixed(1)),
    weeklyKm:      metrics.weeklyKm,
    trend:         metrics.trend,
    paceZones:     metrics.paceZones,
    easyPace:      metrics.easyPace,
    tempoPace:     metrics.tempoPace,
    prs:           metrics.prs,
    racePredictions: metrics.racePredictions,
    staleZoneCount:     territory.staleZoneCount,
    avgFreshness:       territory.avgFreshness,
    totalAreaM2:        territory.totalArea,
    largestTierHeld:    territory.largestTierHeld,
    territoryScore:     profileRow?.territory_score ?? 0,
    runnerRank:         profileRow?.runner_rank ?? 'pacer',
    paceWeeklyEarned:   profileRow?.pace_weekly_earned ?? 0,
    paceWeeklyCapLimit: isPlusTier(profileRow?.subscription_tier) ? 150 : 100,
    runner: {
      goal:             profileRow?.primary_goal ?? null,
      tone:             profileRow?.pacex_tone ?? 'encouraging',
      experience:       profileRow?.experience_level ?? null,
      weeklyRuns:       profileRow?.weekly_frequency ?? null,
      declaredWeeklyKm: profileRow?.weekly_goal_km ?? null,
      usualDistanceKm:  profileRow?.usual_distance_km ?? null,
      recent5kSeconds:  profileRow?.recent_5k_seconds ?? null,
      ageRange:         profileRow?.age_range ?? null,
      // Health data is used only while consent stands.
      healthBaseline:   profileRow?.health_consent_at ? profileRow.health_baseline : null,
      raceDistance:       profileRow?.race_distance ?? null,
      raceDate:           profileRow?.race_date ?? null,
      raceGoalSeconds:    profileRow?.race_goal_seconds ?? null,
      runDays:            profileRow?.run_days ?? null,
      longRunDay:         profileRow?.long_run_day ?? null,
      usualRunTime:       profileRow?.usual_run_time ?? null,
      weekdayMinutes:     profileRow?.weekday_minutes ?? null,
      niggles:            profileRow?.niggles ?? [],
      returningFromBreak: profileRow?.returning_from_break ?? false,
    },
    planCompliance,
    nutrition,
    shoes: ((shoesRes.data ?? []) as ShoeRow[]).map(s => ({
      name:      s.nickname ?? `${s.brand} ${s.model}`,
      totalKm:   Math.round(s.total_km ?? 0),
      maxKm:     s.max_km ?? 700,
      pctWorn:   Math.round(((s.total_km ?? 0) / (s.max_km ?? 700)) * 100),
      isDefault: s.is_default ?? false,
    })),
  };
}
