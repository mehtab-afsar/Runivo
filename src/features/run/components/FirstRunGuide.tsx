import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Zap, Flag } from 'lucide-react';

const STORAGE_KEY = 'runivo-first-run-done';

interface Step {
  icon: React.ReactNode;
  title: string;
  body: string;
  trigger: 'immediate' | 'first_progress' | 'first_claim';
}

const STEPS: Step[] = [
  {
    icon: <MapPin className="w-5 h-5 text-teal-600" strokeWidth={2} />,
    title: 'Claim territory as you run',
    body: 'Every 200 m you run automatically claims a zone on the map. More territory = more passive coins.',
    trigger: 'immediate',
  },
  {
    icon: <Zap className="w-5 h-5 text-amber-500" strokeWidth={2} />,
    title: 'Energy powers your claims',
    body: 'Each claim costs 10 energy. Running regenerates it — 10 energy per km. Keep moving to keep claiming.',
    trigger: 'first_progress',
  },
  {
    icon: <Flag className="w-5 h-5 text-teal-600" strokeWidth={2} />,
    title: 'First zone secured!',
    body: "Check your run summary when you finish — you'll see XP, coins, and any milestones you hit.",
    trigger: 'first_claim',
  },
];

interface Props {
  claimProgress: number;
  territoriesClaimed: number;
  isRunning: boolean;
}

export function FirstRunGuide({ claimProgress, territoriesClaimed, isRunning }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [done, setDone] = useState(() => !!localStorage.getItem(STORAGE_KEY));

  // Show step 0 immediately when run starts
  useEffect(() => {
    if (done || !isRunning || stepIndex !== 0) return;
    const t = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(t);
  }, [done, isRunning, stepIndex]);

  // Advance to step 1 on first claim_progress
  useEffect(() => {
    if (done || stepIndex !== 1) return;
    if (claimProgress > 0) setVisible(true);
  }, [done, stepIndex, claimProgress]);

  // Advance to step 2 on first claim
  useEffect(() => {
    if (done || stepIndex !== 2) return;
    if (territoriesClaimed > 0) setVisible(true);
  }, [done, stepIndex, territoriesClaimed]);

  if (done) return null;

  const step = STEPS[stepIndex];

  const dismiss = () => {
    setVisible(false);
    const next = stepIndex + 1;
    if (next >= STEPS.length) {
      localStorage.setItem(STORAGE_KEY, '1');
      setDone(true);
    } else {
      setStepIndex(next);
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 24, stiffness: 260 }}
          className="absolute bottom-36 left-4 right-4 z-40"
        >
          <div className="bg-white rounded-2xl p-4 shadow-xl border border-gray-100">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                {step.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{step.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{step.body}</p>
              </div>
              <button
                onClick={dismiss}
                className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0 -mt-0.5"
              >
                <X className="w-3.5 h-3.5 text-gray-500" strokeWidth={2} />
              </button>
            </div>
            <div className="flex gap-1 mt-3 justify-center">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full transition-all ${
                    i === stepIndex ? 'w-4 bg-teal-500' : 'w-1 bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
