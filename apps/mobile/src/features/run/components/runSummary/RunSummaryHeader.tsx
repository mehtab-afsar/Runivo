import React from 'react';
import { convertKm, convertPaceMinPerKm } from '@mobile/shared/lib/formatters';
import type { StoredRun } from '@shared/services/store';
import RunSummaryHero from '../RunSummaryHero';
import type { Sport } from '../../constants/activities';
import type { PassedRunData } from '../../hooks/useRunSummary';
import type { ExtraStat, PrLine } from '../../utils/runSummaryTypes';
import { capFirst, fmt, pace, rideSpeed } from '../../utils/runSummaryFormatters';

interface Props {
  topInset: number;
  sport: Sport;
  ride: boolean;
  runData: PassedRunData;
  stored: StoredRun | null;
  headline: string;
  finishLabel: string;
  terr: PassedRunData['territory'];
  zoneLabel: string | null;
  stolen: number;
  distanceUnit: 'km' | 'mi';
  authorName?: string;
  authorPhoto: string | null;
  whenLine: string;
  prLine: PrLine | null;
  extraStats: ExtraStat[];
  onClose: () => void;
  onShare: () => void;
  onOpenMap: () => void;
  onReplay?: () => void;
}

/** Top of the summary: the hero map card with title, who/when, and the headline stats. */
export default function RunSummaryHeader({
  topInset, sport, ride, runData, stored, headline, finishLabel, terr, zoneLabel, stolen, distanceUnit,
  authorName, authorPhoto, whenLine, prLine, extraStats, onClose, onShare, onOpenMap, onReplay,
}: Props) {
  return (
    <RunSummaryHero
      topInset={topInset}
      eyebrow={`${capFirst(sport.verb)} complete · ${finishLabel}`}
      headline={stored?.title || headline}
      route={runData.route ?? []}
      zoneRing={ride ? null : (terr?.polygon ?? null)}
      zoneLabel={zoneLabel}
      stolenLabel={stolen > 0 ? `Stole ${stolen} zone${stolen === 1 ? '' : 's'}` : null}
      distance={convertKm(runData.distance, distanceUnit).toFixed(2)}
      time={fmt(runData.duration)}
      pace={ride
        ? rideSpeed(runData.distance, runData.duration, distanceUnit)
        : pace(convertPaceMinPerKm(runData.pace, distanceUnit))}
      paceLabel={ride ? `Avg ${distanceUnit}/h` : undefined}
      unit={distanceUnit}
      onClose={onClose}
      onShare={onShare}
      sportLabel={sport.label}
      authorName={authorName}
      authorPhoto={authorPhoto}
      whenLine={whenLine}
      description={stored?.description || undefined}
      pr={prLine}
      extraStats={extraStats}
      onOpenMap={onOpenMap}
      // The replay screen was built but never linked: the button only
      // shows when this is passed.
      onReplay={onReplay}
    />
  );
}
