import { supabase } from '@shared/services/supabase';

export interface YearStats {
  year: number;
  activities: number; km: number; hours: number; longestKm: number; activeDays: number;
  zonesClaimed: number; paceEarned: number;
  biggestStealM2: number | null; biggestStealFrom: string | null; timesStolenFrom: number;
  biggestZoneM2: number | null; bestMonth: number | null; bestMonthKm: number | null;
}

/** One runner's year (20261113000006_year_in_runivo.sql). */
export async function fetchYear(year: number): Promise<YearStats | null> {
  const { data, error } = await supabase.rpc('get_year_in_runivo', { p_year: year });
  if (error) throw new Error(error.message);
  const r = (data as Record<string, number | string | null>[] | null)?.[0];
  if (!r) return null;
  const n = (k: string) => (r[k] == null ? 0 : Number(r[k]));
  const nn = (k: string) => (r[k] == null ? null : Number(r[k]));
  return {
    year, activities: n('activities'), km: n('km'), hours: n('hours'), longestKm: n('longest_km'), activeDays: n('active_days'),
    zonesClaimed: n('zones_claimed'), paceEarned: n('pace_earned'),
    biggestStealM2: nn('biggest_steal_m2'), biggestStealFrom: (r.biggest_steal_from as string | null) ?? null, timesStolenFrom: n('times_stolen_from'),
    biggestZoneM2: nn('biggest_zone_m2'), bestMonth: nn('best_month'), bestMonthKm: nn('best_month_km'),
  };
}
