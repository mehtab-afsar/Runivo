import { useState, useEffect } from 'react';
import { appAlert } from '@mobile/shared/components/AppAlert';
import { fetchActivityMapHidden, setActivityMapHidden } from '@features/settings/services/mapVisibilityService';

/** This activity's own "show map to others" switch (on top of the runner's global rule). */
export function useRunMapVisibility(runId: string) {
  const [mapHidden, setMapHidden] = useState<boolean | null>(null);
  const [mapSaving, setMapSaving] = useState(false);
  useEffect(() => { fetchActivityMapHidden(runId).then(setMapHidden).catch(() => {}); }, [runId]);
  const toggleMapHidden = async (hide: boolean) => {
    const prev = mapHidden;
    setMapHidden(hide); setMapSaving(true);
    try {
      const ok = await setActivityMapHidden(runId, hide);
      if (!ok) { setMapHidden(prev); appAlert('Not posted yet', 'This activity has not reached the feed yet. Try again in a moment.'); }
    } catch {
      setMapHidden(prev);
      appAlert("Couldn't change the map", 'Check your connection and try again.');
    } finally {
      setMapSaving(false);
    }
  };
  return { mapHidden, mapSaving, toggleMapHidden };
}
