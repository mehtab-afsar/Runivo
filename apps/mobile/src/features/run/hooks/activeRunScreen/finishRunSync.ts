// What happens after a run is saved on the phone: refresh the player's home area,
// sync to the server, tick off the plan session, fire funnel events, post to the feed.
import * as Location from 'expo-location';
import { postRunSync, createFeedPost } from '@shared/services/sync';
import { getPlayer, savePlayer, getRunById } from '@shared/services/store';
import { track } from '@shared/services/analytics';
import { tierForArea } from '@shared/engine/runEngine';
import { sportFor } from '../../constants/activities';
import { recordRunAgainstPlan } from '@features/training/services/planService';
import { fmtDuration } from '@shared/engine/training';
import { captureHandledError } from '@shared/services/errorReporting';
import type { ActiveRun, LatLng, ShowToast } from '../../utils/activeRunTypes';

interface Args {
  result: NonNullable<Awaited<ReturnType<ActiveRun['finishRun']>>>;
  elapsedSec: number;
  avgPace: string;
  routePoints: LatLng[];
  activityType: string;
  showToast: ShowToast;
}

/** Fire-and-forget: the summary screen is already open while this runs. */
export function syncFinishedRun({ result, elapsedSec, avgPace, routePoints, activityType, showToast }: Args): void {
  void (async () => {
    try {
      const lastPt = result.gpsPoints[result.gpsPoints.length - 1];
      if (lastPt) {
        const [address] = await Location.reverseGeocodeAsync({ latitude: lastPt.lat, longitude: lastPt.lng });
        const player = await getPlayer();
        if (player) {
          await savePlayer({
            ...player,
            // Rounded to about 1 km: a run usually ends at the runner's door,
            // and this is what the server keeps as their home area.
            lastKnownLocation: { lat: Math.round(lastPt.lat * 100) / 100, lng: Math.round(lastPt.lng * 100) / 100 },
            country: address?.country ?? player.country ?? null,
          });
        }
      }
    } catch {
      // non-critical — location/country refresh is best-effort
    }
    const { ok } = await postRunSync();
    if (!ok) {
      showToast({ message: 'Sync failed — run saved locally, will retry when online', type: 'warning', duration: 6000 });
    }
    if (result.run) {
      const { id: runId, distanceMeters } = result.run;
      // Tick off the matching plan session (on-foot only; best-effort, never blocks).
      if (sportFor(activityType).claims) {
        recordRunAgainstPlan({ runId, startTime: result.run.startTime ?? Date.now(), distanceKm: distanceMeters / 1000, durationSec: elapsedSec })
          .then(({ session, fasterFiveK }) => {
            if (fasterFiveK) showToast({ message: `You're getting faster: plan paces updated (5K ${fmtDuration(fasterFiveK)})`, type: 'success', duration: 6000 });
            else if (session) showToast({ message: `Plan: ${session.title} done`, type: 'success' });
          })
          .catch(err => captureHandledError(err, { domain: 'run', operation: 'record-run-against-plan' }));
      }
      // CRITICAL PATH (adjacent to finishRun/postRunSync): funnel events, fired after
      // sync so they can't add latency to it. No GPS/lat-lng in properties — ever.
      track('run_completed', {
        distanceKm:   distanceMeters / 1000,
        durationSec:  elapsedSec,
        activityType,
      });
      if (result.territory) {
        track('territory_claimed', {
          territoryTier:   result.territory.tier,
          territoryAreaM2: result.territory.areaM2,
        });
      }
      if ((result.paceEarned ?? 0) > 0) {
        track('pace_earned', { paceEarned: result.paceEarned });
      }
      // Sync has finished by now, so the server's PACE is on the stored run
      // (cap and verified distance applied); the feed card shows that one.
      const stored = ok ? await getRunById(runId).catch(() => undefined) : undefined;
      const scored = stored?.serverProcessed === true;
      const feedPace = scored && typeof stored.xpEarned === 'number' ? stored.xpEarned : result.paceEarned;
      // The feed shows what the server decided, not the phone's preview: a
      // run it rejected or that gained no new ground posts no zone.
      const verdict = scored ? stored.serverResult : undefined;
      const zones = verdict ? verdict.newZones + verdict.stolenZones : (result.territory ? 1 : 0);
      const zoneArea = verdict ? (verdict.claimedAreaM2 ?? 0) : (result.territory?.areaM2 ?? 0);
      createFeedPost(
        runId,
        distanceMeters / 1000,
        zones,
        {
          paceEarned:      feedPace,
          territoryTier:   zones > 0 && zoneArea > 0 ? tierForArea(zoneArea) : (verdict ? null : result.territory?.tier ?? null),
          territoryAreaM2: zones > 0 && zoneArea > 0 ? zoneArea : (verdict ? null : result.territory?.areaM2 ?? null),
          runnerRank:      result.runnerRank,
          durationSec:     elapsedSec,
          avgPace:         avgPace,
          activityType:    activityType,
          routePoints:     routePoints,
        },
      ).catch(() => {});
    }
  })().catch(() => {});
}
