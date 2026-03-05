import { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  decimals?: number;
  className?: string;
  duration?: number;
}

export function AnimatedCounter({
  value,
  decimals = 0,
  className = '',
  duration = 0.8,
}: AnimatedCounterProps) {
  const spring = useSpring(value, {
    stiffness: 100,
    damping: 30,
    duration: duration * 1000,
  });

  const display = useTransform(spring, (v) => v.toFixed(decimals));
  const [displayValue, setDisplayValue] = useState(value.toFixed(decimals));

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  useEffect(() => {
    const unsubscribe = display.on('change', (v) => setDisplayValue(v));
    return unsubscribe;
  }, [display]);

  return <motion.span className={className}>{displayValue}</motion.span>;
}
