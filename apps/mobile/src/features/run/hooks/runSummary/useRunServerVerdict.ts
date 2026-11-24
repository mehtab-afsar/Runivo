import { useState, useEffect } from 'react';
import * as Haptics from '@theme/hapticsGated';
import { getRunById } from '@shared/services/store';
import type { ConfirmState, ServerResult } from '../../utils/runSummaryTypes';

/**
 * The server scores the run in the background sync that starts as the summary
 * opens: check the stored run for its verdict for up to ~30 s.
 */
export function useRunServerVerdict(runId: string) {
  // The server's measured area lands on the stored run after sync; until then
  // the card shows the app's estimate and says so.
  const [serverAreaM2, setServerAreaM2] = useState<number | null>(null);
  const [serverResult, setServerResult] = useState<ServerResult | null>(null);
  // PACE the server actually paid (cap and verified distance applied); also
  // the only PACE figure a past run opened from History has.
  const [serverPace, setServerPace]     = useState<number | null>(null);
  const [confirm, setConfirm]           = useState<ConfirmState>('checking');

  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const check = async () => {
      const r = await getRunById(runId).catch(() => undefined);
      if (cancelled) return;
      if (r?.serverProcessed) {
        if (typeof r.xpEarned === 'number') setServerPace(r.xpEarned);
        if (typeof r.territoryAreaM2 === 'number' && r.territoryAreaM2 > 0) setServerAreaM2(r.territoryAreaM2);
        if (r.serverResult) {
          setServerResult(r.serverResult);
          // L6: the capture moment fires here, once the server has confirmed it.
          if (r.serverResult.newZones + r.serverResult.stolenZones > 0) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        setConfirm('confirmed');
        return;
      }
      if (++tries < 15) setTimeout(check, 2000);
      else setConfirm('pending');
    };
    check();
    return () => { cancelled = true; };
  }, [runId]);

  return { serverAreaM2, serverResult, serverPace, confirm };
}
