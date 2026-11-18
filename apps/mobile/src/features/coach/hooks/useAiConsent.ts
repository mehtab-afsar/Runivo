import { useCallback, useEffect, useState } from 'react';
import { hasAiConsent, verifyAiConsentWithServer } from '@shared/services/aiConsent';

/**
 * Has this runner agreed to send their data to the AI behind PaceX?
 * `null` while it is being checked, so screens don't flash the consent prompt.
 */
export function useAiConsent() {
  const [consent, setConsent] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    hasAiConsent().then(v => {
      if (!alive) return;
      setConsent(v);
      // A "yes" on the phone the server doesn't have (another account's, or taken
      // back elsewhere) made every PaceX call fail with 403. Check and correct it.
      if (v) verifyAiConsentWithServer().then(ok => { if (alive && ok === false) setConsent(false); });
    });
    return () => { alive = false; };
  }, []);

  const granted = useCallback(() => setConsent(true), []);
  const withdrawn = useCallback(() => setConsent(false), []);
  return { consent, granted, withdrawn };
}
