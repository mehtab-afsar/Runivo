import { getRuns, StoredRun } from './store';

export interface PersonalRecord {
  type: 'fastest_1k' | 'fastest_5k' | 'fastest_10k' | 'longest_run' | 'fastest_pace' | 'most_territories';
  value: number; // seconds for time records, km for distance, count for territories
  runId: string;
  date: number; // timestamp
}

export async function calculatePersonalRecords(): Promise<PersonalRecord[]> {
  const runs = await getRuns();

  if (runs.length === 0) return [];

  const records: Map<PersonalRecord['type'], { value: number; runId: string; date: number }> = new Map();

  for (const run of runs) {
    const distanceKm = run.distanceMeters / 1000;

    // fastest_1k: if distance >= 1km, estimate 1K time
    if (distanceKm >= 1) {
      const estimated1kTime = (1 / distanceKm) * run.durationSec;
      const current = records.get('fastest_1k');
      if (!current || estimated1kTime < current.value) {
        records.set('fastest_1k', { value: estimated1kTime, runId: run.id, date: run.startTime });
      }
    }

    // fastest_5k: if distance >= 5km, estimate 5K time
    if (distanceKm >= 5) {
      const estimated5kTime = (5 / distanceKm) * run.durationSec;
      const current = records.get('fastest_5k');
      if (!current || estimated5kTime < current.value) {
        records.set('fastest_5k', { value: estimated5kTime, runId: run.id, date: run.startTime });
      }
    }

    // fastest_10k: if distance >= 10km, estimate 10K time
    if (distanceKm >= 10) {
      const estimated10kTime = (10 / distanceKm) * run.durationSec;
      const current = records.get('fastest_10k');
      if (!current || estimated10kTime < current.value) {
        records.set('fastest_10k', { value: estimated10kTime, runId: run.id, date: run.startTime });
      }
    }

    // longest_run: track maximum distance in km
    {
      const current = records.get('longest_run');
      if (!current || distanceKm > current.value) {
        records.set('longest_run', { value: distanceKm, runId: run.id, date: run.startTime });
      }
    }

    // fastest_pace: seconds per km, only for runs > 0.5km
    if (distanceKm > 0.5) {
      const pace = run.durationSec / distanceKm;
      const current = records.get('fastest_pace');
      if (!current || pace < current.value) {
        records.set('fastest_pace', { value: pace, runId: run.id, date: run.startTime });
      }
    }

    // most_territories: track maximum territoriesClaimed count
    {
      const count = run.territoriesClaimed.length;
      if (count > 0) {
        const current = records.get('most_territories');
        if (!current || count > current.value) {
          records.set('most_territories', { value: count, runId: run.id, date: run.startTime });
        }
      }
    }
  }

  const result: PersonalRecord[] = [];
  for (const [type, data] of records) {
    result.push({ type, value: data.value, runId: data.runId, date: data.date });
  }

  return result;
}

export function formatRecordValue(pr: PersonalRecord): string {
  switch (pr.type) {
    case 'fastest_1k':
    case 'fastest_5k':
    case 'fastest_10k': {
      const totalSeconds = Math.round(pr.value);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    case 'longest_run': {
      return `${pr.value.toFixed(1)} km`;
    }
    case 'fastest_pace': {
      const totalSeconds = Math.round(pr.value);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}:${String(seconds).padStart(2, '0')} /km`;
    }
    case 'most_territories': {
      return `${pr.value} zones`;
    }
  }
}

export function getRecordLabel(type: PersonalRecord['type']): string {
  switch (type) {
    case 'fastest_1k':
      return 'Fastest 1K';
    case 'fastest_5k':
      return 'Fastest 5K';
    case 'fastest_10k':
      return 'Fastest 10K';
    case 'longest_run':
      return 'Longest Run';
    case 'fastest_pace':
      return 'Best Pace';
    case 'most_territories':
      return 'Most Zones';
  }
}
