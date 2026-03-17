import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Eye, EyeOff, MapPin } from 'lucide-react';
import { haptic } from '@shared/lib/haptics';
import { RunivoLogo } from '@shared/ui/RunivoLogo';
import { initializePlayer } from '@shared/services/store';
import { seedTerritoryData } from '@shared/services/seedData';
import { soundManager } from '@shared/audio/sounds';
import { saveProfile, computeWeeklyGoal } from '@shared/services/profile';
import { signUp, signIn } from '@shared/services/auth';
import { pushProfile } from '@shared/services/sync';
import { supabase } from '@shared/services/supabase';
import OnboardingProgress from '../components/ProgressBar';
import ExperienceStep from '../components/steps/ExperienceStep';
import GoalStep from '../components/steps/GoalStep';
import WeeklyPlanStep from '../components/steps/WeeklyPlanStep';
import BiometricsStep from '../components/steps/BiometricsStep';
import PreferencesStep from '../components/steps/PreferencesStep';

// ── Design tokens ────────────────────────────────────────────────────────────
const F   = "'Barlow', 'DM Sans', -apple-system, sans-serif";
const FD  = "'Playfair Display', Georgia, serif";
const RED     = '#D93518';
const RED_BG  = '#FEF0EE';
const RED_BD  = '#F0C0B8';
const SURFACE = '#F8F6F3';
const HAIR    = '#E8E4DF';
const BORDER  = '#DDD9D4';
const INK     = '#0A0A0A';
const MID     = '#6B6B6B';
const MUTED   = '#ADADAD';
const _GREEN    = '#1A6B40';
const _GREEN_BG = '#EDF7F2';
const _GREEN_BD = '#8FD4B0';
const _AMBER_BG = '#FDF6E8';
const _WARM     = '#F0EDE8';
void _GREEN; void _GREEN_BG; void _GREEN_BD; void _AMBER_BG; void _WARM;

// ── Shared primitives ────────────────────────────────────────────────────────

function PrimaryBtn({
  label,
  onClick,
  disabled = false,
  loading = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        width: '100%',
        padding: '13px 0',
        borderRadius: 4,
        background: disabled || loading ? HAIR : RED,
        color: disabled || loading ? MUTED : '#fff',
        fontFamily: F,
        fontSize: 12,
        fontWeight: 500,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.06em',
        border: 'none',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        transition: 'background 0.2s',
      }}
    >
      {loading && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{
            width: 14,
            height: 14,
            border: '2px solid rgba(255,255,255,0.35)',
            borderTopColor: '#fff',
            borderRadius: '50%',
          }}
        />
      )}
      {label}
    </button>
  );
}

function OutlinedBtn({
  label,
  onClick,
  small = false,
}: {
  label: string;
  onClick: () => void;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        padding: small ? '9px 0' : '13px 0',
        borderRadius: 4,
        background: 'transparent',
        border: `0.5px solid ${BORDER}`,
        color: INK,
        fontFamily: F,
        fontSize: small ? 10 : 12,
        fontWeight: 400,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  type = 'text',
  error = '',
  autoFocus = false,
  maxLen,
  rightEl,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  error?: string;
  autoFocus?: boolean;
  maxLen?: number;
  rightEl?: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          fontSize: 9,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.1em',
          color: MUTED,
          fontFamily: F,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          height: 34,
          border: `0.5px solid ${error ? RED_BD : BORDER}`,
          borderRadius: 4,
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          maxLength={maxLen}
          style={{
            flex: 1,
            height: '100%',
            padding: '0 10px',
            fontSize: 11,
            fontFamily: F,
            color: INK,
            background: 'transparent',
            border: 'none',
            outline: 'none',
          }}
        />
        {rightEl}
      </div>
      {error && (
        <div style={{ fontSize: 9, color: RED, marginTop: 3, fontFamily: F }}>
          {error}
        </div>
      )}
    </div>
  );
}

// ── Types ────────────────────────────────────────────────────────────────────

interface OnboardingData {
  username: string;
  email: string;
  password: string;
  age: number;
  gender: 'male' | 'female' | 'other' | '';
  heightCm: number;
  weightKg: number;
  experienceLevel: 'new' | 'casual' | 'regular' | 'competitive';
  primaryGoal: 'get_fit' | 'lose_weight' | 'run_faster' | 'explore' | 'compete';
  weeklyFrequency: number;
  preferredDistance: 'short' | '5k' | '10k' | 'long';
  distanceUnit: 'km' | 'mi';
  notificationsEnabled: boolean;
}

// Step map:
// 1 Account | 2 Biometrics | 3 Experience | 4 Goal | 5 Weekly | 6 Location | 7 Preferences | 8 Ready
const STEP_COUNT = 9;

const GOAL_LABELS: Record<string, string> = {
  get_fit:     'Get Fit',
  lose_weight: 'Lose Weight',
  run_faster:  'Run Faster',
  explore:     'Explore',
  compete:     'Compete',
};

type FlowView = 'welcome' | 'onboarding' | 'login';

// ── Main component ────────────────────────────────────────────────────────────

export function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const [view, setView]                   = useState<FlowView>('welcome');
  const [step, setStep]                   = useState(1);
  const [direction, setDirection]         = useState(1);
  const [locationGranted, setLocationGranted] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [seeding, setSeeding]             = useState(false);
  const [signing, setSigning]             = useState(false);
  const [signupError, setSignupError]     = useState('');
  const [showPassword, setShowPassword]   = useState(false);
  const [rateLimitCooldown, setRateLimitCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Login-specific state
  const [loginEmail, setLoginEmail]               = useState('');
  const [loginPassword, setLoginPassword]         = useState('');
  const [loginError, setLoginError]               = useState('');
  const [loginLoading, setLoginLoading]           = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const [data, setData] = useState<OnboardingData>({
    username: '',
    email: '',
    password: '',
    age: 0,
    gender: '',
    heightCm: 0,
    weightKg: 0,
    experienceLevel: 'casual',
    primaryGoal: 'get_fit',
    weeklyFrequency: 3,
    preferredDistance: '5k',
    distanceUnit: 'km',
    notificationsEnabled: true,
  });

  const weeklyGoalKm = computeWeeklyGoal(data.weeklyFrequency, data.preferredDistance);

  const goTo = useCallback(
    (next: number) => {
      setDirection(next > step ? 1 : -1);
      haptic('light');
      setStep(next);
    },
    [step],
  );

  const next = useCallback(() => goTo(step + 1), [goTo, step]);
  const back = useCallback(() => {
    if (step === 1) {
      setView('welcome');
      return;
    }
    goTo(step - 1);
  }, [goTo, step]);

  const update = <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const canGoNext = (): boolean => {
    if (step === 1) {
      const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim());
      return data.username.trim().length >= 3 && emailValid && data.password.length >= 8;
    }
    if (step === 2) {
      return data.age > 0 && data.gender !== '' && data.heightCm >= 100 && data.weightKg > 0;
    }
    return true;
  };

  const requestLocation = async () => {
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      if (result.state === 'granted') {
        setLocationGranted(true);
        return true;
      }
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });
      setLocationGranted(true);
      setSeeding(true);
      await seedTerritoryData(position.coords.latitude, position.coords.longitude);
      setSeeding(false);
      return true;
    } catch (err: unknown) {
      setLocationError(
        (err as GeolocationPositionError)?.code === 1
          ? 'Location access denied. You can enable it in Settings later.'
          : 'Could not get your location. Please try again.',
      );
      return false;
    }
  };

  const completeOnboarding = async () => {
    setSigning(true);
    setSignupError('');

    const trimmedName = data.username.trim() || 'Runner';
    const missionDifficulty =
      data.experienceLevel === 'new'
        ? 'easy'
        : data.experienceLevel === 'competitive'
        ? 'hard'
        : 'mixed';

    try {
      await signUp(data.email.trim(), data.password, trimmedName);
    } catch (err: unknown) {
      const msg    = err instanceof Error ? err.message : 'Sign up failed';
      const status = (err as { status?: number }).status;
      const isRateLimit =
        status === 429 || /rate.limit|too.many|security.purposes|over_email/i.test(msg);
      const isAlreadyRegistered =
        /already.registered|already.in.use|user.already.exists/i.test(msg) || status === 422;

      if (isRateLimit) {
        const secondsMatch = msg.match(/(\d+)\s*second/);
        const waitSecs     = secondsMatch ? parseInt(secondsMatch[1], 10) : 60;
        setRateLimitCooldown(waitSecs);
        setSignupError(`Too many signup attempts. Please wait ${waitSecs}s.`);
        cooldownRef.current = setInterval(() => {
          setRateLimitCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(cooldownRef.current!);
              cooldownRef.current = null;
              setSignupError('');
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        setSigning(false);
        return;
      } else if (isAlreadyRegistered) {
        try {
          await signIn(data.email.trim(), data.password);
          // Fall through to profile init below
        } catch (signInErr: unknown) {
          const signInMsg = signInErr instanceof Error ? signInErr.message : '';
          setSignupError(
            /invalid.login|invalid.password|credentials/i.test(signInMsg)
              ? 'Email already in use with a different password.'
              : 'Account exists. Please use the Log In tab.',
          );
          setSigning(false);
          return;
        }
      } else {
        setSignupError(msg);
        setSigning(false);
        return;
      }
    }

    const player = await initializePlayer(trimmedName);

    await saveProfile({
      playerId: player.id,
      age: data.age,
      gender: data.gender as 'male' | 'female' | 'other',
      heightCm: data.heightCm,
      weightKg: data.weightKg,
      experienceLevel: data.experienceLevel,
      weeklyFrequency: data.weeklyFrequency,
      primaryGoal: data.primaryGoal,
      preferredDistance: data.preferredDistance,
      distanceUnit: data.distanceUnit,
      notificationsEnabled: data.notificationsEnabled,
      weeklyGoalKm,
      missionDifficulty,
      onboardingCompletedAt: Date.now(),
    });

    if (data.weightKg > 0) {
      localStorage.setItem('runivo-weight-kg', String(data.weightKg));
    }

    await pushProfile().catch(() => {});

    const inviteRef = sessionStorage.getItem('runivo-invite-ref');
    if (inviteRef) {
      const {
        data: { user: newUser },
      } = await supabase.auth.getUser();
      if (newUser) {
        try {
          await supabase.rpc('handle_referral', {
            p_new_user_id:       newUser.id,
            p_referrer_username: inviteRef,
          });
        } catch {
          /* non-fatal */
        }
      }
      sessionStorage.removeItem('runivo-invite-ref');
    }

    localStorage.setItem('runivo-weekly-goal',          String(weeklyGoalKm));
    localStorage.setItem('runivo-distance-unit',        data.distanceUnit);
    localStorage.setItem('runivo-mission-difficulty',   missionDifficulty);
    localStorage.setItem('runivo-onboarding-complete',  'true');

    soundManager.play('level_up');
    haptic('success');
    setSigning(false);
    onComplete();
  };

  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPassword) return;
    setLoginLoading(true);
    setLoginError('');
    try {
      await signIn(loginEmail.trim(), loginPassword);
      localStorage.setItem('runivo-onboarding-complete', 'true');
      haptic('success');
      onComplete();
    } catch (err: unknown) {
      setLoginError(
        err instanceof Error ? err.message : 'Sign in failed. Check your credentials.',
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const slideVariants = {
    enter:  (d: number) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:   (d: number) => ({ x: d > 0 ? '-100%' : '100%', opacity: 0 }),
  };

  // ── WELCOME ────────────────────────────────────────────────────────────────
  if (view === 'welcome') {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: SURFACE,
        }}
      >
        <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }`}</style>

        {/* Hero panel — top 56% */}
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            flexShrink: 0,
            flex: '0 0 56%',
            background:
              'linear-gradient(170deg,#5B21B6 0%,#7C3AED 28%,#A855F7 50%,#C2410C 72%,#D93518 100%)',
          }}
        >
          {/* Center content */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              animation: 'fadeUp 0.55s ease-out both',
            }}
          >
            <RunivoLogo size={48} animate onDark />

            <div
              style={{
                fontFamily: FD,
                fontStyle: 'italic',
                fontSize: 28,
                color: 'rgba(255,255,255,0.9)',
                letterSpacing: '0.01em',
              }}
            >
              run<span style={{ color: '#FF7B5C' }}>ivo</span>
            </div>

            <p
              style={{
                fontSize: 9,
                textTransform: 'uppercase' as const,
                letterSpacing: '0.14em',
                color: 'rgba(255,255,255,0.6)',
                fontFamily: F,
                margin: 0,
              }}
            >
              Run · Capture · Conquer
            </p>

            {/* Feature chips */}
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {(['Territory', 'Leaderboard', 'Clubs'] as const).map((label, i) => (
                <span
                  key={label}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 20,
                    background: 'rgba(255,255,255,0.12)',
                    border: '0.5px solid rgba(255,255,255,0.20)',
                    fontSize: 9,
                    color: 'rgba(255,255,255,0.8)',
                    fontFamily: F,
                    animation: `fadeUp 0.55s ${300 + i * 80}ms ease-out both`,
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Static bottom wave */}
          <svg
            viewBox="0 0 430 28"
            preserveAspectRatio="none"
            style={{
              position: 'absolute',
              bottom: -1,
              left: 0,
              width: '100%',
              display: 'block',
            }}
          >
            <path d="M0,28 C120,0 310,0 430,28 L430,28 L0,28 Z" fill={SURFACE} />
          </svg>
        </div>

        {/* Body panel */}
        <div
          style={{
            flex: 1,
            background: '#ffffff',
            padding: '20px 20px 24px',
            display: 'flex',
            flexDirection: 'column',
            paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
          }}
        >
          <p
            style={{
              fontFamily: FD,
              fontStyle: 'italic',
              fontSize: 18,
              color: INK,
              marginBottom: 4,
              margin: '0 0 4px 0',
            }}
          >
            Claim your city.
          </p>
          <p
            style={{
              fontFamily: F,
              fontWeight: 300,
              fontSize: 10,
              color: MID,
              lineHeight: 1.5,
              marginBottom: 20,
              margin: '0 0 20px 0',
            }}
          >
            Build your running legacy. Conquer territories, climb leaderboards, dominate your
            streets.
          </p>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              marginTop: 'auto',
            }}
          >
            <PrimaryBtn
              label="Create account"
              onClick={() => {
                setView('onboarding');
                setStep(1);
                haptic('light');
              }}
            />
            <OutlinedBtn
              label="Log in"
              onClick={() => {
                setView('login');
                haptic('light');
              }}
            />
          </div>

          <p
            style={{
              fontSize: 9,
              fontWeight: 300,
              color: MUTED,
              textAlign: 'center',
              marginTop: 12,
              fontFamily: F,
            }}
          >
            By continuing you agree to our Terms &amp; Privacy Policy
          </p>
        </div>
      </div>
    );
  }

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  if (view === 'login') {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
        }}
      >
        {/* Back button */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            paddingTop: 'max(16px, env(safe-area-inset-top))',
          }}
        >
          <button
            onClick={() => {
              setView('welcome');
              haptic('light');
            }}
            style={{
              background: 'none',
              border: 'none',
              padding: 4,
              marginLeft: -4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: MUTED,
            }}
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        {/* Centered content */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0 24px',
            overflowY: 'auto',
          }}
        >
          <p
            style={{
              fontFamily: FD,
              fontStyle: 'italic',
              fontSize: 24,
              color: INK,
              textAlign: 'center',
              marginBottom: 20,
            }}
          >
            Welcome back
          </p>

          <FieldInput
            label="Email"
            value={loginEmail}
            onChange={setLoginEmail}
            type="email"
            autoFocus
          />

          <FieldInput
            label="Password"
            value={loginPassword}
            onChange={setLoginPassword}
            type={showLoginPassword ? 'text' : 'password'}
            rightEl={
              <button
                type="button"
                onClick={() => setShowLoginPassword((p) => !p)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '0 10px',
                  cursor: 'pointer',
                  color: MUTED,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showLoginPassword ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            }
          />

          {loginError && (
            <div
              style={{
                background: RED_BG,
                border: `0.5px solid ${RED_BD}`,
                borderRadius: 4,
                padding: '8px 12px',
                marginBottom: 10,
              }}
            >
              <p style={{ fontSize: 10, color: RED, fontFamily: F, margin: 0 }}>{loginError}</p>
            </div>
          )}

          <div style={{ marginTop: 4 }}>
            <PrimaryBtn
              label="Sign In"
              onClick={handleLogin}
              disabled={!loginEmail.trim() || !loginPassword}
              loading={loginLoading}
            />
          </div>

          <p
            style={{
              fontSize: 10,
              color: MID,
              textAlign: 'center',
              marginTop: 16,
              fontFamily: F,
            }}
          >
            Don&apos;t have an account?{' '}
            <button
              onClick={() => {
                setView('onboarding');
                setStep(1);
                haptic('light');
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                color: RED,
                fontFamily: F,
                fontSize: 10,
                fontWeight: 500,
              }}
            >
              Sign up
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ── ONBOARDING FLOW ────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: SURFACE,
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Step header */}
      <div
        style={{
          flexShrink: 0,
          paddingTop: 'max(12px, env(safe-area-inset-top))',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            marginBottom: 8,
          }}
        >
          {step > 0 && step < STEP_COUNT - 1 ? (
            <button
              onClick={back}
              style={{
                background: 'none',
                border: 'none',
                padding: 4,
                marginLeft: -4,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: MUTED,
              }}
            >
              <ChevronLeft size={20} />
            </button>
          ) : (
            <div style={{ width: 28 }} />
          )}
          <div style={{ flex: 1, margin: '0 8px' }}>
            <OnboardingProgress currentStep={step} />
          </div>
          <div style={{ width: 28 }} />
        </div>
      </div>

      {/* Step content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <AnimatePresence mode="wait" custom={direction}>

          {/* ── 1: Create Account ─────────────────────────────────────── */}
          {step === 1 && (
            <motion.div
              key="account"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeOut' }}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 24px',
                overflowY: 'auto',
              }}
            >
              <div style={{ width: '100%', maxWidth: 360, paddingTop: 16, paddingBottom: 16 }}>
                <p
                  style={{
                    fontFamily: FD,
                    fontStyle: 'italic',
                    fontSize: 22,
                    color: INK,
                    marginBottom: 4,
                  }}
                >
                  Create your account
                </p>
                <p
                  style={{
                    fontFamily: F,
                    fontSize: 11,
                    color: MID,
                    marginBottom: 20,
                    fontWeight: 300,
                  }}
                >
                  Join thousands of runners conquering their cities
                </p>

                <FieldInput
                  label="Username"
                  value={data.username}
                  onChange={(v) => update('username', v.slice(0, 20))}
                  autoFocus
                  maxLen={20}
                  error={
                    data.username.length > 0 && data.username.trim().length < 3
                      ? 'Min 3 characters'
                      : ''
                  }
                />

                <FieldInput
                  label="Email"
                  value={data.email}
                  onChange={(v) => update('email', v)}
                  type="email"
                  error={
                    data.email.length > 0 &&
                    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())
                      ? 'Enter a valid email'
                      : ''
                  }
                />

                <FieldInput
                  label="Password"
                  value={data.password}
                  onChange={(v) => update('password', v)}
                  type={showPassword ? 'text' : 'password'}
                  error={
                    data.password.length > 0 && data.password.length < 8
                      ? 'Min 8 characters'
                      : ''
                  }
                  rightEl={
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '0 10px',
                        cursor: 'pointer',
                        color: MUTED,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  }
                />

                {signupError && (
                  <div
                    style={{
                      background: RED_BG,
                      border: `0.5px solid ${RED_BD}`,
                      borderRadius: 4,
                      padding: '8px 12px',
                      marginBottom: 10,
                    }}
                  >
                    <p style={{ fontSize: 10, color: RED, fontFamily: F, margin: 0 }}>
                      {rateLimitCooldown > 0
                        ? `Too many attempts. Try again in ${rateLimitCooldown}s.`
                        : signupError}
                    </p>
                  </div>
                )}

                <PrimaryBtn label="Continue" onClick={next} disabled={!canGoNext()} />
              </div>
            </motion.div>
          )}

          {/* ── 2: Biometrics ─────────────────────────────────────────── */}
          {step === 2 && (
            <motion.div
              key="biometrics"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeOut' }}
              style={{ flex: 1, paddingTop: 16 }}
            >
              <BiometricsStep
                age={data.age}
                gender={data.gender}
                heightCm={data.heightCm}
                weightKg={data.weightKg}
                onChange={(field, value) => update(field as keyof OnboardingData, value as never)}
              />
            </motion.div>
          )}

          {/* ── 3: Experience Level ───────────────────────────────────── */}
          {step === 3 && (
            <motion.div
              key="experience"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeOut' }}
              style={{ flex: 1, paddingTop: 16 }}
            >
              <ExperienceStep
                value={data.experienceLevel}
                onChange={(v) => update('experienceLevel', v)}
              />
            </motion.div>
          )}

          {/* ── 4: Goal ───────────────────────────────────────────────── */}
          {step === 4 && (
            <motion.div
              key="goal"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeOut' }}
              style={{ flex: 1, paddingTop: 16 }}
            >
              <GoalStep
                value={data.primaryGoal}
                onChange={(v) => update('primaryGoal', v)}
              />
            </motion.div>
          )}

          {/* ── 5: Weekly Plan ────────────────────────────────────────── */}
          {step === 5 && (
            <motion.div
              key="weekly"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeOut' }}
              style={{ flex: 1, paddingTop: 16 }}
            >
              <WeeklyPlanStep
                frequency={data.weeklyFrequency}
                distance={data.preferredDistance}
                onFrequencyChange={(d) => update('weeklyFrequency', d)}
                onDistanceChange={(d) => update('preferredDistance', d)}
                weeklyGoalKm={weeklyGoalKm}
              />
            </motion.div>
          )}

          {/* ── 6: Location ───────────────────────────────────────────── */}
          {step === 6 && (
            <motion.div
              key="location"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeOut' }}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 32px',
              }}
            >
              <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{ marginBottom: 24, display: 'flex', justifyContent: 'center' }}
                >
                  <MapPin size={52} color={RED} strokeWidth={1.5} />
                </motion.div>

                <p
                  style={{
                    fontFamily: FD,
                    fontStyle: 'italic',
                    fontSize: 20,
                    color: INK,
                    marginBottom: 8,
                  }}
                >
                  Find territories near you
                </p>
                <p
                  style={{
                    fontFamily: F,
                    fontSize: 11,
                    color: MID,
                    marginBottom: 6,
                    lineHeight: 1.6,
                    fontWeight: 300,
                  }}
                >
                  Runivo needs GPS to track your runs and show nearby territories.
                </p>
                <p
                  style={{
                    fontFamily: F,
                    fontSize: 10,
                    color: MUTED,
                    marginBottom: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                >
                  <svg
                    width={12}
                    height={12}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                  Your location stays on your device
                </p>

                {locationError && (
                  <div
                    style={{
                      background: RED_BG,
                      border: `0.5px solid ${RED_BD}`,
                      borderRadius: 4,
                      padding: '8px 12px',
                      marginBottom: 16,
                    }}
                  >
                    <p style={{ fontSize: 10, color: RED, fontFamily: F, margin: 0 }}>
                      {locationError}
                    </p>
                  </div>
                )}

                {seeding && (
                  <div
                    style={{
                      marginBottom: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      style={{
                        width: 16,
                        height: 16,
                        border: `2px solid ${HAIR}`,
                        borderTopColor: RED,
                        borderRadius: '50%',
                      }}
                    />
                    <span style={{ fontSize: 11, color: MID, fontFamily: F }}>
                      Setting up territories near you...
                    </span>
                  </div>
                )}

                <PrimaryBtn
                  label={locationGranted ? 'Location Enabled' : 'Allow Location Access'}
                  onClick={async () => {
                    const granted = await requestLocation();
                    if (granted) next();
                  }}
                  disabled={seeding}
                />

                <div style={{ marginTop: 8 }}>
                  <OutlinedBtn label="Skip (limited functionality)" onClick={next} small />
                </div>
              </div>
            </motion.div>
          )}

          {/* ── 7: Preferences ────────────────────────────────────────── */}
          {step === 7 && (
            <motion.div
              key="preferences"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeOut' }}
              style={{ flex: 1, paddingTop: 16 }}
            >
              <PreferencesStep
                distanceUnit={data.distanceUnit}
                notifications={data.notificationsEnabled}
                onUnitChange={(u) => update('distanceUnit', u)}
                onNotificationsChange={(v) => update('notificationsEnabled', v)}
              />
            </motion.div>
          )}

          {/* ── 8: Ready ──────────────────────────────────────────────── */}
          {step === 8 && (
            <motion.div
              key="ready"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeOut' }}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 24px',
              }}
            >
              <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ fontSize: 56, marginBottom: 20 }}
                >
                  ⚡
                </motion.div>

                <p
                  style={{
                    fontFamily: FD,
                    fontStyle: 'italic',
                    fontSize: 22,
                    color: INK,
                    marginBottom: 4,
                  }}
                >
                  You&apos;re all set
                </p>
                <p
                  style={{
                    fontFamily: F,
                    fontSize: 11,
                    color: MID,
                    marginBottom: 20,
                    fontWeight: 300,
                  }}
                >
                  Your personal training profile is ready.
                </p>

                {/* Summary cards */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 8,
                    marginBottom: 24,
                  }}
                >
                  {[
                    { value: `${weeklyGoalKm}km`, sub: 'weekly goal' },
                    { value: GOAL_LABELS[data.primaryGoal], sub: 'goal' },
                    { value: 'Lv.1', sub: 'rank' },
                  ].map((card) => (
                    <div
                      key={card.sub}
                      style={{
                        background: '#ffffff',
                        border: `0.5px solid ${BORDER}`,
                        borderRadius: 4,
                        padding: '10px 14px',
                        textAlign: 'center',
                        flex: 1,
                      }}
                    >
                      <span
                        style={{
                          display: 'block',
                          fontSize: 15,
                          fontWeight: 700,
                          color: RED,
                          fontFamily: F,
                          marginBottom: 2,
                        }}
                      >
                        {card.value}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          color: MUTED,
                          fontFamily: F,
                          textTransform: 'uppercase' as const,
                          letterSpacing: '0.06em',
                        }}
                      >
                        {card.sub}
                      </span>
                    </div>
                  ))}
                </div>

                {signupError && (
                  <div
                    style={{
                      background: RED_BG,
                      border: `0.5px solid ${RED_BD}`,
                      borderRadius: 4,
                      padding: '8px 12px',
                      marginBottom: 12,
                    }}
                  >
                    <p style={{ fontSize: 10, color: RED, fontFamily: F, margin: 0 }}>
                      {rateLimitCooldown > 0
                        ? `Too many attempts. Try again in ${rateLimitCooldown}s.`
                        : signupError}
                    </p>
                  </div>
                )}

                <PrimaryBtn
                  label={signing ? 'Creating account...' : 'Start Running'}
                  onClick={completeOnboarding}
                  disabled={rateLimitCooldown > 0}
                  loading={signing}
                />
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Bottom Continue CTA — steps 2, 3, 4, 5, 7 */}
      {[2, 3, 4, 5, 7].includes(step) && (
        <div
          style={{
            flexShrink: 0,
            padding: '16px',
            paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
          }}
        >
          <PrimaryBtn label="Continue" onClick={next} disabled={!canGoNext()} />
        </div>
      )}
    </div>
  );
}
