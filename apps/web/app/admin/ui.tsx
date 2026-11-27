'use client';
import { AlertCircle, X } from 'lucide-react';
import type { ReactNode } from 'react';

export const inputClass = `w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200
  text-gray-900 text-[15px] font-medium placeholder:text-gray-300 placeholder:font-normal
  focus:outline-none focus:border-[#4E7F1F] focus:bg-white transition-all`;

export const labelClass = 'text-[10px] font-semibold text-gray-400 uppercase tracking-widest pl-0.5 mb-1 block';

export const primaryBtn = 'flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#4E7F1F] text-white text-sm font-semibold shadow-sm active:scale-95 transition-transform disabled:opacity-40';
export const ghostBtn = 'px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:border-gray-300 transition-colors disabled:opacity-40';
export const thClass = 'text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-3';

export function Field({ label, hint, children, wide }: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <label className={labelClass}>
        {label} {hint && <span className="normal-case font-normal tracking-normal text-gray-300">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
      <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
      <p className="text-xs text-red-500">{message}</p>
    </div>
  );
}

export function FormCard({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="mb-6 p-5 rounded-2xl border border-[#4E7F1F]/20 bg-[#EEF5E4]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white border border-gray-100 flex items-center justify-center" aria-label="Close">
          <X className="w-3.5 h-3.5 text-gray-400" />
        </button>
      </div>
      {children}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(78,127,31,0.15)', borderTopColor: '#4E7F1F' }} />
    </div>
  );
}

export function Badge({ tone, children }: { tone: 'green' | 'blue' | 'orange' | 'gray' | 'red' | 'gold'; children: ReactNode }) {
  const cls = {
    green:  'text-green-700 bg-green-50 border-green-100',
    blue:   'text-blue-700 bg-blue-50 border-blue-100',
    orange: 'text-orange-700 bg-orange-50 border-orange-100',
    gray:   'text-gray-500 bg-gray-50 border-gray-100',
    red:    'text-red-600 bg-red-50 border-red-100',
    gold:   'text-amber-700 bg-amber-50 border-amber-100',
  }[tone];
  return <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border whitespace-nowrap ${cls}`}>{children}</span>;
}

/** <input type="datetime-local"> value for an ISO timestamp, in the admin's local time. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** ISO string from a datetime-local value (interpreted in the admin's time zone). */
export function fromLocalInput(v: string): string | null {
  return v ? new Date(v).toISOString() : null;
}
