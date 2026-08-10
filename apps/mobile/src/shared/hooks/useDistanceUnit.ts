import { useEffect, useState } from 'react';
import { getSettings } from '@shared/services/store';

/** The user's preferred distance unit, read once from settings on mount. */
export function useDistanceUnit(): 'km' | 'mi' {
  const [unit, setUnit] = useState<'km' | 'mi'>('km');
  useEffect(() => {
    getSettings().then(s => setUnit(s.distanceUnit)).catch(() => {});
  }, []);
  return unit;
}
