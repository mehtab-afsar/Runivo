import { supabase } from '../supabase';

/**
 * Returns the current user only if a valid local session exists.
 * Uses getSession() (no network call) then getUser() to validate.
 * Silently returns null when not logged in — avoids 403 console noise.
 */
export async function getAuthenticatedUser() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}
