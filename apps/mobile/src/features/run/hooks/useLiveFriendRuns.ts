import { friendColor } from '@theme/territory';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchLiveFriendPositions,
  subscribeLiveFriendPositions,
  type LiveFriendPosition,
} from '@shared/services/liveRunSharing';
import { fetchPublicProfiles } from '@mobile/shared/services/publicProfiles';

export interface LiveFriendRunner {
  userId: string;
  lat: number;
  lng: number;
  updatedAt: number;
  username: string;
  avatarColor: string;
  avatarUrl?: string | null;
  startedAt?: number;
  distanceM?: number;
  elapsedSec?: number;
}

// Safety net: if a runner's app crashes/loses network without ever clearing
// its row, the RLS staleness window (30s) still hides it from a *fresh*
// fetch — but a client that already received an upsert via realtime keeps
// showing the last-known point until told otherwise. This prunes anything
// that's gone quiet, so a vanished friend doesn't linger on the map forever.
const STALE_MS = 45_000;
const PRUNE_INTERVAL_MS = 10_000;

/** Live friends currently visible to the caller — mutual connections who
 *  opted in to Live Run Sharing and are actively running right now. */
export function useLiveFriendRuns() {
  const [runners, setRunners] = useState<Record<string, LiveFriendRunner>>({});
  const profileCacheRef = useRef<Map<string, { username: string; avatarColor: string; avatarUrl: string | null }>>(new Map());

  const resolveProfiles = useCallback(async (userIds: string[]) => {
    const missing = userIds.filter(id => !profileCacheRef.current.has(id));
    if (missing.length === 0) return;
    // profiles is owner-only; other runners' names and photos come from profiles_public.
    const got = await fetchPublicProfiles(missing).catch(() => new Map());
    for (const [id, p] of got) {
      profileCacheRef.current.set(id, {
        username: p.username ?? 'Runner',
        avatarColor: p.avatar_color ?? friendColor(id),
        avatarUrl: p.avatar_url ?? null,
      });
    }
  }, []);

  const applyPosition = useCallback(async (pos: LiveFriendPosition) => {
    await resolveProfiles([pos.userId]);
    const profile = profileCacheRef.current.get(pos.userId);
    setRunners(prev => ({
      ...prev,
      [pos.userId]: {
        userId: pos.userId,
        lat: pos.lat,
        lng: pos.lng,
        updatedAt: pos.updatedAt,
        startedAt: pos.startedAt, distanceM: pos.distanceM, elapsedSec: pos.elapsedSec,
        username: profile?.username ?? 'Runner',
        avatarColor: profile?.avatarColor ?? friendColor(pos.userId),
        avatarUrl: profile?.avatarUrl ?? null,
      },
    }));
  }, [resolveProfiles]);

  const removeRunner = useCallback((userId: string) => {
    setRunners(prev => {
      if (!(userId in prev)) return prev;
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchLiveFriendPositions().then(async positions => {
      if (cancelled) return;
      await resolveProfiles(positions.map(p => p.userId));
      if (cancelled) return;
      setRunners(Object.fromEntries(positions.map(p => {
        const profile = profileCacheRef.current.get(p.userId);
        return [p.userId, {
          userId: p.userId, lat: p.lat, lng: p.lng, updatedAt: p.updatedAt,
          startedAt: p.startedAt, distanceM: p.distanceM, elapsedSec: p.elapsedSec,
          username: profile?.username ?? 'Runner',
          avatarColor: profile?.avatarColor ?? friendColor(p.userId),
        }];
      })));
    }).catch(() => {});

    const unsubscribe = subscribeLiveFriendPositions(
      pos => { applyPosition(pos).catch(() => {}); },
      removeRunner,
    );

    const pruneInterval = setInterval(() => {
      const cutoff = Date.now() - STALE_MS;
      setRunners(prev => {
        const stale = Object.values(prev).filter(r => r.updatedAt < cutoff);
        if (stale.length === 0) return prev;
        const next = { ...prev };
        for (const r of stale) delete next[r.userId];
        return next;
      });
    }, PRUNE_INTERVAL_MS);

    return () => {
      cancelled = true;
      unsubscribe();
      clearInterval(pruneInterval);
    };
  }, [applyPosition, removeRunner, resolveProfiles]);

  return Object.values(runners);
}
