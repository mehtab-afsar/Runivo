import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Eye, EyeOff, MapPin, Trophy, Users } from 'lucide-react';
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

interface OnboardingFlowProps {
  onComplete: () => void;
}

interface OnboardingData {
  username: string;
  email: string;
  password: string;
  // Biometrics
  age: number;
  gender: 'male' | 'female' | 'other' | '';
  heightCm: number;
  weightKg: number;
  // Training
  experienceLevel: 'new' | 'casual' | 'regular' | 'competitive';
  primaryGoal: 'get_fit' | 'lose_weight' | 'run_faster' | 'explore' | 'compete';
  weeklyFrequency: number;
  preferredDistance: 'short' | '5k' | '10k' | 'long';
  distanceUnit: 'km' | 'mi';
  notificationsEnabled: boolean;
}

// Step map:
// 0 Welcome | 1 Account | 2 Biometrics | 3 Experience | 4 Goal | 5 Weekly | 6 Location | 7 Preferences | 8 Ready
const STEP_COUNT = 9;

const GOAL_LABELS: Record<string, string> = {
  get_fit:      'Get Fit',
  lose_weight:  'Lose Weight',
  run_faster:   'Run Faster',
  explore:      'Explore',
  compete:      'Compete',
};

type FlowView = 'welcome' | 'login' | 'signup';

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [view, setView] = useState<FlowView>('welcome');
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [locationGranted, setLocationGranted] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rateLimitCooldown, setRateLimitCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Login-specific state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
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

  const goTo = useCallback((next: number) => {
    setDirection(next > step ? 1 : -1);
    haptic('light');
    setStep(next);
  }, [step]);

  const next = useCallback(() => goTo(step + 1), [goTo, step]);
  const back = useCallback(() => {
    if (step === 1) { setView('welcome'); return; }
    goTo(step - 1);
  }, [goTo, step]);

  const update = <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => {
    setData(prev => ({ ...prev, [key]: value }));
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
          : 'Could not get your location. Please try again.'
      );
      return false;
    }
  };

  const completeOnboarding = async () => {
    setSigning(true);
    setSignupError('');

    const trimmedName = data.username.trim() || 'Runner';
    const missionDifficulty = data.experienceLevel === 'new' ? 'easy'
      : data.experienceLevel === 'competitive' ? 'hard' : 'mixed';

    try {
      await signUp(data.email.trim(), data.password, trimmedName);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign up failed';
      const isRateLimit = /rate.limit|too.many|security.purposes|over_email/i.test(msg);
      if (isRateLimit) {
        const secondsMatch = msg.match(/after (\d+) second/);
        const waitSecs = secondsMatch ? parseInt(secondsMatch[1], 10) : 60;
        setRateLimitCooldown(waitSecs);
        setSignupError(`Too many attempts. Please wait ${waitSecs}s before trying again.`);
        cooldownRef.current = setInterval(() => {
          setRateLimitCooldown(prev => {
            if (prev <= 1) {
              clearInterval(cooldownRef.current!);
              cooldownRef.current = null;
              setSignupError('');
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setSignupError(msg.includes('already registered') ? 'This email is already in use.' : msg);
      }
      setSigning(false);
      return;
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

    // Cache weight locally for run-time calorie calculations
    if (data.weightKg > 0) {
      localStorage.setItem('runivo-weight-kg', String(data.weightKg));
    }

    await pushProfile().catch(() => {});

    const inviteRef = sessionStorage.getItem('runivo-invite-ref');
    if (inviteRef) {
      const { data: { user: newUser } } = await supabase.auth.getUser();
      if (newUser) {
        try {
          await supabase.rpc('handle_referral', {
            p_new_user_id: newUser.id,
            p_referrer_username: inviteRef,
          });
        } catch { /* non-fatal */ }
      }
      sessionStorage.removeItem('runivo-invite-ref');
    }

    localStorage.setItem('runivo-weekly-goal', String(weeklyGoalKm));
    localStorage.setItem('runivo-distance-unit', data.distanceUnit);
    localStorage.setItem('runivo-mission-difficulty', missionDifficulty);
    localStorage.setItem('runivo-onboarding-complete', 'true');

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
      setLoginError(err instanceof Error ? err.message : 'Sign in failed. Check your credentials.');
    } finally {
      setLoginLoading(false);
    }
  };

  const slideVariants = {
    enter:  (d: number) => ({ x: d > 0 ? 100 : -100, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:   (d: number) => ({ x: d > 0 ? -100 : 100, opacity: 0 }),
  };

  // ── WELCOME (premium landing) ─────────────────────────────────────────
  if (view === 'welcome') {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col overflow-hidden" style={{ background: '#F8FAFA' }}>

        {/* Hero panel — top ~55% with teal gradient */}
        <div
          className="relative flex flex-col items-center justify-center overflow-hidden"
          style={{
            flex: '0 0 56%',
            paddingBottom: '28px',
            background: 'linear-gradient(160deg, #0E7490 0%, #0891B2 45%, #06B6D4 100%)',
          }}
        >
          {/* Subtle concentric ring decoration */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {[200, 290, 380].map(s => (
              <div
                key={s}
                className="absolute rounded-full border border-white/10"
                style={{ width: s, height: s }}
              />
            ))}
          </div>

          {/* Logo */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 14, stiffness: 110, delay: 0.1 }}
            className="relative z-10 mb-5 w-24 h-24 rounded-3xl bg-white flex items-center justify-center"
            style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)' }}
          >
            <RunivoLogo size={60} />
          </motion.div>

          {/* Wordmark */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10"
            style={{
              fontSize: 40,
              fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#ffffff',
              lineHeight: 1,
            }}
          >
            Runivo
          </motion.div>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="relative z-10 mt-2 text-[11px] tracking-[0.3em] uppercase text-white/60 font-medium"
          >
            {'Run \u00B7 Capture \u00B7 Conquer'}
          </motion.p>

          {/* Bottom wave / divider */}
          <svg
            className="absolute bottom-0 left-0 w-full"
            viewBox="0 0 430 28"
            preserveAspectRatio="none"
            style={{ display: 'block' }}
          >
            <path d="M0,28 C120,0 310,0 430,28 L430,28 L0,28 Z" fill="#F8FAFA" />
          </svg>
        </div>

        {/* Bottom panel — features + CTAs */}
        <div className="flex-1 flex flex-col justify-between px-6 pt-5">
          {/* Feature chips — horizontal row */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.5 }}
            className="flex gap-2.5 mb-5"
          >
            {[
              { icon: <MapPin size={15} strokeWidth={1.75} className="text-teal-600" />, bg: 'bg-teal-50', label: 'Territory' },
              { icon: <Trophy size={15} strokeWidth={1.75} className="text-amber-500" />, bg: 'bg-amber-50', label: 'Leaderboard' },
              { icon: <Users size={15} strokeWidth={1.75} className="text-indigo-500" />, bg: 'bg-indigo-50', label: 'Clubs' },
            ].map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + i * 0.07 }}
                className="flex-1 flex flex-col items-center gap-2 bg-white rounded-2xl py-3.5 border border-gray-100 shadow-sm"
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${f.bg}`}>
                  {f.icon}
                </div>
                <span className="text-[11px] font-semibold text-gray-600">{f.label}</span>
              </motion.div>
            ))}
          </motion.div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.78, duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-3"
            style={{ paddingBottom: 'max(28px, env(safe-area-inset-bottom))' }}
          >
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => { setView('signup'); setStep(1); haptic('light'); }}
              className="w-full py-4 rounded-2xl text-base font-bold text-white
                         shadow-[0_4px_24px_rgba(8,145,178,0.35)]"
              style={{ background: 'linear-gradient(135deg, #0891B2, #0E7490)' }}
            >
              Create Account
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => { setView('login'); haptic('light'); }}
              className="w-full py-3.5 rounded-2xl border border-gray-200 bg-white
                         text-base font-semibold text-gray-800"
            >
              Log in
            </motion.button>
            <p className="text-center text-[10px] text-gray-300 pb-1">
              By continuing you agree to our Terms &amp; Privacy Policy
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── LOGIN ──────────────────────────────────────────────────────────────
  if (view === 'login') {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col bg-[#FAFAFA]">
        {/* Header */}
        <div
          className="shrink-0 flex items-center px-4 pt-2"
          style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
        >
          <button onClick={() => { setView('welcome'); haptic('light'); }} className="p-1 -ml-1">
            <ChevronLeft className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col justify-center px-6 overflow-y-auto">
          {/* Logo + title */}
          <div className="flex flex-col items-center mb-8">
            <div className="mb-4 drop-shadow-[0_8px_20px_rgba(8,145,178,0.2)]">
              <RunivoLogo size={52} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Welcome back</h1>
            <p className="text-[13px] text-gray-400 mt-1">Sign in to continue your conquest</p>
          </div>

          {/* Fields */}
          <div className="space-y-3 mb-5">
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider pl-1">Email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus
                className="mt-1 w-full px-4 py-3.5 rounded-2xl bg-gray-50 border border-gray-200
                           text-gray-900 text-sm font-medium placeholder:text-gray-300
                           focus:outline-none focus:border-teal-400 focus:bg-white transition-all"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider pl-1">Password</label>
              <div className="mt-1 relative">
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="Your password"
                  onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }}
                  className="w-full px-4 pr-12 py-3.5 rounded-2xl bg-gray-50 border border-gray-200
                             text-gray-900 text-sm font-medium placeholder:text-gray-300
                             focus:outline-none focus:border-teal-400 focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(p => !p)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300"
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {loginError && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-100">
              <p className="text-xs text-red-500">{loginError}</p>
            </div>
          )}

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleLogin}
            disabled={loginLoading || !loginEmail.trim() || !loginPassword}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600
                       text-base font-bold text-white
                       shadow-[0_4px_20px_rgba(0,180,198,0.3)]
                       disabled:opacity-40 disabled:shadow-none transition-all
                       flex items-center justify-center gap-2"
          >
            {loginLoading ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full"
                />
                Signing in...
              </>
            ) : 'Sign In'}
          </motion.button>

          <p className="text-center text-[12px] text-gray-400 mt-4">
            Don&apos;t have an account?{' '}
            <button
              onClick={() => { setView('signup'); setStep(1); haptic('light'); }}
              className="text-teal-600 font-semibold"
            >
              Sign up
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ── SIGN-UP FLOW ───────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-[#FAFAFA] z-[200] flex flex-col">
      {/* Progress bar */}
      <div
        className="shrink-0 pt-2"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center px-4 mb-2">
          {step > 0 && step < STEP_COUNT - 1 ? (
            <button onClick={back} className="p-1 -ml-1">
              <ChevronLeft className="w-5 h-5 text-gray-400" />
            </button>
          ) : (
            <div className="w-7" />
          )}
          <div className="flex-1 mx-2">
            <OnboardingProgress currentStep={step} />
          </div>
          <div className="w-7" />
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>

          {/* ── 1: Create Account ─────────────────────────────────── */}
          {step === 1 && (
            <motion.div
              key="account"
              custom={direction}
              variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ type: 'spring', damping: 25 }}
              className="flex-1 flex items-center justify-center px-8 overflow-y-auto"
            >
              <div className="w-full max-w-sm py-4">
                <div className="mb-6 text-center">
                  <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Create your account</h2>
                  <p className="text-[13px] text-gray-400 mt-1">Join thousands of runners conquering their cities</p>
                </div>

                <div className="space-y-3 mb-6">
                  {/* Username */}
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider pl-1">Username</label>
                    <div className="mt-1 relative">
                      <div className={`absolute left-4 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                        data.username.trim().length >= 3 ? 'bg-teal-50 text-teal-600' : 'bg-gray-100 text-gray-300'
                      }`}>
                        {(data.username.trim()[0] || '?').toUpperCase()}
                      </div>
                      <input
                        type="text"
                        value={data.username}
                        onChange={(e) => update('username', e.target.value.slice(0, 20))}
                        placeholder="Your runner name"
                        maxLength={20}
                        autoFocus
                        className="w-full pl-14 pr-4 py-3.5 rounded-2xl bg-gray-50 border border-gray-200
                                   text-gray-900 text-sm font-medium placeholder:text-gray-300
                                   focus:outline-none focus:border-teal-400 focus:bg-white transition-all"
                      />
                    </div>
                    <p className="text-[10px] text-gray-300 mt-1 text-right">{data.username.length}/20 · min 3 chars</p>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider pl-1">Email</label>
                    <input
                      type="email"
                      value={data.email}
                      onChange={(e) => update('email', e.target.value)}
                      placeholder="you@example.com"
                      className="mt-1 w-full px-4 py-3.5 rounded-2xl bg-gray-50 border border-gray-200
                                 text-gray-900 text-sm font-medium placeholder:text-gray-300
                                 focus:outline-none focus:border-teal-400 focus:bg-white transition-all"
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider pl-1">Password</label>
                    <div className="mt-1 relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={data.password}
                        onChange={(e) => update('password', e.target.value)}
                        placeholder="Min 8 characters"
                        className="w-full px-4 pr-12 py-3.5 rounded-2xl bg-gray-50 border border-gray-200
                                   text-gray-900 text-sm font-medium placeholder:text-gray-300
                                   focus:outline-none focus:border-teal-400 focus:bg-white transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(p => !p)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-300 mt-1 pl-1">min 8 characters</p>
                  </div>
                </div>

                {signupError && (
                  <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-100">
                    <p className="text-xs text-red-500">
                      {rateLimitCooldown > 0
                        ? `Too many attempts. Try again in ${rateLimitCooldown}s.`
                        : signupError}
                    </p>
                  </div>
                )}

                <button
                  onClick={next}
                  disabled={!canGoNext()}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600
                             text-base font-bold text-white
                             shadow-[0_4px_20px_rgba(0,180,198,0.3)]
                             disabled:opacity-30 disabled:shadow-none transition-all"
                >
                  Continue
                </button>
              </div>
            </motion.div>
          )}

          {/* ── 2: Biometrics ─────────────────────────────────────── */}
          {step === 2 && (
            <motion.div
              key="biometrics"
              custom={direction}
              variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ type: 'spring', damping: 25 }}
              className="flex-1 pt-4"
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

          {/* ── 3: Experience Level ───────────────────────────────── */}
          {step === 3 && (
            <motion.div
              key="experience"
              custom={direction}
              variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ type: 'spring', damping: 25 }}
              className="flex-1 pt-4"
            >
              <ExperienceStep
                value={data.experienceLevel}
                onChange={(v) => update('experienceLevel', v)}
              />
            </motion.div>
          )}

          {/* ── 4: Goal ───────────────────────────────────────────── */}
          {step === 4 && (
            <motion.div
              key="goal"
              custom={direction}
              variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ type: 'spring', damping: 25 }}
              className="flex-1 pt-4"
            >
              <GoalStep
                value={data.primaryGoal}
                onChange={(v) => update('primaryGoal', v)}
              />
            </motion.div>
          )}

          {/* ── 5: Weekly Plan ────────────────────────────────────── */}
          {step === 5 && (
            <motion.div
              key="weekly"
              custom={direction}
              variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ type: 'spring', damping: 25 }}
              className="flex-1 pt-4"
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

          {/* ── 6: Location ───────────────────────────────────────── */}
          {step === 6 && (
            <motion.div
              key="location"
              custom={direction}
              variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ type: 'spring', damping: 25 }}
              className="flex-1 flex items-center justify-center px-8"
            >
              <div className="w-full max-w-sm text-center">
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-6xl mb-6"
                >
                  {'\uD83D\uDCCD'}
                </motion.div>

                <h2 className="text-xl font-extrabold text-gray-900 tracking-tight mb-2">
                  Find territories near you
                </h2>
                <p className="text-[13px] text-gray-400 mb-2 leading-relaxed">
                  Runivo needs GPS to track your runs and show nearby territories.
                </p>
                <p className="text-[11px] text-gray-400 mb-8 flex items-center justify-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                  Your location stays on your device
                </p>

                {locationError && (
                  <div className="mb-6 p-3 rounded-xl bg-red-50 border border-red-200">
                    <p className="text-xs text-red-500">{locationError}</p>
                  </div>
                )}

                {seeding && (
                  <div className="mb-6 flex items-center justify-center gap-2">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-5 h-5 border-2 border-teal-200 border-t-teal-500 rounded-full"
                    />
                    <span className="text-sm text-gray-400">Setting up territories near you...</span>
                  </div>
                )}

                <button
                  onClick={async () => {
                    const granted = await requestLocation();
                    if (granted) next();
                  }}
                  disabled={seeding}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600
                             text-base font-bold text-white
                             shadow-[0_4px_20px_rgba(0,180,198,0.3)]
                             disabled:opacity-50"
                >
                  {locationGranted ? 'Location Enabled' : 'Allow Location Access'}
                </button>

                <button
                  onClick={next}
                  className="w-full py-3 mt-3 text-sm text-gray-400"
                >
                  Skip (limited functionality)
                </button>
              </div>
            </motion.div>
          )}

          {/* ── 7: Preferences ────────────────────────────────────── */}
          {step === 7 && (
            <motion.div
              key="preferences"
              custom={direction}
              variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ type: 'spring', damping: 25 }}
              className="flex-1 pt-4"
            >
              <PreferencesStep
                distanceUnit={data.distanceUnit}
                notifications={data.notificationsEnabled}
                onUnitChange={(u) => update('distanceUnit', u)}
                onNotificationsChange={(v) => update('notificationsEnabled', v)}
              />
            </motion.div>
          )}

          {/* ── 8: Ready ──────────────────────────────────────────── */}
          {step === 8 && (
            <motion.div
              key="ready"
              custom={direction}
              variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ type: 'spring', damping: 25 }}
              className="flex-1 flex items-center justify-center px-8"
            >
              <div className="w-full max-w-sm text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 10, delay: 0.2 }}
                  className="text-7xl mb-6"
                >
                  {'\u26A1'}
                </motion.div>

                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  You're All Set, {data.username.trim() || 'Runner'}!
                </h2>
                <p className="text-[13px] text-gray-400 mb-6">Your personal training profile is ready.</p>

                <div className="flex justify-center gap-3 mb-8">
                  <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 text-center">
                    <span className="text-stat text-lg font-bold text-teal-600 block">{weeklyGoalKm}km</span>
                    <span className="text-[11px] text-gray-400">weekly goal</span>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 text-center">
                    <span className="text-stat text-lg font-bold text-teal-600 block">{GOAL_LABELS[data.primaryGoal]}</span>
                    <span className="text-[11px] text-gray-400">goal</span>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 text-center">
                    <span className="text-stat text-lg font-bold text-teal-600 block">Lv.1</span>
                    <span className="text-[11px] text-gray-400">rank</span>
                  </div>
                </div>

                {signupError && (
                  <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-100">
                    <p className="text-xs text-red-500">
                      {rateLimitCooldown > 0
                        ? `Too many attempts. Try again in ${rateLimitCooldown}s.`
                        : signupError}
                    </p>
                  </div>
                )}

                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={completeOnboarding}
                  disabled={signing || rateLimitCooldown > 0}
                  className="w-full py-5 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600
                             text-lg font-bold text-white
                             shadow-[0_4px_24px_rgba(0,180,198,0.35)]
                             disabled:opacity-60 flex items-center justify-center gap-3"
                >
                  {signing ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full"
                      />
                      Creating account...
                    </>
                  ) : 'Start Running'}
                </motion.button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Bottom Continue CTA — steps 2, 3, 4, 5, 7 */}
      {[2, 3, 4, 5, 7].includes(step) && (
        <div className="shrink-0 px-6 pb-6" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
          <button
            onClick={next}
            disabled={!canGoNext()}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600
                       text-base font-bold text-white
                       shadow-[0_4px_20px_rgba(0,180,198,0.3)]
                       disabled:opacity-30 disabled:shadow-none transition-all"
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
