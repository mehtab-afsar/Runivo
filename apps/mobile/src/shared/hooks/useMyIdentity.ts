/**
 * The signed-in runner's name and photo, shared by every screen that shows
 * them (tab bar, Home greeting, profile). The profile editor updates it on
 * save, so a new photo or name appears everywhere at once.
 */
import { useEffect, useReducer } from 'react';
import { supabase } from '@shared/services/supabase';

export interface MyIdentity { name: string | null; avatarUrl: string | null }

let current: MyIdentity = { name: null, avatarUrl: null };
let loadedFor: string | null = null;
const subscribers = new Set<() => void>();

export function setMyIdentity(patch: Partial<MyIdentity>): void {
  current = { ...current, ...patch };
  subscribers.forEach(f => f());
}

async function load(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user.id ?? null;
  if (!uid || loadedFor === uid) return;
  loadedFor = uid;
  const { data, error } = await supabase.from('profiles').select('display_name, avatar_url').eq('id', uid).maybeSingle();
  // Offline launch: forget the attempt so the next screen that mounts tries again.
  if (error || !data) { loadedFor = null; return; }
  setMyIdentity({ name: (data.display_name as string | null) ?? null, avatarUrl: (data.avatar_url as string | null) ?? null });
}

// A different account must never show the last one's photo.
supabase.auth.onAuthStateChange((_e, session) => {
  if ((session?.user.id ?? null) !== loadedFor) {
    loadedFor = null;
    setMyIdentity({ name: null, avatarUrl: null });
    if (subscribers.size) load().catch(() => { loadedFor = null; });
  }
});

export function useMyIdentity(): MyIdentity {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    subscribers.add(rerender);
    load().catch(() => { loadedFor = null; });
    return () => { subscribers.delete(rerender); };
  }, []);
  return current;
}
