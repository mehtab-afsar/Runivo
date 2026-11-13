/**
 * Labels for the "Clubs near you" list. Distances arrive from the server
 * already rounded to 0.1 km; these never add precision back.
 */

/** "Under 1 km", "4.6 km", "12 km". Null when the club has no distance. */
export function clubDistanceLabel(distanceKm: number | null | undefined): string | null {
  if (distanceKm == null || !Number.isFinite(distanceKm) || distanceKm < 0) return null;
  if (distanceKm < 1) return 'Under 1 km';
  if (distanceKm < 10) return `${distanceKm.toFixed(1)} km`;
  return `${Math.round(distanceKm)} km`;
}

/** Section heading: nearby clubs, or the popular fallback. */
export function clubsSectionTitle(nearby: boolean): string {
  return nearby ? 'Clubs near you' : 'Popular clubs';
}

/** Sub line on a club row: distance first when we have it, then members and km. */
export function clubMetaLine(club: { distance_km?: number | null; city?: string | null; member_count: number; total_km: number }): string {
  const parts: string[] = [];
  const d = clubDistanceLabel(club.distance_km);
  if (d) parts.push(club.city ? `${d} · ${club.city}` : d);
  parts.push(`${club.member_count} ${club.member_count === 1 ? 'member' : 'members'}`);
  parts.push(`${Math.round(club.total_km)} km run`);
  return parts.join(' · ');
}
