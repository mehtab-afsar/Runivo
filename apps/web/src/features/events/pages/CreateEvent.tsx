import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { createEvent } from '@features/events/services/eventService';
import { haptic } from '@shared/lib/haptics';

const EVENT_TYPES = [
  { value: 'community-run', label: 'Community Run' },
  { value: 'race',          label: 'Race' },
  { value: 'challenge',     label: 'Challenge' },
  { value: 'brand-challenge', label: 'Brand Challenge' },
  { value: 'king-of-hill',  label: 'King of the Hill' },
  { value: 'survival',      label: 'Survival Run' },
];

export default function CreateEvent(): JSX.Element {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    event_type: 'community-run',
    starts_at: '',
    location_name: '',
    distance_km: '',
    description: '',
  });

  const update = (field: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const canSubmit = form.title.trim().length >= 3 && form.starts_at && form.location_name.trim().length >= 2;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    haptic('medium');

    const startsAt = new Date(form.starts_at);
    const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);

    try {
      await createEvent({
        title:         form.title.trim(),
        event_type:    form.event_type,
        starts_at:     startsAt.toISOString(),
        ends_at:       endsAt.toISOString(),
        location_name: form.location_name.trim(),
        distance_m:    form.distance_km ? Math.round(parseFloat(form.distance_km) * 1000) : null,
        description:   form.description.trim() || null,
      });
      haptic('success');
      navigate('/events');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event.');
      setSaving(false);
    }
  };

  // font-size must stay at 16px to prevent iOS Safari auto-zoom on focus
  const inputClass = `w-full px-4 py-3.5 rounded-2xl bg-gray-50 border border-gray-200
                      text-gray-900 font-medium placeholder:text-gray-300
                      focus:outline-none focus:border-[#E8435A] focus:bg-white transition-all`;
  const labelClass = 'text-[11px] font-semibold text-gray-400 uppercase tracking-wider pl-1';

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A] pb-32">
      {/* Header */}
      <div
        className="sticky top-0 z-10 bg-[#FAFAFA]/90 dark:bg-[#0A0A0A]/90 backdrop-blur border-b border-gray-100 px-5 py-4 flex items-center gap-3"
        style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center shadow-sm"
        >
          <ArrowLeft className="w-4 h-4 text-gray-500" strokeWidth={2} />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-gray-900">Create Event</h1>
          <p className="text-xs text-gray-400">Empire Builder · Exclusive</p>
        </div>
      </div>

      <div className="px-5 pt-6 space-y-4">
        {/* Title */}
        <div>
          <label className={labelClass}>Event Title</label>
          <input
            type="text"
            value={form.title}
            onChange={e => update('title', e.target.value)}
            placeholder="e.g. Sunday Morning Run"
            maxLength={80}
            className={`mt-1 ${inputClass}`}
            autoFocus
          />
        </div>

        {/* Type */}
        <div>
          <label className={labelClass}>Event Type</label>
          <select
            value={form.event_type}
            onChange={e => update('event_type', e.target.value)}
            className={`mt-1 ${inputClass}`}
          >
            {EVENT_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Date & Time */}
        <div>
          <label className={labelClass}>Start Date & Time</label>
          <input
            type="datetime-local"
            value={form.starts_at}
            onChange={e => update('starts_at', e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
            className={`mt-1 ${inputClass}`}
          />
          <p className="text-[10px] text-gray-300 mt-1 pl-1">End time is set to +2 hours automatically</p>
        </div>

        {/* Location */}
        <div>
          <label className={labelClass}>Location Name</label>
          <input
            type="text"
            value={form.location_name}
            onChange={e => update('location_name', e.target.value)}
            placeholder="e.g. Central Park, New York"
            className={`mt-1 ${inputClass}`}
          />
        </div>

        {/* Distance (optional) */}
        <div>
          <label className={labelClass}>Distance (km) <span className="normal-case tracking-normal font-normal text-gray-300">Optional</span></label>
          <input
            type="number"
            value={form.distance_km}
            onChange={e => update('distance_km', e.target.value)}
            placeholder="e.g. 5"
            min="0"
            step="0.1"
            className={`mt-1 ${inputClass}`}
          />
        </div>

        {/* Description */}
        <div>
          <label className={labelClass}>Description <span className="normal-case tracking-normal font-normal text-gray-300">Optional</span></label>
          <textarea
            value={form.description}
            onChange={e => update('description', e.target.value)}
            placeholder="Tell runners what to expect..."
            rows={3}
            maxLength={500}
            className={`mt-1 ${inputClass} resize-none`}
          />
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-100">
            <p className="text-xs text-red-500">{error}</p>
          </div>
        )}
      </div>

      {/* Submit */}
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed bottom-0 left-0 right-0 p-5 bg-[#FAFAFA]/90 dark:bg-[#0A0A0A]/90 backdrop-blur border-t border-gray-100"
        style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || saving}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#E8435A] to-[#D03A4F]
                     text-sm font-bold text-white shadow-[0_4px_16px_rgba(232,67,90,0.25)]
                     disabled:opacity-40 active:scale-[0.98] transition-transform"
        >
          {saving ? 'Creating Event…' : 'Create Event'}
        </button>
      </motion.div>
    </div>
  );
}
