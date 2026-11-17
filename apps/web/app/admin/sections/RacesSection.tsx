'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, X, Trophy } from 'lucide-react';
import { adminFetch } from '@/lib/adminApi';
import { ghostBtn, thClass, ErrorNote, Spinner, Badge } from '../ui';

/**
 * Races runners added in plan setup. Approving puts one in the catalogue so
 * everyone can find it; check the date and distance against the organiser's
 * site first, because a wrong date makes plans peak on the wrong day.
 * Curated races come from curated Events and need no review here.
 */
interface RaceRow {
  id: string;
  name: string;
  city: string | null;
  starts_on: string;
  website_url: string | null;
  created_at: string;
  race_distances: { label: string; race_entries: { count: number }[] }[];
}

export default function RacesSection() {
  const [rows, setRows] = useState<RaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { races } = await adminFetch<{ races: RaceRow[] }>('/races');
      setRows(races);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load races');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const review = async (id: string, approve: boolean) => {
    setBusy(id); setError('');
    try {
      await adminFetch('/races', { method: 'POST', body: JSON.stringify({ id, approve }) });
      setRows(r => r.filter(x => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <Trophy className="w-5 h-5 text-gray-400" strokeWidth={1.8} />
        <h2 className="text-lg font-bold text-gray-900">Races to review</h2>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Added by runners in plan setup. Check the date and distance on the organiser&apos;s site before approving.
        Curated races come from Events automatically.
      </p>
      {error && <ErrorNote message={error} />}
      {loading ? <Spinner /> : rows.length === 0 ? (
        <p className="text-sm text-gray-400 py-10 text-center">Nothing waiting.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr>
                <th className={thClass}>Race</th>
                <th className={thClass}>Date</th>
                <th className={thClass}>Distance</th>
                <th className={thClass}>Entered</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const entered = r.race_distances.reduce((t, d) => t + (d.race_entries[0]?.count ?? 0), 0);
                return (
                  <tr key={r.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{r.name}</div>
                      <div className="text-xs text-gray-500">
                        {r.city ?? 'No city'}
                        {r.website_url && <> · <span className="font-mono">{r.website_url}</span></>}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">{r.starts_on}</td>
                    <td className="px-4 py-3">{r.race_distances.map(d => <Badge key={d.label} tone="blue">{d.label}</Badge>)}</td>
                    <td className="px-4 py-3 text-gray-700">{entered}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button className={ghostBtn} disabled={busy === r.id} onClick={() => review(r.id, true)} aria-label={`Approve ${r.name}`}>
                          <Check className="w-3.5 h-3.5 inline -mt-0.5" /> Approve
                        </button>
                        <button className={ghostBtn} disabled={busy === r.id} onClick={() => review(r.id, false)} aria-label={`Reject ${r.name}`}>
                          <X className="w-3.5 h-3.5 inline -mt-0.5" /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
