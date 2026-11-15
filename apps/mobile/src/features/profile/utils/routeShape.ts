/** Route shapes for the You → Gallery tiles. Pure, so it's unit-tested. */
const MAX_PTS = 80;

/** The route squeezed into a size × size box, keeping its proportions. */
export function routePolyline(points: { lat: number; lng: number }[], size: number, pad = 12): string | null {
  if (points.length < 2) return null;
  const step = Math.max(1, Math.floor(points.length / MAX_PTS));
  const pts = points.filter((_, i) => i % step === 0 || i === points.length - 1);
  const midLat = pts.reduce((n, p) => n + p.lat, 0) / pts.length;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const xs = pts.map(p => p.lng * kx);
  const ys = pts.map(p => -p.lat);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY);
  if (!(span > 0)) return null;
  const scale = (size - pad * 2) / span;
  const offX = (size - (maxX - minX) * scale) / 2;
  const offY = (size - (maxY - minY) * scale) / 2;
  return pts.map((_, i) => `${(offX + (xs[i] - minX) * scale).toFixed(1)},${(offY + (ys[i] - minY) * scale).toFixed(1)}`).join(' ');
}
