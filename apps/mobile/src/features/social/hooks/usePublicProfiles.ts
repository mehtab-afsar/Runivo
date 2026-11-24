/**
 * Names and photos for other runners, by id, from profiles_public.
 *
 * `profiles` itself is owner-only (PII lockdown), so any screen that read another
 * runner's name from it got nothing back and fell back to "Runner" / "A friend".
 * This caches per app session so live carousels and markers don't refetch.
 */
import { useEffect, useState } from 'react';
import { fetchPublicProfiles, type PublicProfile } from '@mobile/shared/services/publicProfiles';

const cache = new Map<string, PublicProfile>();

/** The cached profile, if one was already fetched. */
export function cachedPublicProfile(id: string): PublicProfile | undefined {
  return cache.get(id);
}

/** Fetches what isn't cached yet and returns the whole cache entry set for `ids`. */
export async function loadPublicProfiles(ids: string[]): Promise<Map<string, PublicProfile>> {
  const missing = [...new Set(ids)].filter(id => id && !cache.has(id));
  if (missing.length) {
    const got = await fetchPublicProfiles(missing).catch(() => new Map<string, PublicProfile>());
    for (const [id, p] of got) cache.set(id, p);
  }
  return new Map(ids.filter(id => cache.has(id)).map(id => [id, cache.get(id)!]));
}

export function usePublicProfiles(ids: string[]): Map<string, PublicProfile> {
  const key = [...new Set(ids)].sort().join(',');
  const [profiles, setProfiles] = useState<Map<string, PublicProfile>>(
    () => new Map(ids.filter(id => cache.has(id)).map(id => [id, cache.get(id)!])),
  );
  useEffect(() => {
    let alive = true;
    const list = key ? key.split(',') : [];
    loadPublicProfiles(list).then(m => { if (alive) setProfiles(m); }).catch(() => {});
    return () => { alive = false; };
  }, [key]);
  return profiles;
}

/** A runner's display name: their username, or the fallback while unknown. */
export function nameOf(p: PublicProfile | undefined, fallback: string): string {
  return p?.username ?? fallback;
}
