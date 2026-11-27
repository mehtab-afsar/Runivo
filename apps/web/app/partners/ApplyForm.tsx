'use client';

import { useState, type CSSProperties, type FormEvent } from 'react';

const CATEGORIES: [string, string][] = [
  ['shoes', 'Running shoes'], ['apparel', 'Apparel'], ['gear', 'Gear and accessories'],
  ['nutrition', 'Nutrition and hydration'], ['cafe', 'Café or restaurant'], ['physio', 'Physio or sports massage'],
  ['races', 'Races and events'], ['gym', 'Gym or studio'], ['insurance', 'Health cover'],
  ['tech', 'Wearables and tech'], ['other', 'Something else'],
];

const label: CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--t2)',
  fontFamily: 'var(--font-body)', marginBottom: 8,
};
const input: CSSProperties = {
  width: '100%', padding: '13px 16px', borderRadius: 12, fontSize: 16,
  background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--t1)',
  fontFamily: 'var(--font-body)',
};
const hint: CSSProperties = { fontSize: 12, color: 'var(--t3)', fontFamily: 'var(--font-body)', marginTop: 6 };

type State = { status: 'idle' | 'sending' | 'sent' | 'error'; message?: string };

export function ApplyForm() {
  const [state, setState] = useState<State>({ status: 'idle' });

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const payload = Object.fromEntries(
      ['name', 'category', 'contact_name', 'contact_email', 'website', 'countries', 'cities', 'offer', 'estimated_stock', 'company_url']
        .map(k => [k, String(f.get(k) ?? '')]),
    );
    setState({ status: 'sending' });
    try {
      const res = await fetch('/api/partners/apply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) setState({ status: 'sent' });
      else setState({ status: 'error', message: data.error ?? 'Something went wrong. Please try again.' });
    } catch {
      setState({ status: 'error', message: 'Couldn’t reach us. Check your connection and try again.' });
    }
  }

  if (state.status === 'sent') {
    return (
      <div role="status" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 22, padding: 32 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--t1)', marginBottom: 10 }}>
          Thanks, we’ve got it.
        </h3>
        <p style={{ fontSize: 15, color: 'var(--t2)', fontFamily: 'var(--font-body)', lineHeight: 1.7 }}>
          We’ll review your offer and reply within 5 working days.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate style={{
      position: 'relative',
      background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 22, padding: 28,
      display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    }}>
      {/* Honeypot: hidden from people, tempting to bots. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor="company_url">Leave this empty</label>
        <input id="company_url" name="company_url" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div>
        <label style={label} htmlFor="name">Company name *</label>
        <input style={input} id="name" name="name" required minLength={2} maxLength={120} autoComplete="organization" />
      </div>
      <div>
        <label style={label} htmlFor="category">Category *</label>
        <select style={input} id="category" name="category" required defaultValue="">
          <option value="" disabled>Choose one</option>
          {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div>
        <label style={label} htmlFor="contact_name">Your name</label>
        <input style={input} id="contact_name" name="contact_name" maxLength={120} autoComplete="name" />
      </div>
      <div>
        <label style={label} htmlFor="contact_email">Work email *</label>
        <input style={input} id="contact_email" name="contact_email" type="email" required maxLength={200} autoComplete="email" />
      </div>
      <div>
        <label style={label} htmlFor="website">Website</label>
        <input style={input} id="website" name="website" maxLength={300} placeholder="yourbrand.com" autoComplete="url" />
      </div>
      <div>
        <label style={label} htmlFor="estimated_stock">How many rewards could you offer?</label>
        <input style={input} id="estimated_stock" name="estimated_stock" type="number" min={0} max={1000000} inputMode="numeric" placeholder="e.g. 500" />
      </div>
      <div>
        <label style={label} htmlFor="countries">Countries</label>
        <input style={input} id="countries" name="countries" maxLength={200} placeholder="IN" />
        <p style={hint}>Two-letter codes, comma separated.</p>
      </div>
      <div>
        <label style={label} htmlFor="cities">Cities</label>
        <input style={input} id="cities" name="cities" maxLength={500} placeholder="Bengaluru, Mumbai" />
        <p style={hint}>Leave empty if you serve the whole country.</p>
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <label style={label} htmlFor="offer">Your offer for runners *</label>
        <textarea style={{ ...input, resize: 'vertical', minHeight: 110 }} id="offer" name="offer" required minLength={5} maxLength={1000}
          placeholder="e.g. 20% off any running shoe, online or in our Indiranagar store. Single-use codes." />
        <p style={hint}>At least 15% off or a free item works best.</p>
      </div>

      <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
        <button type="submit" disabled={state.status === 'sending'} style={{
          padding: '14px 28px', borderRadius: 999, border: 'none', cursor: 'pointer',
          background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-body)',
          opacity: state.status === 'sending' ? 0.6 : 1,
        }}>
          {state.status === 'sending' ? 'Sending…' : 'Send application'}
        </button>
        <p style={{ ...hint, marginTop: 0 }}>We only use these details to reply about partnering.</p>
      </div>

      {state.status === 'error' && (
        <p role="alert" style={{ gridColumn: '1 / -1', fontSize: 14, color: 'var(--danger)', fontFamily: 'var(--font-body)' }}>
          {state.message}
        </p>
      )}
    </form>
  );
}
