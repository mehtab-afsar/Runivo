import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import type { Session, User } from '@supabase/supabase-js';
import type { AuthState } from '../services/auth';

export type { AuthState };

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  return { user, session, loading };
}
