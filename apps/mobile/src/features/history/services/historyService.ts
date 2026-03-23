import { getRuns, StoredRun } from '@shared/services/store';

export async function fetchRunHistory(limit = 200): Promise<StoredRun[]> {
  return getRuns(limit);
}
