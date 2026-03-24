import { useState, useRef, useEffect } from 'react';
import { haptic } from '@shared/lib/haptics';

export type Gender = 'male' | 'female' | 'other';

interface Props {
  age: number;
  gender: Gender | '';
  heightCm: number;
  weightKg: number;
  onChange: (
    field: 'age' | 'gender' | 'heightCm' | 'weightKg',
    value: number | Gender | '',
  ) => void;
}

const CRIMSON = '#E8435A';

// ─── Value arrays (always indexed by raw cm/kg/years) ─────────────────────────

const AGE_VALUES   = Array.from({ length: 90  }, (_, i) => String(i + 10));   // 10–99
const CM_VALUES    = Array.from({ length: 121 }, (_, i) => String(i + 100));  // 100–220 cm
const FT_VALUES    = Array.from({ length: 121 }, (_, i) => {
  const totalIn = Math.round((i + 100) / 2.54);
  return `${Math.floor(totalIn / 12)}'${totalIn % 12}"`;
});
const KG_VALUES    = Array.from({ length: 171 }, (_, i) => String(i + 30));   // 30–200 kg
const LBS_VALUES   = Array.from({ length: 171 }, (_, i) =>
  String(Math.round((i + 30) * 2.2046))
);

// ─── Drum Picker ──────────────────────────────────────────────────────────────

const ITEM_H = 42;
const VISIBLE = 5;

function DrumPicker({
  values, selectedIdx, onChange, unit,
}: {
  values: string[];
  selectedIdx: number;
  onChange: (idx: number) => void;
  unit?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isUserScrolling = useRef(false);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastIdx = useRef(selectedIdx);

  // Scroll to position on mount and on external selectedIdx change
  useEffect(() => {
    const el = ref.current;
    if (!el || isUserScrolling.current) return;
    el.scrollTop = selectedIdx * ITEM_H;
    lastIdx.current = selectedIdx;
  }, [selectedIdx]);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    isUserScrolling.current = true;
    clearTimeout(snapTimer.current);
    snapTimer.current = setTimeout(() => { isUserScrolling.current = false; }, 200);

    const idx = Math.round(el.scrollTop / ITEM_H);
    const clamped = Math.max(0, Math.min(values.length - 1, idx));
    if (clamped !== lastIdx.current) {
      lastIdx.current = clamped;
      haptic('light');
      onChange(clamped);
    }
  };

  return (
    <div style={{ position: 'relative', height: ITEM_H * VISIBLE, flex: 1 }}>
      {/* Selection band */}
      <div style={{
        position: 'absolute', left: 4, right: 4,
        top: ITEM_H * 2, height: ITEM_H,
        background: 'rgba(232,67,90,0.08)',
        borderRadius: 10, pointerEvents: 'none', zIndex: 1,
      }} />
      {/* Top fade */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: ITEM_H * 2,
        background: 'linear-gradient(to bottom, rgba(247,246,244,1) 0%, rgba(247,246,244,0) 100%)',
        pointerEvents: 'none', zIndex: 2,
      }} />
      {/* Bottom fade */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: ITEM_H * 2,
        background: 'linear-gradient(to top, rgba(247,246,244,1) 0%, rgba(247,246,244,0) 100%)',
        pointerEvents: 'none', zIndex: 2,
      }} />
      {/* Scrollable drum */}
      <div
        ref={ref}
        onScroll={onScroll}
        style={{
          height: '100%',
          overflowY: 'scroll',
          scrollSnapType: 'y mandatory',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
          paddingTop: ITEM_H * 2,
          paddingBottom: ITEM_H * 2,
        } as React.CSSProperties}
        className="drum-scroll"
      >
        {values.map((v, i) => {
          const dist = Math.abs(i - selectedIdx);
          return (
            <div
              key={i}
              style={{
                height: ITEM_H,
                scrollSnapAlign: 'center',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: dist === 0 ? 22 : dist === 1 ? 17 : 14,
                fontWeight: dist === 0 ? 700 : 400,
                color: dist === 0 ? '#1A1A1A' : dist === 1 ? '#9CA3AF' : '#D1D5DB',
                fontFamily: "'DM Sans', sans-serif",
                letterSpacing: '-0.02em',
                transition: 'font-size 0.1s, color 0.1s',
              }}
            >
              {v}
            </div>
          );
        })}
      </div>
      {/* Unit label */}
      {unit && (
        <div style={{
          position: 'absolute', bottom: -18, left: 0, right: 0,
          textAlign: 'center', fontSize: 10, fontWeight: 600,
          color: '#B0B0B0', fontFamily: "'DM Sans', sans-serif",
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          {unit}
        </div>
      )}
    </div>
  );
}

// ─── Unit Toggle ──────────────────────────────────────────────────────────────

function UnitToggle({ value, options, onChange }: {
  value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', background: '#ECEAE7', borderRadius: 8, padding: 2 }}>
      {options.map(o => (
        <button
          key={o}
          onClick={() => { onChange(o); haptic('light'); }}
          style={{
            padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
            border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
            transition: 'all 0.18s',
            ...(value === o
              ? { background: '#fff', color: CRIMSON, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
              : { background: 'transparent', color: '#9CA3AF' }),
          }}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

// ─── Gender Mascots ───────────────────────────────────────────────────────────

function MascotMan({ active }: { active: boolean }) {
  const c = active ? CRIMSON : '#CBCBCB';
  const f = active ? 'rgba(232,67,90,0.1)' : '#F0EFED';
  return (
    <svg width="52" height="58" viewBox="0 0 52 58" fill="none" style={{ overflow: 'visible' }}>
      <g style={active ? { animation: 'gBounce 1s ease-in-out', transformOrigin: '26px 46px' } : {}}>
        <path d="M16 21 Q16 11 26 10 Q36 11 36 21" fill={f} stroke={c} strokeWidth="1.6" strokeLinejoin="round" />
        <line x1="17" y1="16" x2="14" y2="11" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="26" y1="13" x2="26" y2="9"  stroke={c} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="35" y1="16" x2="38" y2="11" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="26" cy="21" r="9.5" fill={f} stroke={c} strokeWidth="1.8" />
        <g style={active ? { animation: 'gEyeBlink 3s ease-in-out infinite' } : {}}>
          <circle cx="22.5" cy="20" r="1.3" fill="#1A1A1A" />
          <circle cx="29.5" cy="20" r="1.3" fill="#1A1A1A" />
          <circle cx="23"   cy="19.4" r="0.42" fill="white" />
          <circle cx="30"   cy="19.4" r="0.42" fill="white" />
        </g>
        <path d="M22.5 23.5Q26 27 29.5 23.5" fill="none" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="18" cy="22.5" r="2.2" fill={CRIMSON} opacity={active ? 0.22 : 0.06}
          style={active ? { animation: 'gCheekPulse 2s ease-in-out infinite' } : {}} />
        <circle cx="34" cy="22.5" r="2.2" fill={CRIMSON} opacity={active ? 0.22 : 0.06}
          style={active ? { animation: 'gCheekPulse 2s 0.3s ease-in-out infinite' } : {}} />
        <line x1="26" y1="30.5" x2="26" y2="42" stroke={c} strokeWidth="2.4" strokeLinecap="round" />
        <g style={active ? { animation: 'gWaveL 0.9s 0.1s ease-in-out', transformOrigin: '26px 33px' } : {}}>
          <line x1="26" y1="33" x2="13" y2="29" stroke={c} strokeWidth="2" strokeLinecap="round" />
          <circle cx="12.5" cy="28.5" r="1.4" fill={f} stroke={c} strokeWidth="0.9" />
        </g>
        <g style={active ? { animation: 'gWaveR 0.9s 0.2s ease-in-out', transformOrigin: '26px 33px' } : {}}>
          <line x1="26" y1="33" x2="39" y2="29" stroke={c} strokeWidth="2" strokeLinecap="round" />
          <circle cx="39.5" cy="28.5" r="1.4" fill={f} stroke={c} strokeWidth="0.9" />
        </g>
        <line x1="26" y1="42" x2="22" y2="52" stroke={c} strokeWidth="2.2" strokeLinecap="round" />
        <line x1="26" y1="42" x2="30" y2="52" stroke={c} strokeWidth="2.2" strokeLinecap="round" />
      </g>
      {active && <text x="38" y="12" fontSize="11" fill={CRIMSON} style={{ animation: 'gSparkle 0.8s 0.4s ease-out both' }} opacity="0.8">✦</text>}
    </svg>
  );
}

function MascotWoman({ active }: { active: boolean }) {
  const c = active ? CRIMSON : '#CBCBCB';
  const f = active ? 'rgba(232,67,90,0.1)' : '#F0EFED';
  return (
    <svg width="52" height="58" viewBox="0 0 52 58" fill="none" style={{ overflow: 'visible' }}>
      <g style={active ? { animation: 'gBounce 1s ease-in-out', transformOrigin: '26px 46px' } : {}}>
        <path d="M15 21 Q11 33 13 48" fill="none" stroke={c} strokeWidth="4" strokeLinecap="round" opacity="0.5" />
        <path d="M37 21 Q41 33 39 48" fill="none" stroke={c} strokeWidth="4" strokeLinecap="round" opacity="0.5" />
        <path d="M16 19 Q16 9 26 9 Q36 9 36 19" fill={f} stroke={c} strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx="26" cy="21" r="9.5" fill={f} stroke={c} strokeWidth="1.8" />
        <g style={active ? { animation: 'gEyeBlink 3.2s ease-in-out infinite' } : {}}>
          <circle cx="22.5" cy="20" r="1.3" fill="#1A1A1A" />
          <circle cx="29.5" cy="20" r="1.3" fill="#1A1A1A" />
          <circle cx="23"   cy="19.4" r="0.42" fill="white" />
          <circle cx="30"   cy="19.4" r="0.42" fill="white" />
        </g>
        <line x1="20.5" y1="18.2" x2="20" y2="17" stroke={c} strokeWidth="1" strokeLinecap="round" />
        <line x1="22.5" y1="17.6" x2="22.5" y2="16.4" stroke={c} strokeWidth="1" strokeLinecap="round" />
        <line x1="24.5" y1="18.2" x2="25"   y2="17"   stroke={c} strokeWidth="1" strokeLinecap="round" />
        <line x1="27.5" y1="18.2" x2="27"   y2="17"   stroke={c} strokeWidth="1" strokeLinecap="round" />
        <line x1="29.5" y1="17.6" x2="29.5" y2="16.4" stroke={c} strokeWidth="1" strokeLinecap="round" />
        <line x1="31.5" y1="18.2" x2="32"   y2="17"   stroke={c} strokeWidth="1" strokeLinecap="round" />
        <path d="M22.5 23.5Q26 27.5 29.5 23.5" fill="none" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="18" cy="22.5" r="2.2" fill={CRIMSON} opacity={active ? 0.22 : 0.06}
          style={active ? { animation: 'gCheekPulse 2s ease-in-out infinite' } : {}} />
        <circle cx="34" cy="22.5" r="2.2" fill={CRIMSON} opacity={active ? 0.22 : 0.06}
          style={active ? { animation: 'gCheekPulse 2s 0.3s ease-in-out infinite' } : {}} />
        <line x1="26" y1="30.5" x2="26" y2="42" stroke={c} strokeWidth="2.4" strokeLinecap="round" />
        <g style={active ? { animation: 'gWaveL 0.85s 0.1s ease-in-out', transformOrigin: '26px 32px' } : {}}>
          <line x1="26" y1="32" x2="14" y2="27" stroke={c} strokeWidth="2" strokeLinecap="round" />
          <circle cx="13.5" cy="26.5" r="1.4" fill={f} stroke={c} strokeWidth="0.9" />
        </g>
        <g style={active ? { animation: 'gWaveR 0.85s 0.2s ease-in-out', transformOrigin: '26px 32px' } : {}}>
          <line x1="26" y1="32" x2="38" y2="27" stroke={c} strokeWidth="2" strokeLinecap="round" />
          <circle cx="38.5" cy="26.5" r="1.4" fill={f} stroke={c} strokeWidth="0.9" />
        </g>
        <line x1="26" y1="42" x2="22" y2="52" stroke={c} strokeWidth="2.2" strokeLinecap="round" />
        <line x1="26" y1="42" x2="30" y2="52" stroke={c} strokeWidth="2.2" strokeLinecap="round" />
      </g>
      {active && <text x="37" y="12" fontSize="11" fill={CRIMSON} style={{ animation: 'gSparkle 0.8s 0.4s ease-out both' }} opacity="0.8">♥</text>}
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BiometricsStep({ age, gender, heightCm, weightKg, onChange }: Props) {
  const [htUnit, setHtUnit] = useState<'cm' | 'ft'>('cm');
  const [wtUnit, setWtUnit] = useState<'kg' | 'lbs'>('kg');

  const ageIdx    = Math.max(0, Math.min(89,  (age       || 25)  - 10));
  const heightIdx = Math.max(0, Math.min(120, (heightCm  || 170) - 100));
  const weightIdx = Math.max(0, Math.min(170, (weightKg  || 70)  - 30));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '0 16px 12px', gap: 16 }}>
      <style>{`
        .drum-scroll::-webkit-scrollbar { display: none; }
        @keyframes gBounce { 0%,100%{transform:translateY(0) scaleY(1)} 15%{transform:translateY(2px) scaleY(0.92)} 35%{transform:translateY(-9px) scaleY(1.05)} 55%{transform:translateY(0) scaleY(0.97)} 70%{transform:translateY(-4px) scaleY(1.02)} 85%{transform:translateY(0) scaleY(1)} }
        @keyframes gWaveL { 0%,100%{transform:rotate(0deg)} 30%{transform:rotate(-28deg)} 65%{transform:rotate(14deg)} }
        @keyframes gWaveR { 0%,100%{transform:rotate(0deg)} 30%{transform:rotate(28deg)} 65%{transform:rotate(-14deg)} }
        @keyframes gEyeBlink { 0%,44%,48%,100%{transform:scaleY(1)} 46%{transform:scaleY(0.1)} }
        @keyframes gCheekPulse { 0%,100%{opacity:0.2;transform:scale(1)} 50%{opacity:0.36;transform:scale(1.15)} }
        @keyframes gSparkle { 0%{opacity:0;transform:translateY(4px) scale(0.5)} 60%{opacity:1;transform:translateY(-7px) scale(1)} 100%{opacity:0;transform:translateY(-14px) scale(0.7)} }
      `}</style>

      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1A1A1A', marginBottom: 2, fontFamily: "'DM Sans', sans-serif" }}>
          Your body stats
        </h2>
        <p style={{ fontSize: 12, color: '#A0A0A0', fontFamily: "'DM Sans', sans-serif" }}>
          For accurate calorie &amp; pace calculations
        </p>
      </div>

      {/* Gender */}
      <div style={{ display: 'flex', gap: 10 }}>
        {([
          { id: 'male'   as Gender, label: 'Male',   Mascot: MascotMan   },
          { id: 'female' as Gender, label: 'Female', Mascot: MascotWoman },
        ] as const).map(({ id, label, Mascot }) => {
          const sel = gender === id;
          return (
            <button
              key={id}
              onClick={() => { onChange('gender', id); haptic('light'); }}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '12px 6px 10px', borderRadius: 16, border: '1.5px solid',
                cursor: 'pointer', background: sel ? '#FFF6F7' : '#F7F6F4',
                borderColor: sel ? CRIMSON : '#E8E5E0',
                boxShadow: sel ? `0 0 0 2px rgba(232,67,90,0.12)` : 'none',
                transition: 'all 0.18s',
              }}
            >
              <Mascot active={sel} />
              <span style={{
                fontSize: 11, fontWeight: 700, marginTop: 4,
                color: sel ? CRIMSON : '#A0A0A0',
                fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.02em',
              }}>
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Drums: Age | Height | Weight */}
      <div style={{ background: '#F7F6F4', borderRadius: 20, padding: '14px 12px 28px' }}>
        {/* Column headers */}
        <div style={{ display: 'flex', marginBottom: 8 }}>
          {/* Age */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#A0A0A0', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif" }}>
              Age
            </span>
          </div>
          {/* Height */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <UnitToggle value={htUnit} options={['cm', 'ft']} onChange={v => setHtUnit(v as 'cm' | 'ft')} />
          </div>
          {/* Weight */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <UnitToggle value={wtUnit} options={['kg', 'lbs']} onChange={v => setWtUnit(v as 'kg' | 'lbs')} />
          </div>
        </div>

        {/* Divider lines between columns */}
        <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
          {/* Vertical dividers */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            left: 'calc(33.33% - 0.5px)', width: 1,
            background: 'rgba(0,0,0,0.06)',
          }} />
          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            left: 'calc(66.66% - 0.5px)', width: 1,
            background: 'rgba(0,0,0,0.06)',
          }} />

          {/* Age drum */}
          <DrumPicker
            values={AGE_VALUES}
            selectedIdx={ageIdx}
            onChange={idx => onChange('age', idx + 10)}
            unit="years"
          />

          {/* Height drum */}
          <DrumPicker
            values={htUnit === 'cm' ? CM_VALUES : FT_VALUES}
            selectedIdx={heightIdx}
            onChange={idx => onChange('heightCm', idx + 100)}
            unit={htUnit === 'cm' ? 'cm' : 'ft · in'}
          />

          {/* Weight drum */}
          <DrumPicker
            values={wtUnit === 'kg' ? KG_VALUES : LBS_VALUES}
            selectedIdx={weightIdx}
            onChange={idx => onChange('weightKg', idx + 30)}
            unit={wtUnit}
          />
        </div>
      </div>
    </div>
  );
}
