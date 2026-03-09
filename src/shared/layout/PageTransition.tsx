import { motion } from 'framer-motion';

/**
 * Wrap each route element with this to get a consistent fade-up transition.
 * AnimatePresence lives at the Routes level in App.tsx so exits actually fire.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}
