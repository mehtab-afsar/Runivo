import { useState } from 'react';

// ── Tokens ────────────────────────────────────────────────────────────────────
export const T = {
  bg:       '#F8F6F3',
  white:    '#FFFFFF',
  stone:    '#F0EDE8',
  border:   '#DDD9D4',
  black:    '#0A0A0A',
  t2:       '#6B6B6B',
  t3:       '#ADADAD',
  red:      '#D93518',
  redLight: '#ECC4BC',
  hexMuted: '#C4C0BA',
} as const;

export const F  = "'Barlow', -apple-system, sans-serif";
export const FD = "'Playfair Display', Georgia, serif";

export const BASE_CSS = `
@keyframes drawHex {
  from { stroke-dashoffset: 1000; }
  to   { stroke-dashoffset: 0;    }
}
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0);    }
}
@keyframes spin { to { transform: rotate(360deg); } }

.lp-field-row {
  padding: 11px 0;
  border-bottom: 0.5px solid ${T.border};
  transition: border-color 0.15s, border-width 0.15s;
}
.lp-field-row:focus-within {
  border-bottom: 1px solid ${T.black};
}
.lp-field-input {
  flex: 1; font-size: 13px; font-weight: 300; color: ${T.black};
  background: transparent; border: none; outline: none; padding: 0;
}
.lp-field-input::placeholder { color: ${T.t3}; }
.lp-or-line { flex: 1; height: 0.5px; background: ${T.border}; }
.lp-ghost-btn {
  width: 100%; padding: 12px 0; border-radius: 4px;
  background: transparent; border: 0.5px solid ${T.border};
  font-size: 11px; font-weight: 400; color: ${T.t2};
  cursor: pointer; transition: background 150ms;
}
.lp-ghost-btn:hover { background: ${T.stone}; }
.lp-feature-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 32px rgba(0,0,0,0.07), 0 2px 8px rgba(0,0,0,0.04);
}
.lp-feature-mid:hover {
  transform: translateY(-3px);
  box-shadow: 0 20px 56px rgba(0,0,0,0.22), 0 6px 16px rgba(0,0,0,0.14);
}
`;

// ── HexMark ───────────────────────────────────────────────────────────────────
let _id = 0;
export function HexMark({
  size, darkColor, lightColor, strokeWidth = 4.5, animated = false,
}: {
  size: number; darkColor: string; lightColor: string;
  strokeWidth?: number; animated?: boolean;
}) {
  const [uid] = useState(() => `hm${++_id}`);
  const dash = animated ? { strokeDasharray: 1000, strokeDashoffset: 1000 } : {};
  return (
    <svg width={size} height={size} viewBox="0 0 88 88" fill="none" style={{ flexShrink: 0, display: 'block' }}>
      <defs>
        <clipPath id={`${uid}d`}><rect x="0" y="0" width="44" height="88" /></clipPath>
        <clipPath id={`${uid}l`}><rect x="44" y="0" width="44" height="88" /></clipPath>
      </defs>
      <polygon
        points="44,7 78,26 78,62 44,81 10,62 10,26"
        stroke={darkColor} strokeWidth={strokeWidth} fill="none" strokeLinejoin="round"
        clipPath={`url(#${uid}d)`}
        style={animated ? { ...dash, animation: 'drawHex 1.2s 0.1s cubic-bezier(0.4,0,0.2,1) both' } : {}}
      />
      <polygon
        points="44,7 78,26 78,62 44,81 10,62 10,26"
        stroke={lightColor} strokeWidth={strokeWidth} fill="none" strokeLinejoin="round"
        clipPath={`url(#${uid}l)`}
        style={animated ? { ...dash, animation: 'drawHex 1.2s 0.4s cubic-bezier(0.4,0,0.2,1) both' } : {}}
      />
    </svg>
  );
}

// ── Underline field ───────────────────────────────────────────────────────────
export function Field({
  label, value, onChange, type = 'text', placeholder = '',
  error = '', maxLen, rightEl, autoFocus = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; error?: string;
  maxLen?: number; rightEl?: React.ReactNode; autoFocus?: boolean;
}) {
  return (
    <div className="lp-field-row">
      <div style={{ fontSize: 8, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: T.t3, fontFamily: F, fontWeight: 500, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <input
          className="lp-field-input"
          style={{ fontFamily: F }}
          type={type} value={value} autoFocus={autoFocus}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder} maxLength={maxLen}
        />
        {rightEl && <div style={{ flexShrink: 0, marginLeft: 8 }}>{rightEl}</div>}
      </div>
      {error && <div style={{ fontSize: 9, color: T.red, marginTop: 3, fontFamily: F }}>{error}</div>}
    </div>
  );
}

// ── Or divider ────────────────────────────────────────────────────────────────
export function OrDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
      <div className="lp-or-line" />
      <span style={{ fontSize: 9, fontFamily: F, fontWeight: 300, color: T.t3, textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>or</span>
      <div className="lp-or-line" />
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner() {
  return (
    <div style={{ width: 12, height: 12, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
  );
}

// ── Full-width button ─────────────────────────────────────────────────────────
export function FullBtn({
  label, onClick, bg, color = '#fff', disabled = false, loading = false,
}: {
  label: string; onClick: () => void; bg: string; color?: string;
  disabled?: boolean; loading?: boolean;
}) {
  return (
    <button
      onClick={onClick} disabled={disabled || loading}
      style={{
        width: '100%', padding: '13px 0', borderRadius: 4,
        background: disabled ? '#E8E4DF' : bg,
        color: disabled ? T.t3 : color,
        fontFamily: F, fontSize: 11, fontWeight: 500,
        textTransform: 'uppercase' as const, letterSpacing: '0.08em',
        border: 'none', cursor: disabled || loading ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        transition: 'transform 150ms',
      }}
    >
      {loading && <Spinner />}
      {label}
    </button>
  );
}

// ── Page shell (shared outer wrapper for auth pages — no card) ────────────────
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100dvh', background: '#F8F6F3',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px', boxSizing: 'border-box',
    }}>
      <style>{BASE_CSS}</style>
      <div style={{ width: '100%', maxWidth: 400, position: 'relative' }}>
        {children}
      </div>
    </div>
  );
}
