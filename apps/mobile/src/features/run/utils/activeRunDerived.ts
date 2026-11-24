// Pure derivations behind the live run banners and the "close the loop" row.
import { ENGINE } from '@shared/engine/runEngine';
import type { RouteProgress } from './routeNavigation';
import { fmtArea } from './activeRunFormatters';
import type { LiveBanner, LoopRowData } from './activeRunTypes';

export interface BannerInput {
  isRunning: boolean;
  speedWarning: boolean;
  /** Whether this sport claims territory (rides are tracked only). */
  claims: boolean;
  loopClosing: boolean;
  nearRival: boolean;
  isOffRoute: boolean;
  isNearRouteEnd: boolean;
  routeProgress: RouteProgress | null;
}

/** One banner at a time, most urgent first. */
export function buildBanner(a: BannerInput): LiveBanner | null {
  return !a.isRunning ? null
    : a.speedWarning ? { text: a.claims ? "Too fast. This stretch won't earn territory" : "Too fast for a ride. This stretch won't count", tone: 'warn' }
    : a.loopClosing ? { text: 'Loop closing. Keep going to fill the zone', tone: 'own' }
    : a.nearRival ? { text: 'Rival territory ahead', tone: 'rival' }
    : a.isOffRoute ? { text: 'Off route. Head back to the dashed line', tone: 'warn' }
    : a.isNearRouteEnd ? { text: `Almost there. ${Math.round(a.routeProgress!.distanceRemainingM)} m to go`, tone: 'good' }
    : null;
}

export interface LoopRowInput {
  claims: boolean;
  isRunning: boolean;
  pointCount: number;
  distanceKm: number;
  loopClosing: boolean;
  nearStartStripOnly: boolean;
  liveAreaM2: number;
  toStartM: number;
  farthestM: number;
}

/** Close the loop: distance back to the start, once the run can claim. */
export function buildLoopRow(a: LoopRowInput): LoopRowData | null {
  return !a.claims || !a.isRunning || a.pointCount < 2 ? null
    : a.distanceKm * 1000 < ENGINE.MIN_TERRITORY_DIST_M
      ? {
          label: 'Run 200 m to start claiming',
          detail: `${Math.max(0, Math.round(ENGINE.MIN_TERRITORY_DIST_M - a.distanceKm * 1000))} m to go`,
          pct: (a.distanceKm * 1000) / ENGINE.MIN_TERRITORY_DIST_M,
        }
      : a.loopClosing
        ? { label: 'Loop closed', detail: a.liveAreaM2 > 0 ? `${fmtArea(a.liveAreaM2)} on finish` : 'The ground inside is yours on finish', pct: 1 }
        : a.nearStartStripOnly
        ? { label: 'Strip only', detail: `This route claims the street you ran${a.liveAreaM2 > 0 ? ` · ${fmtArea(a.liveAreaM2)}` : ''}. Loops up to about 2.5 km round fill in.`, pct: 1 }
        : {
            label: 'Close the loop to claim',
            detail: `${a.toStartM >= 1000 ? `${(a.toStartM / 1000).toFixed(1)} km` : `${Math.round(a.toStartM)} m`} to go${a.liveAreaM2 > 0 ? ` · ${fmtArea(a.liveAreaM2)}` : ''}`,
            pct: a.farthestM > 0 ? 1 - a.toStartM / a.farthestM : 0,
          };
}
