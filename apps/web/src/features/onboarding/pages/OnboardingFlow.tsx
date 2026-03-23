import { useState, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check, Eye, EyeOff,
  Activity, TrendingUp, Zap, Compass, Trophy,
} from 'lucide-react';
import { haptic } from '@shared/lib/haptics';
import { initializePlayer } from '@shared/services/store';
import { seedTerritoryData } from '@shared/services/seedData';
import { soundManager } from '@shared/audio/sounds';
import { saveProfile, computeWeeklyGoal } from '@shared/services/profile';
import { signUp, signIn } from '@shared/services/auth';
import { pushProfile } from '@shared/services/sync';
import { supabase } from '@shared/services/supabase';

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:     '#F8F6F3',
  white:  '#FFFFFF',
  stone:  '#F0EDE8',
  mid:    '#E8E4DF',
  border: '#DDD9D4',
  black:  '#0A0A0A',
  t2:     '#6B6B6B',
  t3:     '#ADADAD',
  red:    '#D93518',
  redLo:  '#FEF0EE',
} as const;

const F  = "'Barlow', -apple-system, sans-serif";
const FD = "'Playfair Display', Georgia, serif";

// ── Button ────────────────────────────────────────────────────────────────────
type BtnVariant = 'black' | 'red' | 'disabled' | 'outline';

function Btn({
  label, onClick, variant = 'red', loading = false, small = false,
}: {
  label: string; onClick: () => void; variant?: BtnVariant;
  loading?: boolean; small?: boolean;
}) {
  const bg    = variant === 'black' ? C.black : variant === 'red' ? C.red : variant === 'disabled' ? C.mid : 'transparent';
  const color = variant === 'disabled' ? C.t3 : '#fff';
  const textColor = variant === 'outline' ? C.black : color;
  const border = variant === 'outline' ? `0.5px solid ${C.border}` : 'none';

  return (
    <button
      onClick={onClick}
      disabled={variant === 'disabled' || loading}
      style={{
        width: '100%', padding: small ? '9px 0' : '13px 0',
        borderRadius: 4, background: bg, color: textColor, border,
        fontFamily: F, fontSize: small ? 10 : 12, fontWeight: 500,
        textTransform: 'uppercase' as const, letterSpacing: '0.06em',
        cursor: variant === 'disabled' || loading ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        transition: 'background 0.2s',
      }}
    >
      {loading && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
          style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', flexShrink: 0 }}
        />
      )}
      {label}
    </button>
  );
}

// ── Underline field ───────────────────────────────────────────────────────────
function UnderlineField({
  label, value, onChange, type = 'text', placeholder = '',
  error = '', maxLen, rightEl, autoFocus = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; error?: string;
  maxLen?: number; rightEl?: React.ReactNode; autoFocus?: boolean;
}) {
  return (
    <div style={{ padding: '11px 0', borderBottom: `0.5px solid ${error ? C.red : C.border}` }}>
      <div style={{ fontSize: 8, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: C.t3, fontFamily: F, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <input
          type={type} value={value} autoFocus={autoFocus}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder} maxLength={maxLen}
          style={{
            flex: 1, fontSize: 13, fontFamily: F, fontWeight: 300, color: C.black,
            background: 'transparent', border: 'none', outline: 'none', padding: 0,
          }}
        />
        {rightEl && <div style={{ flexShrink: 0, marginLeft: 8 }}>{rightEl}</div>}
      </div>
      {error && (
        <div style={{ fontSize: 9, color: C.red, marginTop: 3, fontFamily: F }}>{error}</div>
      )}
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
const TOTAL_STEPS = 6;

function ProgressBar({ step }: { step: number }) {
  return (
    <div style={{ display: 'flex', gap: 3, padding: '0 18px', marginTop: 8 }}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <div
          key={i}
          style={{
            flex: 1, height: 1.5, borderRadius: 1,
            background: i < step - 1 ? C.black : i === step - 1 ? C.red : C.mid,
            transition: 'background 0.2s',
          }}
        />
      ))}
    </div>
  );
}

// ── Step header ───────────────────────────────────────────────────────────────
function StepHeader({ step }: { step: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '12px 18px 0' }}>
      <span style={{ fontSize: 9, fontFamily: F, fontWeight: 300, color: C.t3, textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>
        {step} of {TOTAL_STEPS}
      </span>
    </div>
  );
}

// ── Typography helpers ────────────────────────────────────────────────────────
function Eyebrow({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 8, fontFamily: F, fontWeight: 300, color: C.t3, textTransform: 'uppercase' as const, letterSpacing: '0.14em', marginBottom: 6 }}>
      {text}
    </div>
  );
}

function HeroTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: FD, fontStyle: 'italic', fontSize: 22, color: C.black, lineHeight: 1.2, marginBottom: 6 }}>
      {children}
    </div>
  );
}

function Subtitle({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 11, fontFamily: F, fontWeight: 300, color: C.t2, marginBottom: 18, lineHeight: 1.5 }}>
      {text}
    </div>
  );
}

// ── Split hollow hex mark ─────────────────────────────────────────────────────
function HexMark({
  size, color, fadedOpacity = 0.28,
}: { size: number; color: string; fadedOpacity?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ flexShrink: 0, display: 'block' }}>
      {/* left — faded */}
      <polyline
        points="50,4 10.2,27 10.2,73 50,96"
        stroke={color} strokeWidth="5"
        strokeLinejoin="round" strokeLinecap="round"
        opacity={fadedOpacity}
      />
      {/* right — full */}
      <polyline
        points="50,4 89.8,27 89.8,73 50,96"
        stroke={color} strokeWidth="5"
        strokeLinejoin="round" strokeLinecap="round"
      />
    </svg>
  );
}

// ── Phone mockup (landing hero decoration) ────────────────────────────────────
function PhoneMockup() {
  // tiny hex grid drawn inside the phone screen
  const R = 9;
  const W = R * Math.sqrt(3);
  const VS = R * 1.5;
  const caps = new Set(['2,1','3,1','2,2','3,2','4,2','3,3']);
  const tiles: { cx: number; cy: number; cap: boolean }[] = [];
  for (let row = 0; row < 11; row++)
    for (let col = 0; col < 9; col++)
      tiles.push({
        cx: col * W + (row % 2 ? W / 2 : 0) + W / 2,
        cy: row * VS + R,
        cap: caps.has(`${col},${row}`),
      });

  function pts(cx: number, cy: number, r: number) {
    return Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
  }

  return (
    <div style={{
      width: 136, height: 256,
      borderRadius: 26,
      background: '#0F0F12',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 28px 56px rgba(10,10,10,0.28), inset 0 0 0 0.5px rgba(255,255,255,0.06)',
      overflow: 'hidden', position: 'relative', flexShrink: 0,
    }}>
      {/* Dynamic island */}
      <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', width: 48, height: 16, borderRadius: 8, background: '#000', zIndex: 10 }} />
      {/* Hex map */}
      <svg viewBox="0 0 140 200" width="136" height="256" style={{ position: 'absolute', top: 28, left: 0 }}>
        <rect width="140" height="200" fill="#0F0F12" />
        {tiles.map((t, i) => (
          <polygon
            key={i} points={pts(t.cx, t.cy, R - 0.8)}
            fill={t.cap ? 'rgba(217,53,24,0.22)' : 'rgba(255,255,255,0.03)'}
            stroke={t.cap ? '#D93518' : 'rgba(255,255,255,0.07)'}
            strokeWidth="0.6"
          />
        ))}
        {/* user dot */}
        <circle cx={tiles.find(t => t.cap)?.cx ?? 50} cy={(tiles.find(t => t.cap)?.cy ?? 30) - 0} r="5" fill="white" />
        <circle cx={tiles.find(t => t.cap)?.cx ?? 50} cy={(tiles.find(t => t.cap)?.cy ?? 30) - 0} r="3" fill="#D93518" />
      </svg>
      {/* top fade */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 52, background: 'linear-gradient(#0F0F12, transparent)', pointerEvents: 'none' }} />
      {/* bottom bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 36, background: 'linear-gradient(transparent, rgba(15,15,18,0.95))', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 8 }}>
        <div style={{ width: 64, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.22)' }} />
      </div>
    </div>
  );
}

// ── Drum picker (bottom sheet) ────────────────────────────────────────────────
function DrumPicker({
  title, values, value, onSelect, onClose, unit = '',
}: {
  title: string; values: number[]; value: number;
  onSelect: (v: number) => void; onClose: () => void; unit?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const itemH = 44;

  useEffect(() => {
    const idx = values.indexOf(value);
    if (listRef.current && idx !== -1) {
      listRef.current.scrollTop = Math.max(0, idx - 2) * itemH;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(10,10,10,0.4)', display: 'flex', alignItems: 'flex-end' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', background: C.white, borderRadius: '12px 12px 0 0', paddingBottom: 32 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `0.5px solid ${C.border}` }}>
          <span style={{ fontSize: 12, fontFamily: F, fontWeight: 400, color: C.t2 }}>{title}</span>
          <button onClick={onClose} style={{ fontSize: 11, fontFamily: F, color: C.red, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Done</button>
        </div>
        <div style={{ position: 'relative', height: 5 * itemH, overflow: 'hidden' }}>
          <div
            ref={listRef}
            style={{ height: '100%', overflowY: 'scroll', scrollSnapType: 'y mandatory', paddingTop: 2 * itemH, paddingBottom: 2 * itemH }}
          >
            {values.map((v) => (
              <div
                key={v}
                onClick={() => { onSelect(v); haptic('light'); }}
                style={{
                  height: itemH, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  scrollSnapAlign: 'center',
                  fontFamily: F, fontSize: v === value ? 20 : 15, fontWeight: 300,
                  color: v === value ? C.black : C.t3, cursor: 'pointer',
                  transition: 'font-size 0.1s, color 0.1s',
                }}
              >
                {v}{v === value && unit ? ` ${unit}` : ''}
              </div>
            ))}
          </div>
          <div style={{ position: 'absolute', top: '50%', left: 18, right: 18, transform: 'translateY(-50%)', height: itemH, borderTop: `0.5px solid ${C.border}`, borderBottom: `0.5px solid ${C.border}`, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 80, background: `linear-gradient(${C.white}, transparent)`, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: `linear-gradient(transparent, ${C.white})`, pointerEvents: 'none' }} />
        </div>
      </div>
    </div>
  );
}

// ── Step shell (shared layout for steps 1-6) ──────────────────────────────────
function StepShell({ step, children, cta }: { step: number; children: React.ReactNode; cta: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: C.bg }}>
      <StepHeader step={step} />
      <ProgressBar step={step} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 0' }}>
        {children}
      </div>
      <div style={{ padding: '12px 20px 28px', flexShrink: 0 }}>
        {cta}
      </div>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface OnboardingData {
  username: string; email: string; password: string;
  age: number; gender: 'male' | 'female' | 'other' | '';
  heightCm: number; weightKg: number;
  experienceLevel: 'new' | 'casual' | 'regular' | 'competitive';
  primaryGoal: 'get_fit' | 'lose_weight' | 'run_faster' | 'explore' | 'compete';
  weeklyFrequency: number;
  preferredDistance: 'short' | '5k' | '10k' | 'long';
  distanceUnit: 'km' | 'mi';
  notificationsEnabled: boolean;
  plan: 'premium' | 'free';
}

type FlowView = 'welcome' | 'onboarding' | 'login';

// ── Static option lists ───────────────────────────────────────────────────────
const EXP_OPTIONS: { key: OnboardingData['experienceLevel']; label: string; sub: string }[] = [
  { key: 'new',         label: 'Just starting',  sub: 'Under 6 months of running' },
  { key: 'casual',      label: 'Casual runner',  sub: '1–3 runs a week, no pressure' },
  { key: 'regular',     label: 'Regular runner', sub: '4+ runs a week, track PRs' },
  { key: 'competitive', label: 'Competitive',    sub: 'Races, strict training plans' },
];

const GOAL_OPTIONS: { key: OnboardingData['primaryGoal']; label: string; sub: string; icon: React.ReactNode }[] = [
  { key: 'get_fit',     label: 'Get fit',      sub: 'Build endurance and consistency', icon: <Activity size={13} strokeWidth={1.5} /> },
  { key: 'lose_weight', label: 'Lose weight',  sub: 'Burn calories, track progress',   icon: <TrendingUp size={13} strokeWidth={1.5} /> },
  { key: 'run_faster',  label: 'Run faster',   sub: 'Improve pace and performance',    icon: <Zap size={13} strokeWidth={1.5} /> },
  { key: 'explore',     label: 'Explore',      sub: 'Discover new routes and places',  icon: <Compass size={13} strokeWidth={1.5} /> },
  { key: 'compete',     label: 'Compete',      sub: 'Dominate the leaderboard',        icon: <Trophy size={13} strokeWidth={1.5} /> },
];

const DIST_CHIPS: { key: OnboardingData['preferredDistance']; label: string; km: number }[] = [
  { key: 'short', label: '< 3 km', km: 2.5 },
  { key: '5k',    label: '5 km',   km: 5 },
  { key: '10k',   label: '10 km',  km: 10 },
  { key: 'long',  label: '15+ km', km: 15 },
];

const GOAL_LABELS: Record<string, string> = {
  get_fit: 'Get Fit', lose_weight: 'Lose Weight',
  run_faster: 'Run Faster', explore: 'Explore', compete: 'Compete',
};

const EXP_LABELS: Record<string, string> = {
  new: 'Beginner', casual: 'Casual', regular: 'Regular', competitive: 'Competitive',
};

const AGES    = Array.from({ length: 90 },  (_, i) => 10 + i);
const HEIGHTS = Array.from({ length: 121 }, (_, i) => 100 + i);
const WEIGHTS = Array.from({ length: 171 }, (_, i) => 30 + i);

function cmToFtIn(cm: number) {
  const totalIn = Math.round(cm / 2.54);
  return `${Math.floor(totalIn / 12)}′${totalIn % 12}″`;
}

// ── Main component ────────────────────────────────────────────────────────────
export function OnboardingFlow({
  onComplete,
  skipAuth   = false,
  initialView = 'welcome',
  initialStep = 1,
}: {
  onComplete: () => void;
  skipAuth?:    boolean;
  initialView?: FlowView;
  initialStep?: number;
}) {
  // ── Navigation state
  const [view, setView]         = useState<FlowView>(initialView);
  const [step, setStep]         = useState(initialStep);
  const [direction, setDirection] = useState(1);

  // ── Auth state
  const [signing, setSigning]       = useState(false);
  const [signupError, setSignupError] = useState('');
  const [rateLimitCooldown, setRateLimitCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Login state
  const [loginEmail, setLoginEmail]     = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError]     = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showLoginPwd, setShowLoginPwd] = useState(false);

  // ── Step 1 state
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError]     = useState('');

  // ── Step 2 state
  const [picker, setPicker] = useState<null | 'age' | 'height' | 'weight'>(null);
  const [useImperial, setUseImperial]   = useState(false);

  // ── Step 5 state
  const todayIdx = (new Date().getDay() + 6) % 7;
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 3, 5]);

  // ── Step 6 state
  const [showFreeConfirm, setShowFreeConfirm] = useState(false);

  // ── Onboarding data
  const [data, setData] = useState<OnboardingData>({
    username: '', email: '', password: '',
    age: 25, gender: '', heightCm: 170, weightKg: 70,
    experienceLevel: 'casual', primaryGoal: 'get_fit',
    weeklyFrequency: 3, preferredDistance: '5k',
    distanceUnit: 'km', notificationsEnabled: true, plan: 'free',
  });

  const weeklyGoalKm = computeWeeklyGoal(data.weeklyFrequency, data.preferredDistance);
  const weeklyKmDisplay = selectedDays.length * (DIST_CHIPS.find(d => d.key === data.preferredDistance)?.km ?? 5);

  const update = <K extends keyof OnboardingData>(key: K, val: OnboardingData[K]) =>
    setData(prev => ({ ...prev, [key]: val }));

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  // ── Navigation helpers
  const goTo = useCallback((next: number) => {
    setDirection(next > step ? 1 : -1);
    haptic('light');
    setStep(next);
  }, [step]);

  const next = useCallback(() => goTo(step + 1), [goTo, step]);

  // ── Validation
  const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
  const canContinue = (): boolean => {
    if (step === 1) return data.username.trim().length >= 3 && emailOk(data.email) && data.password.length >= 8;
    if (step === 2) return data.gender !== '';
    return true;
  };

  // ── Day toggle helper
  const toggleDay = (i: number) => {
    const next = selectedDays.includes(i) ? selectedDays.filter(x => x !== i) : [...selectedDays, i];
    const clamped = next.length === 0 ? [i] : next;
    setSelectedDays(clamped);
    update('weeklyFrequency', clamped.length);
    haptic('light');
  };

  // ── Auth: complete onboarding
  const completeOnboarding = async () => {
    setSigning(true);
    setSignupError('');

    let trimmedName = data.username.trim() || 'Runner';
    const missionDifficulty =
      data.experienceLevel === 'new' ? 'easy' :
      data.experienceLevel === 'competitive' ? 'hard' : 'mixed';

    if (!skipAuth) {
      try {
        await signUp(data.email.trim(), data.password, trimmedName);
      } catch (err: unknown) {
        const msg    = err instanceof Error ? err.message : 'Sign up failed';
        const status = (err as { status?: number }).status;
        const isRateLimit         = status === 429 || /rate.limit|too.many|security.purposes|over_email/i.test(msg);
        const isAlreadyRegistered = /already.registered|already.in.use|user.already.exists/i.test(msg) || status === 422;

        if (isRateLimit) {
          const m = msg.match(/(\d+)\s*second/);
          const w = m ? parseInt(m[1], 10) : 60;
          setRateLimitCooldown(w);
          setSignupError(`Too many attempts. Please wait ${w}s.`);
          cooldownRef.current = setInterval(() => setRateLimitCooldown(p => {
            if (p <= 1) { clearInterval(cooldownRef.current!); cooldownRef.current = null; setSignupError(''); return 0; }
            return p - 1;
          }), 1000);
          setSigning(false); return;
        } else if (isAlreadyRegistered) {
          try { await signIn(data.email.trim(), data.password); }
          catch (e: unknown) {
            const sm = e instanceof Error ? e.message : '';
            setSignupError(/invalid.login|invalid.password|credentials/i.test(sm)
              ? 'Email already in use with a different password.'
              : 'Account exists. Please use the Log In option.');
            setSigning(false); return;
          }
        } else {
          setSignupError(msg); setSigning(false); return;
        }
      }
    } else {
      // User already authenticated — get their name from the session
      const { data: { user } } = await supabase.auth.getUser();
      trimmedName = user?.user_metadata?.username || user?.user_metadata?.name || trimmedName;
    }

    const player = await initializePlayer(trimmedName);

    await saveProfile({
      playerId: player.id,
      age: data.age,
      gender: data.gender as 'male' | 'female' | 'other',
      heightCm: data.heightCm, weightKg: data.weightKg,
      experienceLevel: data.experienceLevel,
      weeklyFrequency: data.weeklyFrequency,
      primaryGoal: data.primaryGoal,
      preferredDistance: data.preferredDistance,
      distanceUnit: data.distanceUnit,
      notificationsEnabled: data.notificationsEnabled,
      weeklyGoalKm, missionDifficulty,
      onboardingCompletedAt: Date.now(),
    });

    if (data.weightKg > 0) localStorage.setItem('runivo-weight-kg', String(data.weightKg));
    await pushProfile().catch(() => {});

    // Referral
    const inviteRef = sessionStorage.getItem('runivo-invite-ref');
    if (inviteRef) {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (u) {
        try { await supabase.rpc('handle_referral', { p_new_user_id: u.id, p_referrer_username: inviteRef }); }
        catch { /* non-fatal */ }
      }
      sessionStorage.removeItem('runivo-invite-ref');
    }

    // Location (best-effort)
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 }));
      await seedTerritoryData(pos.coords.latitude, pos.coords.longitude);
    } catch { /* optional */ }

    localStorage.setItem('runivo-weekly-goal',         String(weeklyGoalKm));
    localStorage.setItem('runivo-distance-unit',       data.distanceUnit);
    localStorage.setItem('runivo-mission-difficulty',  missionDifficulty);
    localStorage.setItem('runivo-onboarding-complete', 'true');

    soundManager.play('level_up');
    haptic('success');
    setSigning(false);
    onComplete();
  };

  // ── Auth: login
  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPassword) return;
    setLoginLoading(true); setLoginError('');
    try {
      await signIn(loginEmail.trim(), loginPassword);
      localStorage.setItem('runivo-onboarding-complete', 'true');
      haptic('success'); onComplete();
    } catch (e: unknown) {
      setLoginError(e instanceof Error ? e.message : 'Sign in failed.');
    } finally { setLoginLoading(false); }
  };

  // ── Slide variants
  const variants = {
    enter:  (d: number) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:   (d: number) => ({ x: d > 0 ? '-100%' : '100%', opacity: 0 }),
  };
  const tran = { duration: 0.24, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] };

  // ─────────────────────────────────────────────────────────────────────────────
  // ── WELCOME
  // ─────────────────────────────────────────────────────────────────────────────
  if (view === 'welcome') {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: C.bg, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <style>{`
          @keyframes hexFloat     { 0%,100%{transform:translateY(0) rotate(0deg)}  50%{transform:translateY(-18px) rotate(3deg)} }
          @keyframes hexFloatSlow { 0%,100%{transform:translateY(0) rotate(0deg)}  50%{transform:translateY(-10px) rotate(-2deg)} }
        `}</style>

        {/* ── depth layer 1: radial blush (red warmth top-right) */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 75% 55% at 100% 0%, rgba(217,53,24,0.09) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

        {/* ── depth layer 2: grain at 4% */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.04, pointerEvents: 'none', zIndex: 0 }}>
          <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>

        {/* ── depth layer 3: two floating hex accents */}
        <div style={{ position: 'absolute', top: '12%', right: -14, animation: 'hexFloat 6s ease-in-out infinite', pointerEvents: 'none', zIndex: 1 }}>
          <HexMark size={64} color={C.red} fadedOpacity={0.22} />
        </div>
        <div style={{ position: 'absolute', bottom: '22%', left: -10, animation: 'hexFloatSlow 8.5s ease-in-out infinite', pointerEvents: 'none', zIndex: 1 }}>
          <HexMark size={44} color={C.red} fadedOpacity={0.18} />
        </div>

        {/* ── navbar */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <HexMark size={28} color={C.black} fadedOpacity={0.3} />
            <span style={{ fontFamily: FD, fontStyle: 'italic', fontSize: 17, fontWeight: 600, color: C.black, letterSpacing: '0.01em' }}>
              run<span style={{ color: C.red }}>ivo</span>
            </span>
          </div>
          <button onClick={() => { haptic('light'); setView('login'); }} style={{ background: 'none', border: 'none', fontFamily: F, fontSize: 11, fontWeight: 400, color: C.t2, cursor: 'pointer', letterSpacing: '0.04em' }}>
            Sign in
          </button>
        </div>

        {/* ── hero content */}
        <div style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column', padding: '8px 24px 0', overflow: 'hidden' }}>
          {/* heading */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 8, fontFamily: F, fontWeight: 300, color: C.t3, textTransform: 'uppercase' as const, letterSpacing: '0.16em', marginBottom: 8 }}>
              Run · Capture · Conquer
            </div>
            <div style={{ fontFamily: FD, fontStyle: 'italic', fontSize: 30, color: C.black, lineHeight: 1.1 }}>
              Claim your <span style={{ color: C.red }}>city.</span>
            </div>
            <p style={{ fontSize: 12, fontFamily: F, fontWeight: 300, color: C.t2, lineHeight: 1.55, marginTop: 10 }}>
              Run through your neighbourhood.<br />Capture territory. Compete nearby.
            </p>
          </div>

          {/* phone mockup — centered */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PhoneMockup />
          </div>
        </div>

        {/* ── CTAs pinned to bottom */}
        <div style={{ position: 'relative', zIndex: 2, padding: '12px 24px 20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Btn label="Create account" variant="black" onClick={() => { haptic('light'); setView('onboarding'); }} />
            <Btn label="I already have an account" variant="outline" onClick={() => { haptic('light'); setView('login'); }} />
          </div>
          <p style={{ fontSize: 8, fontFamily: F, fontWeight: 300, color: C.t3, textAlign: 'center', marginTop: 12, lineHeight: 1.6 }}>
            By continuing you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ── LOGIN  (sign-in panel — black/gray hex)
  // ─────────────────────────────────────────────────────────────────────────────
  if (view === 'login') {
    const loginOk = emailOk(loginEmail) && loginPassword.length >= 6;
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: C.bg, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* grain */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.04, pointerEvents: 'none' }}>
          <filter id="grain2"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
          <rect width="100%" height="100%" filter="url(#grain2)" />
        </svg>

        {/* 280px ghost watermark — black/gray, 6% */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -60%)', opacity: 0.06, pointerEvents: 'none' }}>
          <HexMark size={280} color={C.black} fadedOpacity={0.28} />
        </div>

        {/* navbar */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px' }}>
          <button onClick={() => setView('welcome')} style={{ background: 'none', border: 'none', fontFamily: F, fontSize: 11, color: C.t2, cursor: 'pointer', padding: 0 }}>
            ← Back
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <HexMark size={22} color={C.black} fadedOpacity={0.3} />
            <span style={{ fontFamily: FD, fontStyle: 'italic', fontSize: 14, fontWeight: 600, color: C.black }}>
              run<span style={{ color: C.red }}>ivo</span>
            </span>
          </div>
        </div>

        {/* form */}
        <div style={{ position: 'relative', zIndex: 2, flex: 1, padding: '24px 24px 0', display: 'flex', flexDirection: 'column' }}>
          {/* eyebrow + inline hex + rule */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 8, fontFamily: F, fontWeight: 300, color: C.t3, textTransform: 'uppercase' as const, letterSpacing: '0.16em', marginBottom: 10 }}>
              Welcome back
            </div>
            <div style={{ height: 1.5, width: 24, background: C.red, borderRadius: 1, marginBottom: 14 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <HexMark size={32} color={C.black} fadedOpacity={0.28} />
              <div style={{ fontFamily: FD, fontStyle: 'italic', fontSize: 26, color: C.black, lineHeight: 1.1 }}>Sign in.</div>
            </div>
          </div>

          <UnderlineField label="Email" value={loginEmail} onChange={setLoginEmail} type="email" placeholder="you@example.com" autoFocus />
          <UnderlineField
            label="Password" value={loginPassword} onChange={setLoginPassword}
            type={showLoginPwd ? 'text' : 'password'} placeholder="••••••••"
            rightEl={
              <button onClick={() => setShowLoginPwd(p => !p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.t3, display: 'flex', padding: 0 }}>
                {showLoginPwd ? <EyeOff size={13} strokeWidth={1.5} /> : <Eye size={13} strokeWidth={1.5} />}
              </button>
            }
          />
          {loginError && <div style={{ fontSize: 9, color: C.red, fontFamily: F, marginTop: 8 }}>{loginError}</div>}
        </div>

        <div style={{ position: 'relative', zIndex: 2, padding: '12px 24px 28px' }}>
          <Btn label={loginLoading ? 'Signing in…' : 'Sign in'} variant={loginOk ? 'black' : 'disabled'} onClick={handleLogin} loading={loginLoading} />
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ── ONBOARDING STEPS
  // ─────────────────────────────────────────────────────────────────────────────

  // ── Ready screen (step 7, no shell)
  if (step === 7) {
    const summaryCards = [
      { label: 'Weekly goal',  val: `${weeklyKmDisplay.toFixed(0)} km` },
      { label: 'Primary goal', val: GOAL_LABELS[data.primaryGoal] ?? data.primaryGoal },
      { label: 'Level',        val: EXP_LABELS[data.experienceLevel] ?? data.experienceLevel },
    ];
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', background: C.bg, alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}
        >
          <div style={{ width: 56, height: 56, borderRadius: '50%', border: `0.5px solid ${C.border}`, background: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Check size={22} color={C.black} strokeWidth={1.5} />
          </div>
          <div style={{ fontSize: 8, fontFamily: F, fontWeight: 300, color: C.t3, textTransform: 'uppercase' as const, letterSpacing: '0.16em', marginBottom: 8 }}>
            You're in
          </div>
          <div style={{ fontFamily: FD, fontStyle: 'italic', fontSize: 22, color: C.black, marginBottom: 8, textAlign: 'center' }}>
            You're ready, {data.username || 'Runner'}.
          </div>
          <p style={{ fontSize: 11, fontFamily: F, fontWeight: 300, color: C.t2, textAlign: 'center', marginBottom: 24, lineHeight: 1.55 }}>
            Your profile is set up. Time to claim some territory.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', marginBottom: 24 }}>
            {summaryCards.map(c => (
              <div key={c.label} style={{ background: C.white, border: `0.5px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontFamily: F, fontWeight: 300, color: C.t2 }}>{c.label}</span>
                <span style={{ fontSize: 13, fontFamily: F, fontWeight: 400, color: C.black }}>{c.val}</span>
              </div>
            ))}
          </div>
          {signupError && (
            <div style={{ fontSize: 9, color: C.red, fontFamily: F, marginBottom: 10, textAlign: 'center' }}>{signupError}</div>
          )}
          {rateLimitCooldown > 0 && (
            <div style={{ fontSize: 9, color: C.t3, fontFamily: F, marginBottom: 10, textAlign: 'center' }}>Retry in {rateLimitCooldown}s</div>
          )}
          <div style={{ width: '100%' }}>
            <Btn label={signing ? 'Setting up…' : 'Start running →'} variant="black" onClick={completeOnboarding} loading={signing} />
          </div>
          <p style={{ fontSize: 8, fontFamily: F, fontWeight: 300, color: C.t3, textAlign: 'center', marginTop: 12 }}>
            You can change all settings later in your profile.
          </p>
        </motion.div>
      </div>
    );
  }

  // ── Steps 1-6 inside AnimatePresence slide
  const pwStrength = data.password.length === 0 ? 0 : data.password.length < 6 ? 1 : data.password.length < 10 ? 2 : 3;
  const pwColor = pwStrength === 1 ? C.red : pwStrength === 2 ? '#D4870A' : '#1A6B40';

  const stepNode = (() => {
    switch (step) {
      // ── Step 1: Account ──────────────────────────────────────────────────────
      case 1:
        return (
          <StepShell
            step={1}
            cta={<Btn label="Continue" variant={canContinue() ? 'red' : 'disabled'} onClick={next} />}
          >
            {/* eyebrow + red rule + inline red/pink hex */}
            <div style={{ marginBottom: 18 }}>
              <Eyebrow text="Your identity" />
              <div style={{ height: 1.5, width: 24, background: C.red, borderRadius: 1, marginBottom: 12 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <HexMark size={32} color={C.red} fadedOpacity={0.25} />
                <div style={{ fontFamily: FD, fontStyle: 'italic', fontSize: 22, color: C.black, lineHeight: 1.2 }}>Create your account.</div>
              </div>
              <div style={{ fontSize: 11, fontFamily: F, fontWeight: 300, color: C.t2, marginTop: 6, lineHeight: 1.5 }}>
                Choose a username that will show on the leaderboard.
              </div>
            </div>

            <UnderlineField
              label="Username" value={data.username} autoFocus
              onChange={v => { update('username', v); }}
              placeholder="e.g. marcus_runs" maxLen={20}
              error={emailError /* reused for username error display */}
              rightEl={
                <span style={{ fontSize: 9, fontFamily: F, fontWeight: 300, color: C.t3 }}>
                  {data.username.length}/20
                </span>
              }
            />
            <UnderlineField
              label="Email" value={data.email} type="email"
              onChange={v => { update('email', v); setEmailError(''); }}
              placeholder="you@example.com"
              error={data.email && !emailOk(data.email) ? 'Please enter a valid email' : ''}
            />
            <UnderlineField
              label="Password" value={data.password}
              onChange={v => update('password', v)}
              type={showPassword ? 'text' : 'password'} placeholder="Min. 8 characters"
              rightEl={
                <button onClick={() => setShowPassword(p => !p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.t3, display: 'flex', padding: 0 }}>
                  {showPassword ? <EyeOff size={13} strokeWidth={1.5} /> : <Eye size={13} strokeWidth={1.5} />}
                </button>
              }
            />
            {/* Password strength */}
            {data.password.length > 0 && (
              <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{ flex: 1, height: 2, borderRadius: 1, background: i <= pwStrength ? pwColor : C.mid, transition: 'background 0.2s' }} />
                ))}
              </div>
            )}
            {signupError && (
              <div style={{ fontSize: 9, color: C.red, marginTop: 8, fontFamily: F }}>{signupError}</div>
            )}
          </StepShell>
        );

      // ── Step 2: Body Stats ────────────────────────────────────────────────────
      case 2:
        return (
          <StepShell
            step={2}
            cta={<Btn label="Continue" variant={canContinue() ? 'red' : 'disabled'} onClick={next} />}
          >
            <Eyebrow text="Your body" />
            <HeroTitle>Body stats.</HeroTitle>
            <Subtitle text="Used for accurate pace and calorie estimates." />

            {/* Gender — segmented pill */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 8, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: C.t3, fontFamily: F, marginBottom: 8 }}>Gender</div>
              <div style={{ display: 'flex', background: C.stone, borderRadius: 8, padding: 3, gap: 3 }}>
                {(['male', 'female', 'other'] as const).map(g => {
                  const sel = data.gender === g;
                  return (
                    <button
                      key={g} onClick={() => { update('gender', g); haptic('light'); }}
                      style={{
                        flex: 1, padding: '9px 0', borderRadius: 6,
                        border: 'none',
                        background: sel ? C.black : 'transparent',
                        color: sel ? '#fff' : C.t3,
                        fontFamily: F, fontSize: 11, fontWeight: sel ? 400 : 300,
                        cursor: 'pointer', textTransform: 'capitalize' as const,
                        transition: 'background 0.15s, color 0.15s',
                        boxShadow: sel ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                      }}
                    >{g}</button>
                  );
                })}
              </div>
            </div>

            {/* Stat rows — 2-column grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              {/* Age */}
              <div
                onClick={() => setPicker('age')}
                style={{ background: C.white, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer' }}
              >
                <div style={{ fontSize: 8, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: C.t3, fontFamily: F, marginBottom: 6 }}>Age</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                  <span style={{ fontSize: 32, fontFamily: F, fontWeight: 200, color: C.black, letterSpacing: '-0.03em', lineHeight: 1 }}>{data.age}</span>
                  <span style={{ fontSize: 11, fontFamily: F, fontWeight: 300, color: C.t3 }}>yrs</span>
                </div>
              </div>

              {/* Weight */}
              <div
                onClick={() => setPicker('weight')}
                style={{ background: C.white, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer' }}
              >
                <div style={{ fontSize: 8, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: C.t3, fontFamily: F, marginBottom: 6 }}>Weight</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                  <span style={{ fontSize: 32, fontFamily: F, fontWeight: 200, color: C.black, letterSpacing: '-0.03em', lineHeight: 1 }}>{data.weightKg}</span>
                  <span style={{ fontSize: 11, fontFamily: F, fontWeight: 300, color: C.t3 }}>kg</span>
                </div>
              </div>
            </div>

            {/* Height — full width */}
            <div
              onClick={() => setPicker('height')}
              style={{ background: C.white, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div>
                <div style={{ fontSize: 8, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: C.t3, fontFamily: F, marginBottom: 6 }}>Height</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                  <span style={{ fontSize: 32, fontFamily: F, fontWeight: 200, color: C.black, letterSpacing: '-0.03em', lineHeight: 1 }}>
                    {useImperial ? cmToFtIn(data.heightCm) : data.heightCm}
                  </span>
                  {!useImperial && <span style={{ fontSize: 11, fontFamily: F, fontWeight: 300, color: C.t3 }}>cm</span>}
                </div>
              </div>
              <button
                onClick={e => { e.stopPropagation(); setUseImperial(p => !p); }}
                style={{ fontSize: 9, color: C.red, background: C.redLo, border: `0.5px solid rgba(217,53,24,0.2)`, borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontFamily: F }}
              >
                {useImperial ? 'cm' : 'ft / in'}
              </button>
            </div>

            {/* Pickers */}
            {picker === 'age' && (
              <DrumPicker title="Age" values={AGES} value={data.age} unit="yrs"
                onSelect={v => update('age', v)} onClose={() => setPicker(null)} />
            )}
            {picker === 'height' && (
              <DrumPicker title="Height" values={HEIGHTS} value={data.heightCm} unit="cm"
                onSelect={v => update('heightCm', v)} onClose={() => setPicker(null)} />
            )}
            {picker === 'weight' && (
              <DrumPicker title="Weight" values={WEIGHTS} value={data.weightKg} unit="kg"
                onSelect={v => update('weightKg', v)} onClose={() => setPicker(null)} />
            )}
          </StepShell>
        );

      // ── Step 3: Experience ────────────────────────────────────────────────────
      case 3:
        return (
          <StepShell step={3} cta={<Btn label="Continue" variant="red" onClick={next} />}>
            <Eyebrow text="Your level" />
            <HeroTitle>How do you run?</HeroTitle>
            <Subtitle text="We'll tailor missions and training to match." />

            {EXP_OPTIONS.map(opt => {
              const sel = data.experienceLevel === opt.key;
              return (
                <div
                  key={opt.key}
                  onClick={() => { update('experienceLevel', opt.key); haptic('light'); }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: `0.5px solid ${C.mid}`, cursor: 'pointer' }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontFamily: F, fontWeight: sel ? 400 : 300, color: sel ? C.black : C.t2 }}>{opt.label}</div>
                    <div style={{ fontSize: 10, fontFamily: F, fontWeight: 300, color: C.t3, marginTop: 2 }}>{opt.sub}</div>
                  </div>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    border: `0.5px solid ${sel ? C.black : C.border}`,
                    background: sel ? C.black : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {sel && <Check size={8} color="#fff" strokeWidth={2.5} />}
                  </div>
                </div>
              );
            })}
          </StepShell>
        );

      // ── Step 4: Goal ──────────────────────────────────────────────────────────
      case 4:
        return (
          <StepShell step={4} cta={<Btn label="Continue" variant="red" onClick={next} />}>
            <Eyebrow text="Your mission" />
            <HeroTitle>What's your main goal?</HeroTitle>
            <Subtitle text="This shapes your missions and weekly targets." />

            {GOAL_OPTIONS.map(opt => {
              const sel = data.primaryGoal === opt.key;
              return (
                <div
                  key={opt.key}
                  onClick={() => { update('primaryGoal', opt.key); haptic('light'); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: `0.5px solid ${C.mid}`, cursor: 'pointer' }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: sel ? C.redLo : C.stone,
                    border: `0.5px solid ${sel ? 'rgba(217,53,24,0.3)' : C.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: sel ? C.red : C.t2,
                  }}>
                    {opt.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontFamily: F, fontWeight: sel ? 400 : 300, color: sel ? C.black : C.t2 }}>{opt.label}</div>
                    <div style={{ fontSize: 10, fontFamily: F, fontWeight: 300, color: C.t3, marginTop: 1 }}>{opt.sub}</div>
                  </div>
                </div>
              );
            })}
          </StepShell>
        );

      // ── Step 5: Weekly Schedule ───────────────────────────────────────────────
      case 5:
        return (
          <StepShell step={5} cta={<Btn label="Continue" variant="red" onClick={next} />}>
            <Eyebrow text="Your rhythm" />
            <HeroTitle>Set your weekly plan.</HeroTitle>
            <Subtitle text="Pick your run days and typical distance." />

            {/* Day tiles */}
            <div style={{ display: 'flex', gap: 5, marginBottom: 20 }}>
              {(['Mo','Tu','We','Th','Fr','Sa','Su'] as const).map((d, i) => {
                const sel     = selectedDays.includes(i);
                const isToday = i === todayIdx;
                return (
                  <button
                    key={i} onClick={() => toggleDay(i)}
                    style={{
                      flex: 1, padding: '10px 0',
                      borderRadius: 10,
                      border: `0.5px solid ${isToday && !sel ? C.red : sel ? C.black : C.border}`,
                      background: sel ? C.black : isToday ? C.redLo : 'transparent',
                      cursor: 'pointer',
                      display: 'flex', flexDirection: 'column' as const,
                      alignItems: 'center', gap: 2,
                      transition: 'background 0.15s, border-color 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 11, fontFamily: F, fontWeight: sel ? 500 : 300, color: sel ? '#fff' : isToday ? C.red : C.t3, lineHeight: 1 }}>{d[0]}</span>
                    <span style={{ fontSize: 8, fontFamily: F, fontWeight: 300, color: sel ? 'rgba(255,255,255,0.5)' : isToday ? C.red : C.border, letterSpacing: '0.02em' }}>{d[1]}</span>
                  </button>
                );
              })}
            </div>

            {/* Distance cards — 2×2 grid */}
            <div style={{ fontSize: 8, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: C.t3, fontFamily: F, marginBottom: 8 }}>Typical run distance</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 20 }}>
              {DIST_CHIPS.map(c => {
                const sel = data.preferredDistance === c.key;
                const sub = c.key === 'short' ? 'Short' : c.key === '5k' ? 'Medium' : c.key === '10k' ? 'Long' : 'Epic';
                return (
                  <button
                    key={c.key} onClick={() => { update('preferredDistance', c.key); haptic('light'); }}
                    style={{
                      padding: '14px 16px', borderRadius: 12, textAlign: 'left' as const,
                      border: `0.5px solid ${sel ? C.black : C.border}`,
                      background: sel ? C.black : C.white,
                      cursor: 'pointer',
                      transition: 'background 0.15s, border-color 0.15s',
                    }}
                  >
                    <div style={{ fontSize: 15, fontFamily: F, fontWeight: 300, color: sel ? '#fff' : C.black, letterSpacing: '-0.01em', marginBottom: 2 }}>{c.label}</div>
                    <div style={{ fontSize: 9, fontFamily: F, fontWeight: 300, color: sel ? 'rgba(255,255,255,0.45)' : C.t3, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>{sub}</div>
                  </button>
                );
              })}
            </div>

            {/* Live summary */}
            <div style={{
              background: C.white, border: `0.5px solid ${C.border}`, borderRadius: 12,
              padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: 8, textTransform: 'uppercase' as const, letterSpacing: '0.12em', color: C.t3, fontFamily: F, marginBottom: 4 }}>Weekly goal</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 32, fontFamily: F, fontWeight: 200, color: C.black, letterSpacing: '-0.03em', lineHeight: 1 }}>{weeklyKmDisplay.toFixed(0)}</span>
                  <span style={{ fontSize: 11, fontFamily: F, fontWeight: 300, color: C.t3 }}>km / week</span>
                </div>
              </div>
              <span style={{ fontSize: 10, fontFamily: F, fontWeight: 300, color: C.t3, textAlign: 'right' as const, lineHeight: 1.5 }}>
                {selectedDays.length} run{selectedDays.length !== 1 ? 's' : ''}<br />
                ~{DIST_CHIPS.find(d => d.key === data.preferredDistance)?.label} each
              </span>
            </div>
          </StepShell>
        );

      // ── Step 6: Plan Selection ────────────────────────────────────────────────
      case 6:
        return (
          <StepShell step={6} cta={<div />}>
            <Eyebrow text="Your plan" />
            <HeroTitle>Choose your plan.</HeroTitle>
            <Subtitle text="Territory capture is the heart of Runivo." />

            {/* Premium card */}
            <div style={{ border: `0.5px solid ${C.red}`, borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ background: C.red, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontFamily: F, fontWeight: 500, color: '#fff' }}>Premium</span>
                  <span style={{ fontSize: 7, fontFamily: F, fontWeight: 400, color: '#fff', letterSpacing: '0.12em', textTransform: 'uppercase' as const, background: 'rgba(255,255,255,0.25)', padding: '2px 7px', borderRadius: 2 }}>
                    Most popular
                  </span>
                </div>
                <div style={{ fontSize: 18, fontFamily: F, fontWeight: 300, color: '#fff' }}>
                  $4.99 <span style={{ fontSize: 10 }}>/ month</span>
                </div>
              </div>
              <div style={{ padding: '12px 14px', background: C.white }}>
                {['Territory capture & map', 'AI-powered coaching', 'Unlimited run history', 'Priority leaderboard'].map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: C.redLo, border: `0.5px solid rgba(217,53,24,0.3)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Check size={7} color={C.red} strokeWidth={2.5} />
                    </div>
                    <span style={{ fontSize: 11, fontFamily: F, fontWeight: 300, color: C.t2 }}>{f}</span>
                  </div>
                ))}
                <button
                  onClick={() => { update('plan', 'premium'); haptic('medium'); next(); }}
                  style={{
                    width: '100%', padding: '11px 0', marginTop: 4, borderRadius: 4,
                    background: 'transparent', border: `0.5px solid ${C.red}`,
                    color: C.red, fontFamily: F, fontSize: 11, fontWeight: 500,
                    textTransform: 'uppercase' as const, letterSpacing: '0.06em', cursor: 'pointer',
                  }}
                >
                  Start Premium →
                </button>
              </div>
            </div>

            {/* Free card */}
            <div style={{ border: `0.5px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ background: C.stone, padding: '12px 14px' }}>
                <div style={{ fontSize: 12, fontFamily: F, fontWeight: 400, color: C.black, marginBottom: 4 }}>Free</div>
                <div style={{ fontSize: 16, fontFamily: F, fontWeight: 300, color: C.black }}>
                  $0 <span style={{ fontSize: 10, color: C.t2 }}>/ month</span>
                </div>
              </div>
              <div style={{ padding: '12px 14px', background: C.white }}>
                {[
                  { ok: false, label: 'Territory capture' },
                  { ok: true,  label: 'Basic run tracking' },
                ].map(f => (
                  <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%',
                      background: f.ok ? C.stone : C.mid,
                      border: `0.5px solid ${C.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {f.ok
                        ? <Check size={7} color={C.t2} strokeWidth={2.5} />
                        : <span style={{ fontSize: 8, color: C.t3, fontWeight: 500, lineHeight: 1 }}>✕</span>
                      }
                    </div>
                    <span style={{ fontSize: 11, fontFamily: F, fontWeight: 300, color: f.ok ? C.t2 : C.t3 }}>{f.label}</span>
                  </div>
                ))}
                <button
                  onClick={() => { haptic('light'); setShowFreeConfirm(true); }}
                  style={{
                    width: '100%', padding: '9px 0', marginTop: 4, borderRadius: 4,
                    background: 'transparent', border: `0.5px solid ${C.border}`,
                    color: C.black, fontFamily: F, fontSize: 11, fontWeight: 400,
                    textTransform: 'uppercase' as const, letterSpacing: '0.05em', cursor: 'pointer',
                  }}
                >
                  Continue free
                </button>
              </div>
            </div>

            {/* Free confirmation bottom sheet */}
            {showFreeConfirm && (
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(10,10,10,0.4)', display: 'flex', alignItems: 'flex-end' }}
                onClick={() => setShowFreeConfirm(false)}
              >
                <div
                  onClick={e => e.stopPropagation()}
                  style={{ width: '100%', background: C.white, borderRadius: '12px 12px 0 0', padding: '20px 20px 32px' }}
                >
                  <p style={{ fontFamily: FD, fontStyle: 'italic', fontSize: 15, color: C.black, marginBottom: 6 }}>
                    Territory capture won't be available
                  </p>
                  <p style={{ fontSize: 11, fontFamily: F, fontWeight: 300, color: C.t2, marginBottom: 20, lineHeight: 1.5 }}>
                    You can upgrade at any time from Settings to unlock the map.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Btn label="Continue with free" variant="black" onClick={() => { update('plan', 'free'); setShowFreeConfirm(false); haptic('light'); next(); }} />
                    <Btn label="See Premium" variant="outline" onClick={() => setShowFreeConfirm(false)} />
                  </div>
                </div>
              </div>
            )}
          </StepShell>
        );

      default:
        return null;
    }
  })();

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: C.bg, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          variants={variants}
          initial="enter" animate="center" exit="exit"
          transition={tran}
          style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}
        >
          {stepNode}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
