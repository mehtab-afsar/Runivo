/**
 * Admin CMS — /admin
 *
 * Access: profiles.subscription_tier = 'admin'
 * To grant access, run in Supabase SQL editor:
 *   update profiles set subscription_tier = 'admin' where id = '<your-user-id>';
 *
 * Promotions table — run once in Supabase SQL editor:
 *   create table if not exists promotions (
 *     id          uuid default gen_random_uuid() primary key,
 *     title       text not null,
 *     subtitle    text,
 *     image_url   text,
 *     cta_label   text,
 *     cta_url     text,
 *     placement   text not null default 'home_banner',
 *     is_active   boolean not null default true,
 *     active_from timestamptz,
 *     active_until timestamptz,
 *     created_at  timestamptz default now()
 *   );
 *   alter table promotions enable row level security;
 *   create policy "Admin full access" on promotions
 *     using (exists (
 *       select 1 from profiles
 *       where profiles.id = auth.uid()
 *         and profiles.subscription_tier = 'admin'
 *     ));
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Megaphone, Plus, Trash2, ToggleLeft, ToggleRight,
  ArrowLeft, Pencil, X, AlertCircle, ShieldAlert,
} from 'lucide-react';
import { supabase } from '@shared/services/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EventRow {
  id: string;
  title: string;
  event_type: string;
  starts_at: string;
  location_name: string | null;
  distance_m: number | null;
  description: string | null;
  is_active: boolean;
  participant_count: number;
  organizer?: string | null;
  created_at: string;
}

interface PromoRow {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  placement: string;
  is_active: boolean;
  active_from: string | null;
  active_until: string | null;
  created_at: string;
}

type AdminTab = 'events' | 'promotions';

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputClass = `w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200
  text-gray-900 text-[15px] font-medium placeholder:text-gray-300 placeholder:font-normal
  focus:outline-none focus:border-[#D93518] focus:bg-white transition-all`;

const labelClass = 'text-[10px] font-semibold text-gray-400 uppercase tracking-widest pl-0.5 mb-1 block';

const EVENT_TYPES = [
  { value: 'community-run',   label: 'Community Run' },
  { value: 'race',            label: 'Race' },
  { value: 'challenge',       label: 'Challenge' },
  { value: 'brand-challenge', label: 'Brand Challenge' },
  { value: 'king-of-hill',    label: 'King of the Hill' },
  { value: 'survival',        label: 'Survival Run' },
];

const PLACEMENTS = [
  { value: 'home_banner',    label: 'Home — Hero Banner' },
  { value: 'events_top',     label: 'Events — Top Banner' },
  { value: 'missions_top',   label: 'Missions — Top Banner' },
  { value: 'profile_banner', label: 'Profile — Top Banner' },
];

// ─── Events section ───────────────────────────────────────────────────────────

const EMPTY_EVENT = {
  title: '', event_type: 'community-run', starts_at: '', ends_at: '',
  location_name: '', distance_km: '', description: '', organizer: '',
};

function EventsSection() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY_EVENT);
  const [editId, setEditId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('events')
      .select('*')
      .order('starts_at', { ascending: false });
    setEvents(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const upd = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const openNew = () => {
    setForm(EMPTY_EVENT);
    setEditId(null);
    setError('');
    setShowForm(true);
  };

  const openEdit = (e: EventRow) => {
    const startsLocal = e.starts_at ? new Date(e.starts_at).toISOString().slice(0, 16) : '';
    setForm({
      title: e.title,
      event_type: e.event_type,
      starts_at: startsLocal,
      ends_at: '',
      location_name: e.location_name ?? '',
      distance_km: e.distance_m ? String(e.distance_m / 1000) : '',
      description: e.description ?? '',
      organizer: e.organizer ?? '',
    });
    setEditId(e.id);
    setError('');
    setShowForm(true);
  };

  const cancel = () => { setShowForm(false); setEditId(null); setError(''); };

  const save = async () => {
    if (!form.title.trim() || !form.starts_at || !form.location_name.trim()) return;
    setSaving(true);
    setError('');
    const startsAt = new Date(form.starts_at);
    const endsAt = new Date(startsAt.getTime() + 2 * 3600 * 1000);
    const payload = {
      title:             form.title.trim(),
      event_type:        form.event_type,
      starts_at:         startsAt.toISOString(),
      ends_at:           endsAt.toISOString(),
      location_name:     form.location_name.trim() || null,
      distance_m:        form.distance_km ? Math.round(parseFloat(form.distance_km) * 1000) : null,
      description:       form.description.trim() || null,
      organizer:         form.organizer.trim() || null,
    };
    const { error: err } = editId
      ? await supabase.from('events').update(payload).eq('id', editId)
      : await supabase.from('events').insert({ ...payload, is_active: true, participant_count: 0 });
    if (err) { setError(err.message); setSaving(false); return; }
    await load();
    cancel();
    setSaving(false);
  };

  const toggleActive = async (row: EventRow) => {
    await supabase.from('events').update({ is_active: !row.is_active }).eq('id', row.id);
    setEvents(prev => prev.map(e => e.id === row.id ? { ...e, is_active: !e.is_active } : e));
  };

  const del = async (id: string) => {
    setDeletingId(id);
    await supabase.from('events').delete().eq('id', id);
    setEvents(prev => prev.filter(e => e.id !== id));
    setDeletingId(null);
  };

  const canSave = form.title.trim().length >= 3 && !!form.starts_at && form.location_name.trim().length >= 2;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Events</h2>
          <p className="text-xs text-gray-400 mt-0.5">{events.length} total · {events.filter(e => e.is_active).length} active</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#D93518] text-white text-sm font-semibold shadow-sm active:scale-95 transition-transform"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          New Event
        </button>
      </div>

      {/* Inline create/edit form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-6 p-5 rounded-2xl border border-[#D93518]/20 bg-[#FFF8F6]"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900">{editId ? 'Edit Event' : 'New Event'}</h3>
              <button onClick={cancel} className="w-7 h-7 rounded-lg bg-white border border-gray-100 flex items-center justify-center">
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className={labelClass}>Event Title *</label>
                <input type="text" value={form.title} onChange={e => upd('title', e.target.value)}
                  placeholder="e.g. Sunday Morning Run" maxLength={80} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Event Type</label>
                <select value={form.event_type} onChange={e => upd('event_type', e.target.value)} className={inputClass}>
                  {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Start Date & Time *</label>
                <input type="datetime-local" value={form.starts_at} onChange={e => upd('starts_at', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Location *</label>
                <input type="text" value={form.location_name} onChange={e => upd('location_name', e.target.value)}
                  placeholder="e.g. Hyde Park, London" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Distance km <span className="normal-case font-normal tracking-normal text-gray-300">Optional</span></label>
                <input type="number" value={form.distance_km} onChange={e => upd('distance_km', e.target.value)}
                  placeholder="e.g. 5" min="0" step="0.1" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Organizer <span className="normal-case font-normal tracking-normal text-gray-300">Optional</span></label>
                <input type="text" value={form.organizer} onChange={e => upd('organizer', e.target.value)}
                  placeholder="e.g. Runivo Team" className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Description <span className="normal-case font-normal tracking-normal text-gray-300">Optional</span></label>
                <textarea value={form.description} onChange={e => upd('description', e.target.value)}
                  placeholder="Tell runners what to expect..." rows={2} maxLength={500}
                  className={`${inputClass} resize-none`} />
              </div>
            </div>

            {error && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-500">{error}</p>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button onClick={cancel} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 bg-white">Cancel</button>
              <button
                onClick={save}
                disabled={!canSave || saving}
                className="flex-1 py-2.5 rounded-xl bg-[#D93518] text-white text-sm font-bold disabled:opacity-40 active:scale-95 transition-transform"
              >
                {saving ? 'Saving…' : editId ? 'Update Event' : 'Create Event'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Events table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(217,53,24,0.15)', borderTopColor: '#D93518' }} />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16">
          <Calendar className="w-8 h-8 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No events yet. Create your first one.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-3">Event</th>
                <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-3 hidden sm:table-cell">Date</th>
                <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-3 hidden sm:table-cell">Location</th>
                <th className="text-center text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-3">Status</th>
                <th className="text-right text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {events.map(e => (
                <tr key={e.id} className={`transition-colors ${!e.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900 leading-tight">{e.title}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 capitalize">{e.event_type.replace(/-/g, ' ')} · {e.participant_count} going</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 hidden sm:table-cell whitespace-nowrap">
                    {new Date(e.starts_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    <br />
                    <span className="text-gray-300">{new Date(e.starts_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 hidden sm:table-cell max-w-[140px] truncate">
                    {e.location_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleActive(e)} className="inline-flex items-center gap-1.5">
                      {e.is_active
                        ? <ToggleRight className="w-5 h-5 text-[#D93518]" />
                        : <ToggleLeft className="w-5 h-5 text-gray-300" />}
                      <span className={`text-[10px] font-semibold ${e.is_active ? 'text-[#D93518]' : 'text-gray-300'}`}>
                        {e.is_active ? 'Live' : 'Off'}
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(e)}
                        className="w-7 h-7 rounded-lg border border-gray-100 bg-white flex items-center justify-center hover:border-gray-300 transition-colors"
                      >
                        <Pencil className="w-3 h-3 text-gray-400" />
                      </button>
                      <button
                        onClick={() => del(e.id)}
                        disabled={deletingId === e.id}
                        className="w-7 h-7 rounded-lg border border-red-100 bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors disabled:opacity-40"
                      >
                        {deletingId === e.id
                          ? <div className="w-3 h-3 rounded-full border border-red-300 border-t-transparent animate-spin" />
                          : <Trash2 className="w-3 h-3 text-red-400" />}
                      </button>
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

// ─── Promotions section ───────────────────────────────────────────────────────

const EMPTY_PROMO = {
  title: '', subtitle: '', image_url: '', cta_label: '', cta_url: '',
  placement: 'home_banner', active_from: '', active_until: '',
};

function PromotionsSection() {
  const [promos, setPromos] = useState<PromoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY_PROMO);
  const [editId, setEditId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [tableExists, setTableExists] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('promotions')
      .select('*')
      .order('created_at', { ascending: false });
    if (err?.message?.includes('does not exist') || err?.code === '42P01') {
      setTableExists(false);
    } else {
      setPromos(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const upd = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const openNew = () => { setForm(EMPTY_PROMO); setEditId(null); setError(''); setShowForm(true); };

  const openEdit = (p: PromoRow) => {
    setForm({
      title:       p.title,
      subtitle:    p.subtitle ?? '',
      image_url:   p.image_url ?? '',
      cta_label:   p.cta_label ?? '',
      cta_url:     p.cta_url ?? '',
      placement:   p.placement,
      active_from: p.active_from ? new Date(p.active_from).toISOString().slice(0, 16) : '',
      active_until: p.active_until ? new Date(p.active_until).toISOString().slice(0, 16) : '',
    });
    setEditId(p.id);
    setError('');
    setShowForm(true);
  };

  const cancel = () => { setShowForm(false); setEditId(null); setError(''); };

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    setError('');
    const payload = {
      title:        form.title.trim(),
      subtitle:     form.subtitle.trim() || null,
      image_url:    form.image_url.trim() || null,
      cta_label:    form.cta_label.trim() || null,
      cta_url:      form.cta_url.trim() || null,
      placement:    form.placement,
      active_from:  form.active_from ? new Date(form.active_from).toISOString() : null,
      active_until: form.active_until ? new Date(form.active_until).toISOString() : null,
    };
    const { error: err } = editId
      ? await supabase.from('promotions').update(payload).eq('id', editId)
      : await supabase.from('promotions').insert({ ...payload, is_active: true });
    if (err) { setError(err.message); setSaving(false); return; }
    await load();
    cancel();
    setSaving(false);
  };

  const toggleActive = async (row: PromoRow) => {
    await supabase.from('promotions').update({ is_active: !row.is_active }).eq('id', row.id);
    setPromos(prev => prev.map(p => p.id === row.id ? { ...p, is_active: !p.is_active } : p));
  };

  const del = async (id: string) => {
    setDeletingId(id);
    await supabase.from('promotions').delete().eq('id', id);
    setPromos(prev => prev.filter(p => p.id !== id));
    setDeletingId(null);
  };

  if (!tableExists) {
    return (
      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800 mb-1">Promotions table not found</p>
            <p className="text-xs text-amber-600 mb-3">Run this SQL in your Supabase SQL editor to enable promotions:</p>
            <pre className="text-[11px] bg-white border border-amber-100 rounded-xl p-4 text-gray-700 overflow-x-auto leading-relaxed">{`create table if not exists promotions (
  id           uuid default gen_random_uuid() primary key,
  title        text not null,
  subtitle     text,
  image_url    text,
  cta_label    text,
  cta_url      text,
  placement    text not null default 'home_banner',
  is_active    boolean not null default true,
  active_from  timestamptz,
  active_until timestamptz,
  created_at   timestamptz default now()
);
alter table promotions enable row level security;
create policy "Admin full access" on promotions
  using (exists (
    select 1 from profiles
    where profiles.id = auth.uid()
      and profiles.subscription_tier = 'admin'
  ));`}</pre>
            <button onClick={load} className="mt-3 px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-semibold">
              Retry after running SQL
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Promotions</h2>
          <p className="text-xs text-gray-400 mt-0.5">{promos.length} total · {promos.filter(p => p.is_active).length} active</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#D93518] text-white text-sm font-semibold shadow-sm active:scale-95 transition-transform"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          New Banner
        </button>
      </div>

      {/* Placement legend */}
      <div className="flex flex-wrap gap-2 mb-5">
        {PLACEMENTS.map(p => (
          <span key={p.value} className="px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-100 text-[10px] font-medium text-gray-400">
            <span className="text-gray-600">{p.value}</span> → {p.label}
          </span>
        ))}
      </div>

      {/* Inline form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-6 p-5 rounded-2xl border border-[#D93518]/20 bg-[#FFF8F6]"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900">{editId ? 'Edit Promotion' : 'New Promotion'}</h3>
              <button onClick={cancel} className="w-7 h-7 rounded-lg bg-white border border-gray-100 flex items-center justify-center">
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className={labelClass}>Title *</label>
                <input type="text" value={form.title} onChange={e => upd('title', e.target.value)}
                  placeholder="e.g. Summer Territory Challenge" maxLength={80} className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Subtitle <span className="normal-case font-normal tracking-normal text-gray-300">Optional</span></label>
                <input type="text" value={form.subtitle} onChange={e => upd('subtitle', e.target.value)}
                  placeholder="e.g. Claim 50 zones, win a prize" maxLength={120} className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Image URL <span className="normal-case font-normal tracking-normal text-gray-300">Optional — paste Supabase Storage URL or CDN link</span></label>
                <input type="url" value={form.image_url} onChange={e => upd('image_url', e.target.value)}
                  placeholder="https://..." className={inputClass} />
                {form.image_url && (
                  <img src={form.image_url} alt="preview" className="mt-2 w-full max-h-28 object-cover rounded-xl border border-gray-100" onError={e => (e.currentTarget.style.display = 'none')} />
                )}
              </div>
              <div>
                <label className={labelClass}>CTA Label <span className="normal-case font-normal tracking-normal text-gray-300">Optional</span></label>
                <input type="text" value={form.cta_label} onChange={e => upd('cta_label', e.target.value)}
                  placeholder="e.g. Join Now" maxLength={30} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>CTA URL <span className="normal-case font-normal tracking-normal text-gray-300">Optional</span></label>
                <input type="text" value={form.cta_url} onChange={e => upd('cta_url', e.target.value)}
                  placeholder="e.g. /events or https://..." className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Placement</label>
                <select value={form.placement} onChange={e => upd('placement', e.target.value)} className={inputClass}>
                  {PLACEMENTS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                {/* empty col for alignment */}
              </div>
              <div>
                <label className={labelClass}>Active From <span className="normal-case font-normal tracking-normal text-gray-300">Optional</span></label>
                <input type="datetime-local" value={form.active_from} onChange={e => upd('active_from', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Active Until <span className="normal-case font-normal tracking-normal text-gray-300">Optional</span></label>
                <input type="datetime-local" value={form.active_until} onChange={e => upd('active_until', e.target.value)} className={inputClass} />
              </div>
            </div>

            {error && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-500">{error}</p>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button onClick={cancel} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 bg-white">Cancel</button>
              <button
                onClick={save}
                disabled={!form.title.trim() || saving}
                className="flex-1 py-2.5 rounded-xl bg-[#D93518] text-white text-sm font-bold disabled:opacity-40 active:scale-95 transition-transform"
              >
                {saving ? 'Saving…' : editId ? 'Update Banner' : 'Create Banner'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Promos table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(217,53,24,0.15)', borderTopColor: '#D93518' }} />
        </div>
      ) : promos.length === 0 ? (
        <div className="text-center py-16">
          <Megaphone className="w-8 h-8 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No promotions yet. Create your first banner.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {promos.map(p => (
            <div key={p.id} className={`rounded-2xl border bg-white overflow-hidden transition-opacity ${!p.is_active ? 'opacity-50' : 'border-gray-100'}`}>
              <div className="flex gap-4 p-4">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.title} className="w-20 h-14 object-cover rounded-xl flex-shrink-0 bg-gray-50" />
                ) : (
                  <div className="w-20 h-14 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                    <Megaphone className="w-5 h-5 text-gray-200" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{p.title}</p>
                      {p.subtitle && <p className="text-xs text-gray-400 mt-0.5 truncate">{p.subtitle}</p>}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-gray-50 border border-gray-100 text-[10px] font-medium text-gray-500">
                          {p.placement}
                        </span>
                        {p.cta_label && (
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-100 text-[10px] font-medium text-blue-500">
                            CTA: {p.cta_label}
                          </span>
                        )}
                        {p.active_until && (
                          <span className="text-[10px] text-gray-300">
                            Until {new Date(p.active_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => toggleActive(p)} className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors">
                        {p.is_active
                          ? <ToggleRight className="w-5 h-5 text-[#D93518]" />
                          : <ToggleLeft className="w-5 h-5 text-gray-300" />}
                        <span className={`text-[10px] font-semibold ${p.is_active ? 'text-[#D93518]' : 'text-gray-300'}`}>
                          {p.is_active ? 'Live' : 'Off'}
                        </span>
                      </button>
                      <button onClick={() => openEdit(p)} className="w-7 h-7 rounded-lg border border-gray-100 flex items-center justify-center hover:border-gray-300 transition-colors">
                        <Pencil className="w-3 h-3 text-gray-400" />
                      </button>
                      <button
                        onClick={() => del(p.id)}
                        disabled={deletingId === p.id}
                        className="w-7 h-7 rounded-lg border border-red-100 bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors disabled:opacity-40"
                      >
                        {deletingId === p.id
                          ? <div className="w-3 h-3 rounded-full border border-red-300 border-t-transparent animate-spin" />
                          : <Trash2 className="w-3 h-3 text-red-400" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Admin page ──────────────────────────────────────────────────────────

type AccessState = 'loading' | 'granted' | 'denied';

export default function Admin() {
  const navigate = useNavigate();
  const [access, setAccess] = useState<AccessState>('loading');
  const [tab, setTab] = useState<AdminTab>('events');

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setAccess('denied'); return; }
      const { data } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', session.user.id)
        .single();
      setAccess(data?.subscription_tier === 'admin' ? 'granted' : 'denied');
    })();
  }, []);

  if (access === 'loading') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(217,53,24,0.15)', borderTopColor: '#D93518' }} />
      </div>
    );
  }

  if (access === 'denied') {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center px-6 text-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
          <ShieldAlert className="w-7 h-7 text-[#D93518]" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900 mb-1">Access Denied</h1>
          <p className="text-sm text-gray-400 max-w-xs">
            This page is for Runivo admins only. Your account doesn't have admin access.
          </p>
          <p className="text-xs text-gray-300 mt-3">
            To grant access, run in Supabase SQL editor:<br />
            <code className="text-gray-500">update profiles set subscription_tier = 'admin' where id = '&lt;your-user-id&gt;';</code>
          </p>
        </div>
        <button onClick={() => navigate('/home')} className="mt-2 px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold">
          Back to app
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-5 py-4 flex items-center gap-4"
        style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <button onClick={() => navigate('/home')} className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-gray-500" strokeWidth={2} />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-gray-900 leading-tight">
            run<span style={{ color: '#D93518' }}>ivo</span> Admin
          </h1>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Content Management</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-semibold text-green-600">Live</span>
        </div>
      </div>

      {/* Sidebar + content */}
      <div className="flex min-h-[calc(100vh-65px)]">
        {/* Sidebar */}
        <aside className="w-52 flex-shrink-0 border-r border-gray-100 bg-white pt-6 px-3 hidden sm:block">
          {([
            { id: 'events',     label: 'Events',     Icon: Calendar,  count: null },
            { id: 'promotions', label: 'Promotions', Icon: Megaphone, count: null },
          ] as { id: AdminTab; label: string; Icon: typeof Calendar; count: number | null }[]).map(item => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium mb-1 transition-colors ${
                tab === item.id
                  ? 'bg-[#D93518]/8 text-[#D93518] font-semibold'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              <item.Icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.8} />
              {item.label}
            </button>
          ))}
        </aside>

        {/* Mobile tab bar */}
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-10 bg-white border-t border-gray-100 flex"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {([
            { id: 'events',     label: 'Events',     Icon: Calendar  },
            { id: 'promotions', label: 'Promotions', Icon: Megaphone },
          ] as { id: AdminTab; label: string; Icon: typeof Calendar }[]).map(item => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-semibold transition-colors ${
                tab === item.id ? 'text-[#D93518]' : 'text-gray-400'
              }`}
            >
              <item.Icon className="w-5 h-5" strokeWidth={1.8} />
              {item.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <main className="flex-1 px-5 py-6 pb-32 sm:pb-8 max-w-4xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
            >
              {tab === 'events'     && <EventsSection />}
              {tab === 'promotions' && <PromotionsSection />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
