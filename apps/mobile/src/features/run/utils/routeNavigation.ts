export interface RouteProgress {
  closestIdx:          number;
  distanceToRouteM:    number;
  distanceRemainingM:  number;
}

function haversineM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const aa = sinLat * sinLat
    + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
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
