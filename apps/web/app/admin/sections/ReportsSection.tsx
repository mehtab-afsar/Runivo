'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, BarChart3 } from 'lucide-react';
import { adminFetch, downloadCsv } from '@/lib/adminApi';
import { inputClass, primaryBtn, thClass, Field, ErrorNote, Spinner } from '../ui';
import type { PartnerRow } from './PartnersSection';

interface Report {
  partner: { id: string; name: string; billing_model: string; fee_per_redemption: number; fee_currency: string };
  month: string;
  totals: { views: number; redemptions: number; redemption_rate: number | null };
  fee_owed: number;
  rewards: { reward_id: string; title: string; pace_cost: number; views: number; redemptions: number; redemption_rate: number | null; codes_left: number }[];
  by_city: { city: string; views: number; redemptions: number }[];
  by_rank: { rank: string; views: number; redemptions: number }[];
}

const pct = (r: number | null) => (r == null ? '–' : `${(r * 100).toFixed(1)}%`);

function lastMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function ReportsSection() {
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [partnerId, setPartnerId] = useState('');
  const [month, setMonth] = useState(lastMonth());
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    adminFetch<{ partners: PartnerRow[] }>('/partners')
      .then(({ partners }) => { setPartners(partners); if (partners[0]) setPartnerId(partners[0].id); })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const run = useCallback(async () => {
    if (!partnerId) return;
    setRunning(true); setError('');
    try {
      const { report } = await adminFetch<{ report: Report }>(`/reports?partner=${partnerId}&month=${month}`);
      setReport(report);
    } catch (e) { setError((e as Error).message); setReport(null); }
    setRunning(false);
  }, [partnerId, month]);

  const exportCsv = () => {
    if (!report) return;
    const rows: (string | number | null)[][] = [
      [`Runivo partner report`, report.partner.name, report.month],
      [],
      ['Totals', 'Views', 'Redemptions', 'Redemption rate', 'Fee owed'],
      ['', report.totals.views, report.totals.redemptions, pct(report.totals.redemption_rate), `${report.partner.fee_currency} ${report.fee_owed.toFixed(2)}`],
      [],
      ['Reward', 'PACE cost', 'Views', 'Redemptions', 'Redemption rate', 'Codes left'],
      ...report.rewards.map(r => [r.title, r.pace_cost, r.views, r.redemptions, pct(r.redemption_rate), r.codes_left]),
      [],
      ['City', 'Views', 'Redemptions'],
      ...report.by_city.map(c => [c.city, c.views, c.redemptions]),
      [],
      ['Runner rank', 'Views', 'Redemptions'],
      ...report.by_rank.map(r => [r.rank, r.views, r.redemptions]),
    ];
    downloadCsv(`runivo-${report.partner.name.replace(/\W+/g, '-').toLowerCase()}-${report.month}.csv`, rows);
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-900">Partner reports</h2>
        <p className="text-xs text-gray-400 mt-0.5">Monthly views, redemptions and fees. Totals only: partners never see who redeemed.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-end mb-6">
        <div className="flex-1 w-full">
          <Field label="Partner">
            <select className={inputClass} value={partnerId} onChange={e => setPartnerId(e.target.value)}>
              {partners.length === 0 && <option value="">No partners yet</option>}
              {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="w-full sm:w-44">
          <Field label="Month"><input className={inputClass} type="month" value={month} onChange={e => setMonth(e.target.value)} /></Field>
        </div>
        <button onClick={run} disabled={!partnerId || running} className={`${primaryBtn} h-[50px]`}>
          <BarChart3 className="w-4 h-4" />{running ? 'Loading…' : 'Show report'}
        </button>
      </div>

      <ErrorNote message={error} />

      {report && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ['Views', report.totals.views.toLocaleString()],
              ['Redemptions', report.totals.redemptions.toLocaleString()],
              ['Redemption rate', pct(report.totals.redemption_rate)],
              ['Fee owed', `${report.partner.fee_currency} ${Number(report.fee_owed).toFixed(2)}`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl border border-gray-100 bg-white p-4">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{k}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{v}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 -mt-3">
            {report.partner.billing_model === 'free_listing'
              ? 'Free listing: no fee.'
              : `Cost per redemption at ${report.partner.fee_currency} ${Number(report.partner.fee_per_redemption).toFixed(2)}${report.fee_owed === 0 && report.totals.redemptions > 0 ? ' (billing has not started for this month)' : ''}.`}
          </p>

          <div className="rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b border-gray-100">
                <th className={thClass}>Reward</th><th className={thClass}>Views</th><th className={thClass}>Redeemed</th>
                <th className={thClass}>Rate</th><th className={`${thClass} hidden sm:table-cell`}>Codes left</th>
              </tr></thead>
              <tbody className="bg-white divide-y divide-gray-50">
                {report.rewards.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-xs text-gray-400">No rewards for this partner.</td></tr>}
                {report.rewards.map(r => (
                  <tr key={r.reward_id}>
                    <td className="px-4 py-3 font-semibold text-gray-900">{r.title}<span className="text-gray-300 font-normal text-xs"> · {r.pace_cost} PACE</span></td>
                    <td className="px-4 py-3 tabular-nums">{r.views}</td>
                    <td className="px-4 py-3 tabular-nums">{r.redemptions}</td>
                    <td className="px-4 py-3 tabular-nums">{pct(r.redemption_rate)}</td>
                    <td className="px-4 py-3 tabular-nums hidden sm:table-cell">{r.codes_left}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([['City', report.by_city.map(c => [c.city, c.views, c.redemptions])], ['Runner rank', report.by_rank.map(r => [r.rank, r.views, r.redemptions])]] as const).map(([title, rows]) => (
              <div key={title} className="rounded-2xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 border-b border-gray-100">
                    <th className={thClass}>{title}</th><th className={thClass}>Views</th><th className={thClass}>Redeemed</th>
                  </tr></thead>
                  <tbody className="bg-white divide-y divide-gray-50">
                    {rows.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-xs text-gray-400">No activity this month.</td></tr>}
                    {rows.map(([k, v, r]) => (
                      <tr key={String(k)}><td className="px-4 py-3 capitalize">{k}</td><td className="px-4 py-3 tabular-nums">{v}</td><td className="px-4 py-3 tabular-nums">{r}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button onClick={exportCsv} className={primaryBtn}><Download className="w-4 h-4" />Export CSV</button>
          </div>
        </div>
      )}
    </div>
  );
}
