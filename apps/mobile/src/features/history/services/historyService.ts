import { getRuns, type StoredRun } from '@shared/services/store';
import { pullRuns } from '@shared/services/sync';

export async function fetchRunHistory(limit = 200): Promise<StoredRun[]> {
  // Pull from Supabase first so cross-device history is always fresh,
  // then read from the local SQLite cache which includes the pull.
  try { await pullRuns(limit); } catch { /* offline — fall through to local */ }
  return getRuns(limit);
}
