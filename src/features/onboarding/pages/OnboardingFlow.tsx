import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { haptic } from '@shared/lib/haptics';
import { initializePlayer } from '@shared/services/store';
import { seedTerritoryData } from '@shared/services/seedData';
import { soundManager } from '@shared/audio/sounds';
import { saveProfile, computeWeeklyGoal } from '@shared/services/profile';
import OnboardingProgress from '../components/ProgressBar';
import ExperienceStep from '../components/steps/ExperienceStep';
import GoalStep from '../components/steps/GoalStep';
import WeeklyPlanStep from '../components/steps/WeeklyPlanStep';
import PlaystyleStep from '../components/steps/PlaystyleStep';
import PreferencesStep from '../components/steps/PreferencesStep';

interface OnboardingFlowProps {
  onComplete: () => void;
}

interface OnboardingData {
  username: string;
  experienceLevel: 'new' | 'casual' | 'regular' | 'competitive';
  primaryGoal: 'get_fit' | 'lose_weight' | 'run_faster' | 'explore' | 'compete';
  weeklyFrequency: number;
  preferredDistance: 'short' | '5k' | '10k' | 'long';
  playstyle: 'conqueror' | 'defender' | 'explorer' | 'social';
  distanceUnit: 'km' | 'mi';
  notificationsEnabled: boolean;
}

const STEP_COUNT = 9;

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back
  const [locationGranted, setLocationGranted] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [seeding, setSeeding] = useState(false);

  const [data, setData] = useState<OnboardingData>({
    username: '',
    experienceLevel: 'casual',
    primaryGoal: 'get_fit',
    weeklyFrequency: 3,
    preferredDistance: '5k',
    playstyle: 'conqueror',
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
  const back = useCallback(() => goTo(step - 1), [goTo, step]);

  const update = <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => {
    setData(prev => ({ ...prev, [key]: value }));
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
    const trimmedName = data.username.trim() || 'Runner';
    const player = await initializePlayer(trimmedName);
    const missionDifficulty = data.experienceLevel === 'new' ? 'easy'
      : data.experienceLevel === 'competitive' ? 'hard' : 'mixed';

    await saveProfile({
      playerId: player.id,
      experienceLevel: data.experienceLevel,
      weeklyFrequency: data.weeklyFrequency,
      primaryGoal: data.primaryGoal,
      preferredDistance: data.preferredDistance,
      playstyle: data.playstyle,
      distanceUnit: data.distanceUnit,
      notificationsEnabled: data.notificationsEnabled,
      weeklyGoalKm,
      missionDifficulty,
      onboardingCompletedAt: Date.now(),
    });

    localStorage.setItem('runivo-weekly-goal', String(weeklyGoalKm));
    localStorage.setItem('runivo-distance-unit', data.distanceUnit);
    localStorage.setItem('runivo-mission-difficulty', missionDifficulty);
    localStorage.setItem('runivo-onboarding-complete', 'true');

    soundManager.play('level_up');
    haptic('success');
    onComplete();
  };

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? 100 : -100, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -100 : 100, opacity: 0 }),
  };

  const canGoNext = (): boolean => {
    if (step === 1) return data.username.trim().length >= 3;
    return true;
  };

  const playstyleLabels: Record<string, string> = {
    conqueror: 'Conqueror',
    defender: 'Defender',
    explorer: 'Explorer',
    social: 'Social Runner',
  };

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
          {/* 0: Welcome */}
          {step === 0 && (
            <motion.div
              key="welcome"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', damping: 25 }}
              className="flex-1 flex items-center justify-center px-8"
            >
              <div className="text-center w-full max-w-sm">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', damping: 12, delay: 0.2 }}
                  className="w-24 h-24 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-teal-500 to-teal-600
                             flex items-center justify-center shadow-[0_8px_30px_rgba(0,180,198,0.25)]"
                >
                  <span className="text-4xl font-black text-white">R</span>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-3xl font-bold text-gray-900 mb-3"
                >
                  Welcome to Runivo
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-base text-gray-400 mb-3 leading-relaxed"
                >
                  Run through your city.<br />
                  Claim territories.<br />
                  Build your empire.
                </motion.p>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="text-[11px] uppercase tracking-[0.25em] text-teal-500 font-bold mb-10"
                >
                  {'Run \u00B7 Capture \u00B7 Conquer'}
                </motion.p>

                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={next}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600
                             text-base font-bold text-white
                             shadow-[0_4px_20px_rgba(0,180,198,0.3)]"
                >
                  Get Started
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* 1: Name */}
          {step === 1 && (
            <motion.div
              key="name"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', damping: 25 }}
              className="flex-1 flex items-center justify-center px-8"
            >
              <div className="w-full max-w-sm">
                <div className="flex flex-col items-center mb-8">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-black mb-4 transition-all ${
                    data.username.trim().length >= 3
                      ? 'bg-teal-50 text-teal-600 ring-2 ring-teal-400'
                      : 'bg-gray-100 text-gray-300'
                  }`}>
                    {(data.username.trim()[0] || '?').toUpperCase()}
                  </div>
                  <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">
                    What should we call you?
                  </h2>
                  <p className="text-[13px] text-gray-400 mt-1">
                    This is how other runners will see you
                  </p>
                </div>

                <div className="mb-8">
                  <input
                    type="text"
                    value={data.username}
                    onChange={(e) => update('username', e.target.value.slice(0, 20))}
                    placeholder="Enter your name"
                    maxLength={20}
                    autoFocus
                    className="w-full px-5 py-4 rounded-2xl bg-gray-50 border border-gray-200
                               text-gray-900 text-base font-medium placeholder:text-gray-300
                               focus:outline-none focus:border-teal-400 focus:bg-white
                               transition-all"
                  />
                  <p className="text-xs text-gray-300 mt-2 text-right">
                    {data.username.length}/20
                  </p>
                </div>

                <button
                  onClick={next}
                  disabled={!canGoNext()}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600
                             text-base font-bold text-white
                             shadow-[0_4px_20px_rgba(0,180,198,0.3)]
                             disabled:opacity-30 disabled:shadow-none
                             transition-all"
                >
                  Continue
                </button>

                <button
                  onClick={() => { update('username', 'Runner'); next(); }}
                  className="w-full py-3 mt-3 text-sm text-gray-400"
                >
                  Skip for now
                </button>
              </div>
            </motion.div>
          )}

          {/* 2: Experience Level */}
          {step === 2 && (
            <motion.div
              key="experience"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', damping: 25 }}
              className="flex-1 pt-4"
            >
              <ExperienceStep
                value={data.experienceLevel}
                onChange={(v) => update('experienceLevel', v)}
              />
            </motion.div>
          )}

          {/* 3: Goal */}
          {step === 3 && (
            <motion.div
              key="goal"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', damping: 25 }}
              className="flex-1 pt-4"
            >
              <GoalStep
                value={data.primaryGoal}
                onChange={(v) => update('primaryGoal', v)}
              />
            </motion.div>
          )}

          {/* 4: Weekly Plan */}
          {step === 4 && (
            <motion.div
              key="weekly"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
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

          {/* 5: Playstyle */}
          {step === 5 && (
            <motion.div
              key="playstyle"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', damping: 25 }}
              className="flex-1 pt-4"
            >
              <PlaystyleStep
                value={data.playstyle}
                onChange={(v) => update('playstyle', v)}
              />
            </motion.div>
          )}

          {/* 6: Location */}
          {step === 6 && (
            <motion.div
              key="location"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
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

          {/* 7: Preferences */}
          {step === 7 && (
            <motion.div
              key="preferences"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
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

          {/* 8: Ready */}
          {step === 8 && (
            <motion.div
              key="ready"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
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

                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  You're All Set, {data.username.trim() || 'Runner'}!
                </h2>

                <div className="flex justify-center gap-4 mb-8">
                  <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 text-center">
                    <span className="text-stat text-lg font-bold text-teal-600 block">{weeklyGoalKm}km</span>
                    <span className="text-[11px] text-gray-400">weekly goal</span>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 text-center">
                    <span className="text-stat text-lg font-bold text-teal-600 block">{playstyleLabels[data.playstyle]}</span>
                    <span className="text-[11px] text-gray-400">playstyle</span>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 text-center">
                    <span className="text-stat text-lg font-bold text-teal-600 block">Lv.1</span>
                    <span className="text-[11px] text-gray-400">rank</span>
                  </div>
                </div>

                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={completeOnboarding}
                  className="w-full py-5 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600
                             text-lg font-bold text-white
                             shadow-[0_4px_24px_rgba(0,180,198,0.35)]"
                >
                  Start Conquering
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom CTA for steps 2-5, 7 */}
      {[2, 3, 4, 5, 7].includes(step) && (
        <div className="shrink-0 px-6 pb-6" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
          <button
            onClick={next}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600
                       text-base font-bold text-white
                       shadow-[0_4px_20px_rgba(0,180,198,0.3)]"
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
