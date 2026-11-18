/**
 * The route sticker (transparent, for laying over a photo). The run card
 * itself lives in shared/lib/runCard.ts.
 */

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Route sticker ────────────────────────────────────────────────────────────

export interface RouteStickerData {
  route: { lat: number; lng: number }[];
  stats: { label: string; value: string }[];
}

/**
 * The route and a few numbers on a transparent background (400 × 500), for
 * laying over a photo or a story, like Strava's stats sticker. White with a
 * soft dark edge, so it reads on light and dark pictures alike.
 */
export function buildRouteStickerSvg(data: RouteStickerData): string {
  const W = 400, H = 500, MAP = 320;
  const pts = data.route.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  let path = '';
  let start = '', end = '';
  if (pts.length >= 2) {
    const midLat = (Math.min(...pts.map(p => p.lat)) + Math.max(...pts.map(p => p.lat))) / 2;
    const k = Math.cos((midLat * Math.PI) / 180);
    const xs = pts.map(p => p.lng * k), ys = pts.map(p => p.lat);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const span = Math.max(maxX - minX, maxY - minY) || 1e-4;
    const pad = 28;
    const scale = (MAP - pad * 2) / span;
    const ox = (W - (maxX - minX) * scale) / 2;
    const oy = pad + (MAP - pad * 2 - (maxY - minY) * scale) / 2;
    const xy = pts.map((p, i) => [ox + (xs[i] - minX) * scale, oy + (maxY - ys[i]) * scale]);
    path = 'M ' + xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ');
    const [sx, sy] = xy[0], [ex, ey] = xy[xy.length - 1];
    start = `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="7" fill="#FFFFFF" stroke="rgba(0,0,0,0.35)" stroke-width="2"/>`;
    end = `<circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="7" fill="#7DBA3C" stroke="#FFFFFF" stroke-width="3"/>`;
  }
  const n = Math.max(1, data.stats.length);
  const colW = W / n;
  const stats = data.stats.map((st, i) => {
    const cx = colW * i + colW / 2;
    const label = escapeXml(st.label.toUpperCase());
    const value = escapeXml(st.value);
    // A dark halo (a stroked copy underneath), so white text reads on light photos too.
    const halo = 'fill="rgba(0,0,0,0.45)" stroke="rgba(0,0,0,0.45)" stroke-width="5" stroke-linejoin="round"';
    return `
      <text x="${cx}" y="${MAP + 72}" text-anchor="middle" font-family="Outfit_600SemiBold" font-size="36" ${halo}>${value}</text>
      <text x="${cx}" y="${MAP + 72}" text-anchor="middle" font-family="Outfit_600SemiBold" font-size="36" fill="#FFFFFF">${value}</text>
      <text x="${cx}" y="${MAP + 104}" text-anchor="middle" font-family="Outfit_600SemiBold" font-size="14" letter-spacing="1.5" ${halo.replace('stroke-width="5"', 'stroke-width="4"')}>${label}</text>
      <text x="${cx}" y="${MAP + 104}" text-anchor="middle" font-family="Outfit_600SemiBold" font-size="14" letter-spacing="1.5" fill="#FFFFFF">${label}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${path ? `<path d="${path}" fill="none" stroke="rgba(0,0,0,0.45)" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${path}" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
    ${start}${end}
    ${stats}
  </svg>`;
}
