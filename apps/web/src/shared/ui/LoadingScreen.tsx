import { motion } from 'framer-motion';
import { RunivoLogo } from './RunivoLogo';

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center z-50" style={{ background: '#FEFEFE' }}>
      <motion.div
        animate={{ scale: [0.95, 1.05, 0.95] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        className="mb-6 drop-shadow-[0_4px_20px_rgba(232,67,90,0.2)]"
      >
        <RunivoLogo size={64} wordmark />
      </motion.div>

      <div className="flex gap-1.5 mt-2">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
            className="w-2 h-2 rounded-full" style={{ background: '#E8435A' }}
          />
        ))}
      </div>
    </div>
  );
}
