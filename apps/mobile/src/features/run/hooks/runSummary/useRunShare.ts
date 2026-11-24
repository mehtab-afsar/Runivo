import { useRef } from 'react';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { appAlert } from '@mobile/shared/components/AppAlert';
import { buildRunCardSvg, RUN_CARD_W, RUN_CARD_H } from '@mobile/shared/lib/runCard';
import { svgToPngFile } from '@mobile/shared/components/CaptureHost';
import { convertKm, convertPaceMinPerKm } from '@mobile/shared/lib/formatters';
import { visibleRoute, type MapVisibility } from '@shared/services/mapVisibility';
import type { StoredRun } from '@shared/services/store';
import { buildRouteStickerSvg } from '../../services/storyCardGenerator';
import type { PngCaptureHandle } from '../../components/PngCapture';
import type { Sport } from '../../constants/activities';
import type { PassedRunData } from '../useRunSummary';
import type { RunSummaryNav } from '../../utils/runSummaryTypes';
import { fmt, pace, rideSpeed } from '../../utils/runSummaryFormatters';

interface Params {
  runId: string;
  runData: PassedRunData;
  ride: boolean;
  sport: Sport;
  headline: string;
  startMs: number;
  stored: StoredRun | null;
  /** Name on the share card. */
  displayName: string;
  calories: number | null;
  distanceUnit: 'km' | 'mi';
  /** What others may see of the route: the runner's rule plus this activity's switch. */
  mapVisibility: MapVisibility;
  zoneCount: number;
  navigation: RunSummaryNav;
}

/** Share the story card, the transparent route sticker, or open the replay. */
export function useRunShare(p: Params) {
  const { runId, runData, ride, sport, headline, startMs, stored, displayName, calories, distanceUnit, mapVisibility, zoneCount, navigation } = p;
  // Off-screen renderer that turns the story card into a PNG for sharing.
  const storyCaptureRef = useRef<PngCaptureHandle>(null);

  const shareFile = async (make: () => Promise<string>, title: string) => {
    const available = await Sharing.isAvailableAsync();
    if (!available) { appAlert('Sharing not available on this device'); return; }
    try {
      const fileUri = await make();
      await Sharing.shareAsync(fileUri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: title });
    } catch {
      appAlert('Could not share', 'Please try again.');
    }
  };
  const openReplay = (runData.route?.length ?? 0) >= 2
    ? () => navigation.navigate('RunReplay', { runId, route: (runData.route ?? []).map(pt => ({ lat: pt.lat, lng: pt.lng })), durationSec: runData.duration, pace: runData.pace })
    : undefined;
  const visible = () => visibleRoute(runData.route ?? [], mapVisibility);

  /** Route and numbers on a transparent PNG (1080 × 1350), to lay over a photo. */
  const writeRouteSticker = async () => {
    const svg = buildRouteStickerSvg({
      route: visible(),
      stats: [
        { label: distanceUnit, value: convertKm(runData.distance, distanceUnit).toFixed(2) },
        ride
          ? { label: `${distanceUnit}/h`, value: rideSpeed(runData.distance, runData.duration, distanceUnit) }
          : { label: `/${distanceUnit}`, value: pace(convertPaceMinPerKm(runData.pace, distanceUnit)) },
        { label: 'time', value: fmt(runData.duration) },
        ...(calories != null ? [{ label: 'kcal', value: String(calories) }] : []),
      ],
    });
    const capture = storyCaptureRef.current;
    if (!capture) throw new Error('capture not ready');
    const base64 = await capture.capture(svg, { viewWidth: 400, viewHeight: 500, outWidth: 1080, outHeight: 1350 });
    const fileUri = FileSystem.cacheDirectory + `route_${runId}.png`;
    await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
    return fileUri;
  };
  // The story card: the same run card the feed shares, at story size (1080 × 1920).
  const writeStoryCard = async (name: string) => {
    const d = new Date(startMs);
    const svg = buildRunCardSvg({
      name: displayName || 'Runner',
      sub: `${sport.label} · ${d.getDate()} ${d.toLocaleDateString(undefined, { month: 'short' })}`,
      title: stored?.title || headline,
      stats: [
        { value: convertKm(runData.distance, distanceUnit).toFixed(2), label: distanceUnit },
        ride
          ? { value: rideSpeed(runData.distance, runData.duration, distanceUnit), label: `${distanceUnit}/h` }
          : { value: pace(convertPaceMinPerKm(runData.pace, distanceUnit)), label: `pace /${distanceUnit}` },
        { value: fmt(runData.duration), label: 'time' },
      ],
      // The share card shows only what others may see.
      route: visible(),
      zones: zoneCount,
    });
    return svgToPngFile(svg, { w: RUN_CARD_W, h: RUN_CARD_H, outW: 1080 }, name);
  };

  const shareStory = () => shareFile(() => writeStoryCard(`run_${runId}.png`), 'Share your run');
  const shareSticker = () => shareFile(writeRouteSticker, 'Share your route');
  /** Share: the full card, the transparent route sticker, or the replay. */
  const shareRun = () => {
    const options = ['Share card', 'Route sticker (transparent)', ...(openReplay ? ['Play the replay'] : []), 'Cancel'];
    const pick = (i: number) => {
      if (i === 0) shareStory();
      else if (i === 1) shareSticker();
      else if (i === 2 && openReplay) openReplay();
    };
    appAlert('Share', undefined, [
      ...options.slice(0, -1).map((label, i) => ({ text: label, onPress: () => pick(i) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  return { storyCaptureRef, openReplay, shareRun, shareStory, shareSticker };
}
