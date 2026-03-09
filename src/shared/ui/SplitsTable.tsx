import { useMemo } from "react";
import { motion } from "framer-motion";

interface SplitsTableProps {
  distance: number;
  duration: number;
  gpsPoints?: {
    lat: number;
    lng: number;
    timestamp: number;
    speed: number;
    accuracy: number;
  }[];
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatPace(secondsPerKm: number): string {
  if (!isFinite(secondsPerKm) || secondsPerKm <= 0) return "--:--";
  const mins = Math.floor(secondsPerKm / 60);
  const secs = Math.round(secondsPerKm % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatElapsed(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface Split {
  km: number;
  pace: number;      // seconds per km
  elapsed: number;   // seconds for this split
  partial?: boolean;
}

function calculateSplitsFromGPS(
  gpsPoints: NonNullable<SplitsTableProps["gpsPoints"]>,
  totalDistance: number
): Split[] {
  if (gpsPoints.length < 2) return [];

  const splits: Split[] = [];
  let cumulativeDistance = 0;
  let splitStartIndex = 0;
  let currentKm = 1;

  for (let i = 1; i < gpsPoints.length; i++) {
    const prev = gpsPoints[i - 1];
    const curr = gpsPoints[i];
    const segmentDist = haversine(prev.lat, prev.lng, curr.lat, curr.lng);
    cumulativeDistance += segmentDist;

    while (cumulativeDistance >= currentKm * 1000 && currentKm <= Math.floor(totalDistance)) {
      const elapsed = (gpsPoints[i].timestamp - gpsPoints[splitStartIndex].timestamp) / 1000;
      splits.push({ km: currentKm, pace: elapsed > 0 ? elapsed : 0, elapsed });
      splitStartIndex = i;
      currentKm++;
    }
  }

  // Partial final km
  if (splitStartIndex < gpsPoints.length - 1) {
    const remainingKm = totalDistance - (currentKm - 1);
    if (remainingKm > 0.05) {
      const elapsed = (gpsPoints[gpsPoints.length - 1].timestamp - gpsPoints[splitStartIndex].timestamp) / 1000;
      const pace = elapsed > 0 && remainingKm > 0 ? elapsed / remainingKm : 0;
      splits.push({ km: currentKm, pace, elapsed, partial: true });
    }
  }

  return splits;
}

export default function SplitsTable({ distance, duration, gpsPoints }: SplitsTableProps) {
  const splits = useMemo(() => {
    if (!gpsPoints || gpsPoints.length < 2 || distance <= 0) return [];
    return calculateSplitsFromGPS(gpsPoints, distance);
  }, [distance, duration, gpsPoints]);

  if (splits.length === 0) return null;

  const avgPace = duration > 0 && distance > 0 ? duration / distance : 0;
  const fastestPace = Math.min(...splits.map(s => s.pace).filter(p => p > 0));
  const slowestPace = Math.max(...splits.map(s => s.pace).filter(p => p > 0));

  const getBarWidth = (pace: number) => {
    if (slowestPace === fastestPace || pace <= 0) return 60;
    return ((slowestPace - pace) / (slowestPace - fastestPace)) * 55 + 35;
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-5 pt-4 pb-3 border-b border-gray-100">
        <span className="text-[11px] uppercase tracking-[0.2em] text-gray-400 font-medium flex-1">Splits</span>
        <span className="text-[10px] text-gray-300 uppercase tracking-wider">km</span>
        <span className="text-[10px] text-gray-300 uppercase tracking-wider w-14 text-right">pace</span>
        <span className="text-[10px] text-gray-300 uppercase tracking-wider w-12 text-right">time</span>
      </div>

      {/* Rows */}
      <div className="px-5 py-1">
        {splits.map((split, i) => {
          const isFastest = split.pace === fastestPace && splits.length > 1;
          const isSlowest = split.pace === slowestPace && splits.length > 1;
          const barWidth = getBarWidth(split.pace);

          return (
            <motion.div
              key={split.km}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.04, duration: 0.25 }}
              className={`flex items-center gap-3 py-2.5 ${i < splits.length - 1 ? "border-b border-gray-50" : ""}`}
            >
              {/* Km number */}
              <span className="text-[11px] text-gray-300 font-mono w-5 text-right tabular-nums shrink-0">
                {split.partial ? `~${split.km}` : split.km}
              </span>

              {/* Bar — neutral gray, thin */}
              <div className="flex-1 h-[3px] bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gray-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${barWidth}%` }}
                  transition={{ delay: i * 0.04 + 0.1, duration: 0.35, ease: "easeOut" }}
                />
              </div>

              {/* Pace */}
              <span className={`text-sm font-bold font-mono tabular-nums w-14 text-right ${
                isFastest ? "text-teal-600" : isSlowest ? "text-gray-400" : "text-gray-900"
              }`}>
                {formatPace(split.pace)}
              </span>

              {/* Elapsed time */}
              <span className="text-[11px] text-gray-400 font-mono tabular-nums w-12 text-right">
                {formatElapsed(split.elapsed)}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Average row */}
      {avgPace > 0 && (
        <div className="flex items-center gap-3 px-5 py-3 border-t border-gray-100 bg-gray-50/40">
          <span className="text-[11px] text-gray-400 w-5 text-right">—</span>
          <div className="flex-1" />
          <span className="text-xs font-semibold text-gray-500 font-mono tabular-nums w-14 text-right">
            {formatPace(avgPace)}
          </span>
          <span className="text-[10px] text-gray-300 w-12 text-right uppercase tracking-wider">avg</span>
        </div>
      )}
    </div>
  );
}
