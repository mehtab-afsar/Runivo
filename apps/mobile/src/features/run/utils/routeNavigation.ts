import { haversineM } from '@shared/services/claimEngine';

export interface RouteProgress {
  closestIdx:          number;
  distanceToRouteM:    number;
  distanceRemainingM:  number;
}

export function computeRouteProgress(
  runnerLat: number,
  runnerLng: number,
  routePoints: { lat: number; lng: number }[],
): RouteProgress {
  if (routePoints.length < 2) {
    return { closestIdx: 0, distanceToRouteM: 0, distanceRemainingM: 0 };
  }
  const runner = { lat: runnerLat, lng: runnerLng };

  let closestIdx = 0;
  let minDist = Infinity;
  for (let i = 0; i < routePoints.length; i++) {
    const d = haversineM(runner, routePoints[i]);
    if (d < minDist) { minDist = d; closestIdx = i; }
  }

  let distanceRemainingM = 0;
  for (let i = closestIdx; i < routePoints.length - 1; i++) {
    distanceRemainingM += haversineM(routePoints[i], routePoints[i + 1]);
  }

  return {
    closestIdx,
    distanceToRouteM:   minDist,
    distanceRemainingM,
  };
}
