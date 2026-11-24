import { useState, useEffect, useRef } from 'react';

/**
 * PACE count-up: 300ms delay, 800ms ease-out cubic. Runs again from the
 * shown figure if the server's number differs from the estimate.
 */
export function usePaceCountUp(paceEarned: number): number {
  const [paceDisplay, setPaceDisplay] = useState(0);
  const paceShownRef = useRef(0);
  useEffect(() => {
    const from = paceShownRef.current;
    if (paceEarned === from) return;
    const startTime = Date.now() + (from === 0 ? 300 : 0);
    const id = setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (elapsed < 0) return;
      const t = Math.min(1, elapsed / 800);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = Math.round(from + eased * (paceEarned - from));
      paceShownRef.current = v;
      setPaceDisplay(v);
      if (t >= 1) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [paceEarned]);
  return paceDisplay;
}
