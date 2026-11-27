'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, ShoppingBag, ChevronUp, ChevronDown, Upload, Crown, Lock } from 'lucide-react';
import { adminFetch } from '@/lib/adminApi';
import {
  inputClass, primaryBtn, ghostBtn, thClass, Field, ErrorNote, FormCard, Spinner, Badge,
  toLocalInput, fromLocalInput,
} from '../ui';
import type { PartnerRow } from './PartnersSection';

interface StoreRow {
  id: string;
  partner_id: string | null;
  brand: string;
  brand_initial: string;
  brand_color: string;
  title: string;
  description: string;
  value_label: string;
  how_to_use: string | null;
  category: 'gear' | 'nutrition' | 'tech' | 'events';
  tier: 'entry' | 'mid' | 'premium';
  status: 'available' | 'coming_soon' | 'sold_out' | 'hidden';
  pace_cost: number;
  sort_order: number;
  plus_only: boolean;
  min_rank: string | null;
  countries: string[] | null;
  cities: string[] | null;
  starts_at: string | null;
  expires_at: string | null;
  code_mode: 'pool' | 'static' | 'none';
  static_code: string | null;
  stock: number | null;
}

type CodeCounts = Record<string, { total: number; assigned: number }>;

const EMPTY = {
  partner_id: '', brand: '', brand_initial: '', brand_color: '#0084D6',
  title: '', description: '', value_label: '', how_to_use: '',
  category: 'gear', tier: 'entry', status: 'coming_soon',
  pace_cost: '', sort_order: '0', plus_only: false, min_rank: '',
  countries: '', cities: '', starts_at: '', expires_at: '',
  code_mode: 'pool', static_code: '', stock: '',
};

const STATUS_TONE: Record<StoreRow['status'], 'green' | 'blue' | 'orange' | 'gray'> = {
  available: 'green', coming_soon: 'blue', sold_out: 'orange', hidden: 'gray',
};

/** Pricing levels from the PRD: PACE cost ≈ weeks of running at 100 PACE a week. */
const LEVELS = [
  { tier: 'entry',   label: 'Entry: 50 to 100 PACE (about a week)' },
  { tier: 'mid',     label: 'Mid: 200 to 400 PACE (3 to 4 weeks)' },
  { tier: 'premium', label: 'Premium: 1,000 to 1,500 PACE (3 months, gate to Hunter)' },
];

function costHint(tier: string, cost: number): string | null {
  if (!cost) return null;
  const ranges: Record<string, [number, number]> = { entry: [50, 100], mid: [200, 400], premium: [1000, 1500] };
  const [lo, hi] = ranges[tier] ?? [0, Infinity];
  return cost < lo || cost > hi ? `Outside the ${tier} range (${lo}–${hi})` : null;
}

export default function StoreSection() {
  const [rewards, setRewards] = useState<StoreRow[]>([]);
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [codeCounts, setCodeCounts] = useState<CodeCounts>({});
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [codesFor, setCodesFor] = useState<StoreRow | null>(null);
  const [csv, setCsv] = useState('');
  const [uploadMsg, setUploadMsg] = useState('');
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([
        adminFetch<{ rewards: StoreRow[]; codeCounts: CodeCounts }>('/rewards'),
        adminFetch<{ partners: PartnerRow[] }>('/partners'),
      ]);
      setRewards(r.rewards);
      setCodeCounts(r.codeCounts);
      setPartners(p.partners);
    } catch (e) { setError((e as Error).message); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const upd = (k: keyof typeof EMPTY, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  const openNew = () => { setForm(EMPTY); setEditId(null); setError(''); setShowForm(true); setCodesFor(null); };
  const openEdit = (r: StoreRow) => {
    setForm({
      partner_id: r.partner_id ?? '', brand: r.brand, brand_initial: r.brand_initial, brand_color: r.brand_color,
      title: r.title, description: r.description, value_label: r.value_label, how_to_use: r.how_to_use ?? '',
      category: r.category, tier: r.tier, status: r.status,
      pace_cost: String(r.pace_cost), sort_order: String(r.sort_order), plus_only: r.plus_only, min_rank: r.min_rank ?? '',
      countries: (r.countries ?? []).join(', '), cities: (r.cities ?? []).join(', '),
      starts_at: toLocalInput(r.starts_at), expires_at: toLocalInput(r.expires_at),
      code_mode: r.code_mode, static_code: r.static_code ?? '', stock: r.stock == null ? '' : String(r.stock),
    });
    setEditId(r.id); setError(''); setShowForm(true); setCodesFor(null);
  };
  const close = () => { setShowForm(false); setEditId(null); setError(''); };

  const pickPartner = (id: string) => {
    const p = partners.find(x => x.id === id);
    setForm(f => ({
      ...f,
      partner_id: id,
      brand: f.brand || (p?.name ?? ''),
      brand_initial: f.brand_initial || (p?.name.charAt(0).toUpperCase() ?? ''),
      cities: f.cities || (p?.cities ?? []).join(', '),
      countries: f.countries || (p?.countries ?? []).join(', '),
    }));
  };

  const save = async () => {
    setSaving(true); setError('');
    try {
      await adminFetch(editId ? `/rewards/${editId}` : '/rewards', {
        method: editId ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...form,
          partner_id: form.partner_id || null,
          min_rank: form.min_rank || null,
          starts_at: fromLocalInput(form.starts_at),
          expires_at: fromLocalInput(form.expires_at),
        }),
      });
      await load();
      close();
    } catch (e) { setError((e as Error).message); }
    setSaving(false);
  };

  const del = async (r: StoreRow) => {
    if (!window.confirm(`Delete "${r.title}"? Rewards someone has redeemed are hidden instead.`)) return;
    try { await adminFetch(`/rewards/${r.id}`, { method: 'DELETE' }); await load(); }
    catch (e) { setError((e as Error).message); }
  };

  const reorder = async (row: StoreRow, dir: 'up' | 'down') => {
    const sorted = [...rewards].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex(r => r.id === row.id);
    const swap = sorted[dir === 'up' ? idx - 1 : idx + 1];
    if (!swap) return;
    try {
      await Promise.all([
        adminFetch(`/rewards/${row.id}`, { method: 'PATCH', body: JSON.stringify({ sort_order: swap.sort_order }) }),
        adminFetch(`/rewards/${swap.id}`, { method: 'PATCH', body: JSON.stringify({ sort_order: row.sort_order }) }),
      ]);
      await load();
    } catch (e) { setError((e as Error).message); }
  };

  const onCsvFile = async (file: File | undefined) => {
    if (!file) return;
    setCsv(await file.text());
    setUploadMsg('');
  };

  const uploadCodes = async () => {
    if (!codesFor) return;
    setUploading(true); setUploadMsg('');
    try {
      const r = await adminFetch<{ received: number; added: number; duplicates: number }>(`/rewards/${codesFor.id}/codes`, {
        method: 'POST', body: JSON.stringify({ csv }),
      });
      setUploadMsg(`Added ${r.added} codes${r.duplicates ? ` (${r.duplicates} already uploaded, skipped)` : ''}.`);
      setCsv('');
      await load();
    } catch (e) { setUploadMsg((e as Error).message); }
    setUploading(false);
  };

  const canSave = form.brand.trim() && form.title.trim().length >= 3 && form.description.trim()
    && form.value_label.trim() && Number(form.pace_cost) > 0 && (form.code_mode !== 'static' || form.static_code.trim());
  const hint = costHint(form.tier, Number(form.pace_cost));
  const partnerName = (id: string | null) => partners.find(p => p.id === id)?.name;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">PACE Store</h2>
          <p className="text-xs text-gray-400 mt-0.5">{rewards.length} rewards · {rewards.filter(r => r.status === 'available').length} live</p>
        </div>
        <button onClick={openNew} className={primaryBtn}><Plus className="w-4 h-4" strokeWidth={2.5} />Add reward</button>
      </div>

      {showForm && (
        <FormCard title={editId ? 'Edit reward' : 'New reward'} onClose={close}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Partner" hint="Funds the reward and gets its report. Runners only see it while the partner is active." wide>
              <select className={inputClass} value={form.partner_id} onChange={e => pickPartner(e.target.value)}>
                <option value="">No partner (Runivo reward)</option>
                {partners.filter(p => p.status !== 'rejected').map(p => <option key={p.id} value={p.id}>{p.name} · {p.status}</option>)}
              </select>
            </Field>
            <Field label="Brand name *"><input className={inputClass} value={form.brand} onChange={e => upd('brand', e.target.value)} maxLength={60} placeholder="e.g. Brooks" /></Field>
            <div className="flex gap-2">
              <div style={{ width: 72 }}><Field label="Initial *"><input className={inputClass} value={form.brand_initial} onChange={e => upd('brand_initial', e.target.value.charAt(0))} maxLength={1} /></Field></div>
              <div className="flex-1"><Field label="Brand colour"><input className={inputClass} value={form.brand_color} onChange={e => upd('brand_color', e.target.value)} maxLength={7} placeholder="#0084D6" /></Field></div>
            </div>
            <Field label="Reward title *" wide><input className={inputClass} value={form.title} onChange={e => upd('title', e.target.value)} maxLength={100} placeholder="e.g. 20% off Brooks Running" /></Field>
            <Field label="Description *" wide><textarea className={`${inputClass} resize-none`} rows={2} value={form.description} onChange={e => upd('description', e.target.value)} maxLength={400} /></Field>
            <Field label="Value label *"><input className={inputClass} value={form.value_label} onChange={e => upd('value_label', e.target.value)} maxLength={30} placeholder="20% off" /></Field>
            <Field label="How to use" hint="Shown with the code"><input className={inputClass} value={form.how_to_use} onChange={e => upd('how_to_use', e.target.value)} maxLength={400} placeholder="Enter at checkout on brooksrunning.co.in" /></Field>

            <Field label="Level">
              <select className={inputClass} value={form.tier} onChange={e => upd('tier', e.target.value)}>
                {LEVELS.map(l => <option key={l.tier} value={l.tier}>{l.label}</option>)}
              </select>
            </Field>
            <Field label="PACE cost *" hint={hint ?? undefined}>
              <input className={inputClass} type="number" min="1" value={form.pace_cost} onChange={e => upd('pace_cost', e.target.value)} placeholder="75" />
            </Field>
            <Field label="Rank gate">
              <select className={inputClass} value={form.min_rank} onChange={e => upd('min_rank', e.target.value)}>
                <option value="">Any rank</option>
                {['strider', 'chaser', 'hunter', 'sovereign'].map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)} and above</option>)}
              </select>
            </Field>
            <Field label="Who can redeem">
              <label className="flex items-center gap-2 h-[50px] px-4 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form.plus_only} onChange={e => upd('plus_only', e.target.checked)} />
                Runivo Plus members only
              </label>
            </Field>
            <Field label="Countries" hint="ISO codes; blank = everywhere"><input className={inputClass} value={form.countries} onChange={e => upd('countries', e.target.value)} placeholder="IN" /></Field>
            <Field label="Cities" hint="Launch cities; blank = whole country"><input className={inputClass} value={form.cities} onChange={e => upd('cities', e.target.value)} placeholder="Bengaluru, Mumbai" /></Field>
            <Field label="Starts" hint="Optional"><input className={inputClass} type="datetime-local" value={form.starts_at} onChange={e => upd('starts_at', e.target.value)} /></Field>
            <Field label="Ends" hint="Optional"><input className={inputClass} type="datetime-local" value={form.expires_at} onChange={e => upd('expires_at', e.target.value)} /></Field>

            <Field label="Codes">
              <select className={inputClass} value={form.code_mode} onChange={e => upd('code_mode', e.target.value)}>
                <option value="pool">Code pool: one single-use code each (upload CSV)</option>
                <option value="static">Same code for everyone</option>
                <option value="none">No code (fulfilled by hand)</option>
              </select>
            </Field>
            {form.code_mode === 'static' && (
              <Field label="Code *"><input className={inputClass} value={form.static_code} onChange={e => upd('static_code', e.target.value)} maxLength={80} /></Field>
            )}
            {form.code_mode !== 'pool' && (
              <Field label="Stock" hint="Blank = unlimited"><input className={inputClass} type="number" min="0" value={form.stock} onChange={e => upd('stock', e.target.value)} /></Field>
            )}
            <Field label="Status">
              <select className={inputClass} value={form.status} onChange={e => upd('status', e.target.value)}>
                <option value="available">Live: redeemable</option>
                <option value="coming_soon">Coming soon: visible, locked</option>
                <option value="sold_out">Sold out</option>
                <option value="hidden">Hidden</option>
              </select>
            </Field>
            <Field label="Sort order" hint="Lower = first"><input className={inputClass} type="number" min="0" value={form.sort_order} onChange={e => upd('sort_order', e.target.value)} /></Field>
          </div>
          <p className="text-[11px] text-gray-400 mt-3">
            Every reward: one redemption per runner, accounts older than 14 days with at least 3 runs, PACE never expires (rewards do).
          </p>
          <ErrorNote message={error} />
          <div className="flex gap-2 mt-4">
            <button onClick={close} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 bg-white">Cancel</button>
            <button onClick={save} disabled={!canSave || saving} className="flex-1 py-2.5 rounded-xl bg-[#4E7F1F] text-white text-sm font-bold disabled:opacity-40">
              {saving ? 'Saving…' : editId ? 'Update reward' : 'Create reward'}
            </button>
          </div>
        </FormCard>
      )}

      {codesFor && (
        <FormCard title={`Upload codes · ${codesFor.title}`} onClose={() => { setCodesFor(null); setCsv(''); setUploadMsg(''); }}>
          <p className="text-xs text-gray-500 mb-3">
            One code per line (first column of a CSV; a header named &quot;code&quot; is skipped). Codes already uploaded are ignored.
            {' '}{codeCounts[codesFor.id] ? `${codeCounts[codesFor.id].total - codeCounts[codesFor.id].assigned} left of ${codeCounts[codesFor.id].total}.` : 'No codes yet.'}
          </p>
          <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={e => onCsvFile(e.target.files?.[0])} className="text-xs mb-3" />
          <textarea className={`${inputClass} resize-y font-mono text-xs`} rows={6} value={csv} onChange={e => setCsv(e.target.value)} placeholder={'code\nBRK-7KQ2\nBRK-9XW4'} />
          {uploadMsg && <p className="text-xs text-gray-600 mt-2">{uploadMsg}</p>}
          <div className="flex justify-end mt-3">
            <button onClick={uploadCodes} disabled={uploading || !csv.trim()} className={primaryBtn}>
              <Upload className="w-4 h-4" />{uploading ? 'Uploading…' : 'Upload codes'}
            </button>
          </div>
        </FormCard>
      )}

      {!showForm && !codesFor && <ErrorNote message={error} />}

      {loading ? <Spinner /> : rewards.length === 0 ? (
        <div className="text-center py-16">
          <ShoppingBag className="w-8 h-8 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No rewards yet. Add your first one.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-100">
              <th className={thClass}>Reward</th>
              <th className={`${thClass} hidden sm:table-cell`}>Cost</th>
              <th className={`${thClass} hidden md:table-cell`}>Codes / stock</th>
              <th className={`${thClass} hidden sm:table-cell`}>Status</th>
              <th className={`${thClass} text-right`}>Actions</th>
            </tr></thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {rewards.map((r, idx) => {
                const cc = codeCounts[r.id];
                const ended = r.expires_at && new Date(r.expires_at) < new Date();
                return (
                  <tr key={r.id} className={r.status === 'hidden' ? 'opacity-40' : ''}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold" style={{ backgroundColor: r.brand_color }}>{r.brand_initial}</div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 leading-tight text-sm truncate">{r.title}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span>{partnerName(r.partner_id) ?? r.brand}</span>
                            {r.plus_only && <span className="inline-flex items-center gap-0.5 text-amber-600"><Crown className="w-2.5 h-2.5" />Plus</span>}
                            {r.min_rank && <span className="inline-flex items-center gap-0.5"><Lock className="w-2.5 h-2.5" />{r.min_rank}+</span>}
                            {(r.cities?.length || r.countries?.length) ? <span>{[...(r.cities ?? []), ...(r.countries ?? [])].join(', ')}</span> : null}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700 hidden sm:table-cell whitespace-nowrap">{r.pace_cost} <span className="text-gray-300 font-normal text-xs">PACE</span></td>
                    <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell whitespace-nowrap">
                      {r.code_mode === 'pool' ? (cc ? `${cc.total - cc.assigned} of ${cc.total} codes left` : 'No codes uploaded')
                        : r.code_mode === 'static' ? `Shared code · ${r.stock == null ? 'unlimited' : `${r.stock} left`}`
                        : r.stock == null ? 'Unlimited' : `${r.stock} left`}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {ended ? <Badge tone="gray">ended</Badge> : <Badge tone={STATUS_TONE[r.status]}>{r.status.replace('_', ' ')}</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {r.code_mode === 'pool' && (
                          <button onClick={() => { setCodesFor(r); setShowForm(false); setUploadMsg(''); }} className={ghostBtn} aria-label={`Upload codes for ${r.title}`}>
                            <Upload className="w-3 h-3 inline -mt-0.5" /> Codes
                          </button>
                        )}
                        <button onClick={() => reorder(r, 'up')} disabled={idx === 0} className="w-7 h-7 rounded-lg border border-gray-100 bg-white flex items-center justify-center disabled:opacity-30" aria-label="Move up"><ChevronUp className="w-3 h-3 text-gray-400" /></button>
                        <button onClick={() => reorder(r, 'down')} disabled={idx === rewards.length - 1} className="w-7 h-7 rounded-lg border border-gray-100 bg-white flex items-center justify-center disabled:opacity-30" aria-label="Move down"><ChevronDown className="w-3 h-3 text-gray-400" /></button>
                        <button onClick={() => openEdit(r)} className="w-7 h-7 rounded-lg border border-gray-100 bg-white flex items-center justify-center" aria-label={`Edit ${r.title}`}><Pencil className="w-3 h-3 text-gray-400" /></button>
                        <button onClick={() => del(r)} className="w-7 h-7 rounded-lg border border-red-100 bg-red-50 flex items-center justify-center" aria-label={`Delete ${r.title}`}><Trash2 className="w-3 h-3 text-red-400" /></button>
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
