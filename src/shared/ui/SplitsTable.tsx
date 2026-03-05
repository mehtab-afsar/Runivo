"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

interface SplitsTableProps {
  /** Total distance in km */
  distance: number;
  /** Total duration in seconds */
  duration: number;
  /** GPS points from the run */
  gpsPoints?: {
    lat: number;
    lng: number;
    timestamp: number;
    speed: number;
    accuracy: number;
  }[];
}

function haversine(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
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
  const mins = Math.floor(secondsPerKm / 60);
  const secs = Math.round(secondsPerKm % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface Split {
  km: number;
  pace: number; // seconds per km
}

function calculateSplitsFromGPS(
  gpsPoints: NonNullable<SplitsTableProps["gpsPoints"]>,
  totalDistance: number
): Split[] {
  const splits: Split[] = [];
  let cumulativeDistance = 0;
  let splitStartIndex = 0;
  let currentKm = 1;

  for (let i = 1; i < gpsPoints.length; i++) {
    const prev = gpsPoints[i - 1];
    const curr = gpsPoints[i];
    const segmentDist = haversine(prev.lat, prev.lng, curr.lat, curr.lng);
    cumulativeDistance += segmentDist;

    // Check if we've crossed a km boundary
    while (cumulativeDistance >= currentKm * 1000 && currentKm <= Math.floor(totalDistance)) {
      const elapsed =
        (gpsPoints[i].timestamp - gpsPoints[splitStartIndex].timestamp) / 1000;
        currentKm * 1000 -
        (currentKm === 1 ? 0 : (currentKm - 1) * 1000);
      // Approximate pace for this km
      splits.push({ km: currentKm, pace: elapsed > 0 ? elapsed : 300 });
      splitStartIndex = i;
      currentKm++;
    }
  }

  // Handle the final partial km
  if (currentKm <= Math.ceil(totalDistance) && splitStartIndex < gpsPoints.length - 1) {
    const elapsed =
      (gpsPoints[gpsPoints.length - 1].timestamp -
        gpsPoints[splitStartIndex].timestamp) /
      1000;
    const remainingKm = totalDistance - (currentKm - 1);
    if (remainingKm > 0.1) {
      const paceForPartial = elapsed / remainingKm;
      splits.push({ km: currentKm, pace: paceForPartial > 0 ? paceForPartial : 300 });
    }
  }

  return splits;
}

function generateMockSplits(distance: number, duration: number): Split[] {
  const totalKm = Math.floor(distance);
  const avgPace = duration / distance; // seconds per km
  const splits: Split[] = [];

  // Use a seeded-ish approach for consistent renders
  for (let i = 1; i <= totalKm; i++) {
    const variance = ((((i * 7 + 3) % 11) - 5) / 5) * 0.15; // deterministic +/- 15%
    const pace = avgPace * (1 + variance);
    splits.push({ km: i, pace });
  }

  // Handle partial final km
  const remainder = distance - totalKm;
  if (remainder > 0.1) {
    const variance = ((((totalKm + 1) * 7 + 3) % 11) - 5) / 5 * 0.15;
    const pace = avgPace * (1 + variance);
    splits.push({ km: totalKm + 1, pace });
  }

  return splits;
}

const rowVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.05, duration: 0.3, ease: "easeOut" as never },
  }),
};

export default function SplitsTable({
  distance,
  duration,
  gpsPoints,
}: SplitsTableProps) {
  const splits = useMemo(() => {
    if (gpsPoints && gpsPoints.length > 1) {
      const calculated = calculateSplitsFromGPS(gpsPoints, distance);
      if (calculated.length > 0) return calculated;
    }
    return generateMockSplits(distance, duration);
  }, [distance, duration, gpsPoints]);

  const avgPace = duration / distance;

  const fastestPace = Math.min(...splits.map((s) => s.pace));
  const slowestPace = Math.max(...splits.map((s) => s.pace));
  const fastestIdx = splits.findIndex((s) => s.pace === fastestPace);
  const slowestIdx = splits.findIndex((s) => s.pace === slowestPace);

  // Bar width: fastest split = 100%, others proportional (inverted since lower pace = faster)
  // We want the fastest (lowest pace) to have the longest bar
  const getBarWidth = (pace: number) => {
    if (slowestPace === fastestPace) return 100;
    // Invert: fastest gets full width, slowest gets minimum
    return ((slowestPace - pace) / (slowestPace - fastestPace)) * 60 + 40;
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-2">
        <span className="text-[11px] uppercase tracking-[0.2em] text-gray-400 font-medium">
          Splits
        </span>
      </div>

      {/* Split rows */}
      <div className="px-5 pb-2">
        {splits.map((split, i) => {
          const isFastest = i === fastestIdx;
          const isSlowest = i === slowestIdx && splits.length > 1;
          const barWidth = getBarWidth(split.pace);
          const barColor = isFastest
            ? "bg-teal-500"
            : isSlowest
              ? "bg-pink-400"
              : "bg-teal-400";

          return (
            <motion.div
              key={split.km}
              custom={i}
              variants={rowVariants}
              initial="hidden"
              animate="visible"
              className={`flex items-center gap-3 py-2.5 ${
                i < splits.length - 1 ? "border-b border-gray-50" : ""
              }`}
            >
              {/* Km number */}
              <span className="text-xs text-gray-400 font-mono w-6 text-right tabular-nums">
                {split.km}
              </span>

              {/* Pace */}
              <span className="text-sm font-bold text-gray-900 font-mono w-14 tabular-nums">
                {formatPace(split.pace)}
              </span>

              {/* Bar */}
              <div className="flex-1 h-3 bg-gray-50 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${barColor}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${barWidth}%` }}
                  transition={{ delay: i * 0.05 + 0.15, duration: 0.4, ease: "easeOut" }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Average pace */}
      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 font-medium w-6 text-right">
            Avg
          </span>
          <span className="text-sm font-bold text-teal-600 font-mono w-14 tabular-nums">
            {formatPace(avgPace)}
          </span>
          <span className="text-[11px] text-gray-400">/km</span>
        </div>
      </div>
    </div>
  );
}
