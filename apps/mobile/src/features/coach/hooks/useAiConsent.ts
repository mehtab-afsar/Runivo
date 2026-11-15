import { useCallback, useEffect, useState } from 'react';
import { hasAiConsent } from '@shared/services/aiConsent';

/**
 * Has this runner agreed to send their data to the AI behind PaceX?
 * `null` while it is being checked, so screens don't flash the consent prompt.
 */
export function useAiConsent() {
  const [consent, setConsent] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    hasAiConsent().then(v => { if (alive) setConsent(v); });
    return () => { alive = false; };
  }, []);

  const granted = useCallback(() => setConsent(true), []);
  const withdrawn = useCallback(() => setConsent(false), []);
  return { consent, granted, withdrawn };
}
