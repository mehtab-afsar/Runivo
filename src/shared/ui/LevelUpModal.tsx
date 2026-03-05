import { motion, AnimatePresence } from 'framer-motion';
import { GAME_CONFIG } from '@shared/services/config';
import { haptic } from '@shared/lib/haptics';
import { useEffect } from 'react';

interface LevelUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  newLevel: number;
}

export function LevelUpModal({ isOpen, onClose, newLevel }: LevelUpModalProps) {
  const title = GAME_CONFIG.LEVEL_TITLES[newLevel - 1] || 'Runner';

  useEffect(() => {
    if (isOpen) {
      haptic('success');
      const timer = setTimeout(onClose, 5000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/30 backdrop-blur-md" />

          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 20 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ x: '50%', y: '50%', scale: 0, opacity: 1 }}
                animate={{
                  x: `${Math.random() * 100}%`,
                  y: `${Math.random() * 100}%`,
                  scale: [0, 1, 0],
                  opacity: [1, 1, 0],
                }}
                transition={{
                  duration: 1.5 + Math.random(),
                  delay: Math.random() * 0.3,
                  ease: 'easeOut',
                }}
                className="absolute"
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: i % 3 === 0 ? '#00B4C6' : i % 3 === 1 ? '#FFD700' : '#DC267F',
                    boxShadow: `0 0 10px ${
                      i % 3 === 0 ? 'rgba(0,180,198,0.5)' : i % 3 === 1 ? 'rgba(255,215,0,0.5)' : 'rgba(220,38,127,0.5)'
                    }`,
                  }}
                />
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', damping: 15, stiffness: 200, delay: 0.1 }}
            className="relative z-10 text-center px-8"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              animate={{
                scale: [1, 1.05, 1],
                textShadow: [
                  '0 0 20px rgba(0,180,198,0.2)',
                  '0 0 40px rgba(0,180,198,0.4)',
                  '0 0 20px rgba(0,180,198,0.2)',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="mb-4"
            >
              <span className="text-stat text-8xl font-bold text-transparent bg-clip-text
                             bg-gradient-to-b from-teal-500 to-teal-600
                             drop-shadow-[0_0_30px_rgba(0,180,198,0.3)]">
                {newLevel}
              </span>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-[11px] uppercase tracking-[0.3em] text-teal-600 font-bold mb-2"
            >
              Level Up
            </motion.p>

            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-2xl font-bold text-gray-900 mb-6"
            >
              {title}
            </motion.h2>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white/90 backdrop-blur-xl rounded-2xl p-4 mb-6 border border-teal-100 shadow-lg max-w-xs mx-auto"
            >
              <p className="text-xs text-gray-400 mb-2">Unlocked</p>
              <p className="text-sm text-gray-700">+2 Territory Capacity</p>
            </motion.div>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              onClick={onClose}
              className="px-8 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600
                         text-sm font-bold text-white
                         shadow-[0_4px_20px_rgba(0,180,198,0.3)]"
            >
              Continue
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
