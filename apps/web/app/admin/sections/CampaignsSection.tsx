'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Ban, BellRing } from 'lucide-react';
import { adminFetch } from '@/lib/adminApi';
import { inputClass, primaryBtn, thClass, Field, ErrorNote, FormCard, Spinner, Badge, toLocalInput, fromLocalInput } from '../ui';

interface CampaignRow {
  id: string;
  name: string;
  title: string;
  body: string;
  action_url: string;
  send_at: string;
  local_hour: number | null;
  expires_at: string | null;
  countries: string[] | null;
  tiers: string[] | null;
  active_within_days: number | null;
  status: 'draft' | 'scheduled' | 'done' | 'cancelled';
  sent_count: number;
  created_at: string;
}

const LINKS = [
  { value: '/run', label: 'Run tab' },
  { value: '/store', label: 'PACE Store' },
  { value: '/territory-map', label: 'Map' },
  { value: '/events', label: 'Events' },
  { value: '/clubs', label: 'Clubs' },
  { value: '/leaderboard', label: 'Leaderboard' },
];

const STATUS_TONE: Record<CampaignRow['status'], 'green' | 'blue' | 'gray' | 'red'> = {
  draft: 'gray', scheduled: 'blue', done: 'green', cancelled: 'red',
};

const EMPTY = {
  name: '', title: '', body: '', action_url: '/run', send_at: '', local_hour: '10', expires_at: '',
  countries: 'IN', tier_free: true, tier_premium: true, active_within_days: '', status: 'scheduled',
};

export default function CampaignsSection() {
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { campaigns } = await adminFetch<{ campaigns: CampaignRow[] }>('/campaigns');
      setRows(campaigns);
    } catch (e) { setError((e as Error).message); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const upd = (k: keyof typeof EMPTY, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));
  const openNew = () => { setForm(EMPTY); setEditId(null); setError(''); setShowForm(true); };
  const openEdit = (r: CampaignRow) => {
    setForm({
      name: r.name, title: r.title, body: r.body, action_url: r.action_url, send_at: toLocalInput(r.send_at),
      local_hour: r.local_hour == null ? '' : String(r.local_hour), expires_at: toLocalInput(r.expires_at),
      countries: (r.countries ?? []).join(', '),
      tier_free: !r.tiers || r.tiers.includes('free'), tier_premium: !r.tiers || r.tiers.includes('premium'),
      active_within_days: r.active_within_days == null ? '' : String(r.active_within_days), status: r.status,
    });
    setEditId(r.id); setError(''); setShowForm(true);
  };
  const close = () => { setShowForm(false); setEditId(null); setError(''); };

  const save = async () => {
    setSaving(true); setError('');
    const tiers = form.tier_free && form.tier_premium ? null
      : [form.tier_free && 'free', form.tier_premium && 'premium', form.tier_premium && 'admin'].filter(Boolean);
    try {
      await adminFetch(editId ? `/campaigns/${editId}` : '/campaigns', {
        method: editId ? 'PATCH' : 'POST',
        body: JSON.stringify({
          name: form.name, title: form.title, body: form.body, action_url: form.action_url,
          send_at: fromLocalInput(form.send_at), local_hour: form.local_hour, expires_at: fromLocalInput(form.expires_at),
          countries: form.countries, tiers, active_within_days: form.active_within_days, status: form.status,
        }),
      });
      await load();
      close();
    } catch (e) { setError((e as Error).message); }
    setSaving(false);
  };

  const cancelCampaign = async (r: CampaignRow) => {
    if (!window.confirm(`Cancel "${r.name}"? Runners who already got it keep it; nobody else will.`)) return;
    try { await adminFetch(`/campaigns/${r.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) }); await load(); }
    catch (e) { setError((e as Error).message); }
  };

  const canSave = form.name.trim() && form.title.trim() && form.body.trim() && form.send_at && (form.tier_free || form.tier_premium);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Campaigns</h2>
          <p className="text-xs text-gray-400 mt-0.5">Festive and partner pushes, sent at each runner&apos;s local hour. Quiet hours and the 3-a-day limit still apply.</p>
        </div>
        <button onClick={openNew} className={primaryBtn}><Plus className="w-4 h-4" strokeWidth={2.5} />New campaign</button>
      </div>

      {showForm && (
        <FormCard title={editId ? 'Edit campaign' : 'New campaign'} onClose={close}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Internal name *" wide><input className={inputClass} value={form.name} onChange={e => upd('name', e.target.value)} maxLength={120} placeholder="Diwali 2026 double-zone week" /></Field>
            <Field label="Push title *" hint={`${form.title.length}/80`} wide><input className={inputClass} value={form.title} onChange={e => upd('title', e.target.value)} maxLength={80} placeholder="Diwali double-zone week" /></Field>
            <Field label="Push message *" hint={`${form.body.length}/240`} wide>
              <textarea className={`${inputClass} resize-none`} rows={2} value={form.body} onChange={e => upd('body', e.target.value)} maxLength={240} placeholder="Every new zone pays double PACE till Sunday. Light up your streets." />
            </Field>
            <Field label="Opens">
              <select className={inputClass} value={form.action_url} onChange={e => upd('action_url', e.target.value)}>
                {LINKS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className={inputClass} value={form.status} onChange={e => upd('status', e.target.value)}>
                <option value="scheduled">Scheduled</option>
                <option value="draft">Draft (won&apos;t send)</option>
              </select>
            </Field>
            <Field label="Not before *"><input className={inputClass} type="datetime-local" value={form.send_at} onChange={e => upd('send_at', e.target.value)} /></Field>
            <Field label="At local hour" hint="7–21, blank = as soon as due">
              <input className={inputClass} type="number" min="7" max="21" value={form.local_hour} onChange={e => upd('local_hour', e.target.value)} />
            </Field>
            <Field label="Stop by" hint="Default 36 h after start"><input className={inputClass} type="datetime-local" value={form.expires_at} onChange={e => upd('expires_at', e.target.value)} /></Field>
            <Field label="Countries" hint="ISO codes; blank = everywhere"><input className={inputClass} value={form.countries} onChange={e => upd('countries', e.target.value)} /></Field>
            <Field label="Runners">
              <div className="flex gap-3 h-[50px] items-center px-4 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-700">
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.tier_free} onChange={e => upd('tier_free', e.target.checked)} />Free</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.tier_premium} onChange={e => upd('tier_premium', e.target.checked)} />Plus</label>
              </div>
            </Field>
            <Field label="Active in the last" hint="days; blank = everyone">
              <input className={inputClass} type="number" min="1" value={form.active_within_days} onChange={e => upd('active_within_days', e.target.value)} placeholder="30" />
            </Field>
          </div>
          <ErrorNote message={error} />
          <div className="flex gap-2 mt-4">
            <button onClick={close} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 bg-white">Cancel</button>
            <button onClick={save} disabled={!canSave || saving} className="flex-1 py-2.5 rounded-xl bg-[#4E7F1F] text-white text-sm font-bold disabled:opacity-40">
              {saving ? 'Saving…' : editId ? 'Update campaign' : 'Schedule campaign'}
            </button>
          </div>
        </FormCard>
      )}

      {!showForm && <ErrorNote message={error} />}

      {loading ? <Spinner /> : rows.length === 0 ? (
        <div className="text-center py-16">
          <BellRing className="w-8 h-8 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No campaigns yet.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-100">
              <th className={thClass}>Campaign</th>
              <th className={`${thClass} hidden sm:table-cell`}>When</th>
              <th className={`${thClass} hidden md:table-cell`}>Audience</th>
              <th className={thClass}>Sent</th>
              <th className={thClass}>Status</th>
              <th className={`${thClass} text-right`}> </th>
            </tr></thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {rows.map(r => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900 text-sm">{r.name}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">{r.title}: {r.body}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 hidden sm:table-cell whitespace-nowrap">
                    {new Date(r.send_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {r.local_hour != null && <span className="block text-gray-400">at {r.local_hour}:00 local</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">
                    {r.countries?.join(', ') ?? 'Everywhere'}{r.tiers ? ` · ${r.tiers.filter(t => t !== 'admin').join(', ')}` : ''}{r.active_within_days ? ` · active ${r.active_within_days}d` : ''}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{r.sent_count}</td>
                  <td className="px-4 py-3"><Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {r.sent_count === 0 && (r.status === 'scheduled' || r.status === 'draft') && (
                        <button onClick={() => openEdit(r)} className="w-7 h-7 rounded-lg border border-gray-100 bg-white flex items-center justify-center" aria-label={`Edit ${r.name}`}><Pencil className="w-3 h-3 text-gray-400" /></button>
                      )}
                      {(r.status === 'scheduled' || r.status === 'draft') && (
                        <button onClick={() => cancelCampaign(r)} className="w-7 h-7 rounded-lg border border-red-100 bg-red-50 flex items-center justify-center" aria-label={`Cancel ${r.name}`}><Ban className="w-3 h-3 text-red-400" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
