import { supabase } from '@shared/services/supabase';

export async function createEvent(data: Record<string, unknown>) {
  return supabase.from('events').insert(data);
}
