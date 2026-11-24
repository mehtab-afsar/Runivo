/**
 * Pure helpers for ClubDetailScreen: tab model and the strings it builds.
 * No React / react-native imports so they run under vitest in node.
 */

export type DetailTab = 'home' | 'chat' | 'runs' | 'ground' | 'members' | 'leaderboard' | 'activity' | 'admin';

export interface DetailTabOption { key: DetailTab; label: string }

export type ClubRole = 'admin' | 'member';

const ACTION_LABELS: Record<string, string> = {
  captured: 'captured a territory',
  lost: 'lost a territory',
  defended: 'defended a territory',
  joined: 'joined the club',
  leveled_up: 'leveled up',
};

/** Human wording for an activity action; unknown actions pass through as-is. */
export function activityLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

/** "5m ago" / "3h ago" / "2d ago" for an ISO timestamp. */
export function formatTimeAgo(time: string, now: number = Date.now()): string {
  const diff = now - new Date(time).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Mock: Home · Chat · Members · Board (+ Admin for admins). Runs and Territory open from Home. */
export function buildTabs(role: ClubRole | null): DetailTabOption[] {
  return [
    { key: 'home', label: 'Home' },
    { key: 'chat', label: 'Chat' },
    { key: 'members', label: 'Members' },
    { key: 'leaderboard', label: 'Board' },
    ...(role === 'admin' ? [{ key: 'admin' as DetailTab, label: 'Admin' }] : []),
  ];
}

/** Runs and Territory are sub-pages of Home, so the tab bar keeps Home selected. */
export function resolveTabValue(tab: DetailTab): DetailTab {
  return tab === 'runs' || tab === 'ground' ? 'home' : tab;
}

/** "12 members · 340 km · admin" under the club name. */
export function clubSubLine(memberCount: number, totalKm: number, isAdmin: boolean): string {
  return `${memberCount} ${memberCount === 1 ? 'member' : 'members'} · ${Math.round(totalKm).toLocaleString()} km${isAdmin ? ' · admin' : ''}`;
}

/** Label on the join button shown to a visitor who is not a member yet. */
export function joinButtonLabel(
  joining: boolean,
  invite: string | undefined,
  joinPolicy: 'open' | 'invite_only' | undefined,
  clubName: string,
): string {
  if (joining) return 'Joining…';
  return invite || joinPolicy !== 'invite_only' ? `Join ${clubName}` : 'Ask to join';
}

/** Secondary line on a member row. */
export function memberMetaLine(totalKm: number): string {
  return totalKm >= 1 ? `${totalKm.toFixed(0)} km with the club` : 'New member';
}

/** "3 reports · spam, harassment" on a reported message. */
export function reportSummaryLine(reports: number, reasons: string[]): string {
  return `${reports} report${reports > 1 ? 's' : ''} · ${reasons.join(', ')}`;
}
