import {
  addWeightLog,
  getWeightLogs,
  markWeightLogSynced,
  type WeightLogEntry,
} from '@shared/services/store';
import { supabase } from '@shared/services/supabase';

/** Most recent first, local-only — this is a lightweight trend, not synced data. */
export async function fetchWeightLogs(limit = 30): Promise<WeightLogEntry[]> {
  try {
    return await getWeightLogs(limit);
  } catch {
    return [];
  }
}

export async function logWeight(weightKg: number, loggedAt = Date.now()): Promise<void> {
  const localId = await addWeightLog({ weightKg, loggedAt, synced: false });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const remoteId = crypto.randomUUID();
  const { error } = await supabase.from('weight_logs').insert({
    id: remoteId,
    user_id: session.user.id,
    weight_kg: weightKg,
    logged_at: new Date(loggedAt).toISOString(),
  });
  if (!error) await markWeightLogSynced(localId, remoteId);
}
