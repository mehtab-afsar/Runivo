/**
 * Which Runivo user owns an incoming watch activity.
 *
 * Garmin's push payload is shared by every user of the app: each activity
 * carries the Garmin `userId` and the `userAccessToken` that user authorised.
 * We match on the token (kept in the server-only `secrets` column at connect
 * time) or on the Garmin user id once we have learnt it. No match, or more
 * than one, means we do not know whose run it is: it is dropped, never given
 * to "the first connected user" (the old behaviour).
 *
 * Plain TypeScript, no Deno APIs, so it is unit-tested with vitest.
 */
export interface ConnectionRow {
  user_id: string;
  metadata?: Record<string, unknown> | null;
  secrets?: Record<string, unknown> | null;
}

export interface ActivityOwnerHint {
  providerUserId?: string | null;
  providerToken?: string | null;
}

export type MatchResult =
  | { ok: true; userId: string; learnProviderUserId: string | null }
  | { ok: false; reason: 'no_hint' | 'no_match' | 'ambiguous' };

export function matchConnection(connections: ConnectionRow[], hint: ActivityOwnerHint): MatchResult {
  const token = hint.providerToken?.trim() || null;
  const pid = hint.providerUserId?.trim() || null;
  if (!token && !pid) return { ok: false, reason: 'no_hint' };

  const byToken = token
    ? connections.filter(c => typeof c.secrets?.access_token === 'string' && c.secrets.access_token === token)
    : [];
  const byPid = pid
    ? connections.filter(c => typeof c.metadata?.provider_user_id === 'string' && c.metadata.provider_user_id === pid)
    : [];

  const users = new Set([...byToken, ...byPid].map(c => c.user_id));
  if (users.size === 0) return { ok: false, reason: 'no_match' };
  if (users.size > 1) return { ok: false, reason: 'ambiguous' };

  const userId = [...users][0];
  // Remember the Garmin user id so later pushes match even after a token refresh.
  const known = [...byToken, ...byPid].some(c => c.metadata?.provider_user_id === pid);
  return { ok: true, userId, learnProviderUserId: pid && !known ? pid : null };
}
