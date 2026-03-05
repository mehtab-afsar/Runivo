import { motion } from 'framer-motion';

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-[#FAFAFA] flex flex-col items-center justify-center z-50">
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="mb-6"
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600
                        flex items-center justify-center shadow-[0_4px_24px_rgba(0,180,198,0.2)]">
          <span className="text-2xl font-bold text-white">R</span>
        </div>
      </motion.div>

      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            animate={{
              opacity: [0.3, 1, 0.3],
              scale: [0.8, 1, 0.8],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.15,
            }}
            className="w-2 h-2 rounded-full bg-teal-500"
          />
        ))}
      </div>
    </div>
  );
}
