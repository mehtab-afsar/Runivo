/**
 * The run share card: route, three numbers and the runner, on Runivo lime at
 * story size (9:16). Same family as the profile card. Built as SVG and turned
 * into a PNG by the capture host, so it shares as a picture, not text.
 */

export interface RunCardData {
  name: string;
  /** "Evening run · 18 Nov" */
  sub: string;
  title: string;
  stats: { value: string; label: string }[];
  route: { lat: number; lng: number }[];
  /** Zones claimed on the run; shown as a chip when above zero. */
  zones?: number;
}

export const RUN_CARD_W = 400;
export const RUN_CARD_H = 711;

const INK = '#17181A', LIME = '#C9F06B', GREY = '#6B6E68', MAP = '#EEF0EA';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function hex(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

/** The route fitted into a box, north up, with even scale on both axes. */
export function routePath(route: { lat: number; lng: number }[], x: number, y: number, w: number, h: number, pad = 26): { d: string; start: [number, number]; end: [number, number] } | null {
  const pts = route.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (pts.length < 2) return null;
  const midLat = (Math.min(...pts.map(p => p.lat)) + Math.max(...pts.map(p => p.lat))) / 2;
  const k = Math.cos((midLat * Math.PI) / 180);
  const xs = pts.map(p => p.lng * k), ys = pts.map(p => p.lat);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = maxX - minX || 1e-5, spanY = maxY - minY || 1e-5;
  const scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY);
  const ox = x + (w - spanX * scale) / 2, oy = y + (h - spanY * scale) / 2;
  const xy = pts.map((_, i) => [ox + (xs[i] - minX) * scale, oy + (maxY - ys[i]) * scale] as [number, number]);
  return { d: 'M' + xy.map(([a, b]) => `${a.toFixed(1)} ${b.toFixed(1)}`).join('L'), start: xy[0], end: xy[xy.length - 1] };
}

export function buildRunCardSvg(d: RunCardData): string {
  const zones = d.zones ?? 0;
  const cx = 30, cy = 90, cw = 340, ch = zones > 0 ? 540 : 490;
  const initials = d.name.replace(/[^a-z0-9 ]/gi, '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'R';
  const mx = cx + 20, my = cy + 140, mw = cw - 40, mh = 250;
  const r = routePath(d.route, mx, my, mw, mh);
  const grid = Array.from({ length: 5 }, (_, i) => `<line x1="${mx}" y1="${my + (i + 1) * mh / 6}" x2="${mx + mw}" y2="${my + (i + 1) * mh / 6}" stroke="#FFFFFF" stroke-width="5"/>`
    + `<line x1="${mx + (i + 1) * mw / 6}" y1="${my}" x2="${mx + (i + 1) * mw / 6}" y2="${my + mh}" stroke="#FFFFFF" stroke-width="5"/>`).join('');
  const stats = d.stats.slice(0, 3);
  const colW = cw / Math.max(1, stats.length);
  const statY = my + mh + 46;

  const chipTxt = `+${zones} ${zones === 1 ? 'zone' : 'zones'} claimed`;
  const chipW = 48 + chipTxt.length * 7.4;
  const chipY = statY + 46;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${RUN_CARD_W} ${RUN_CARD_H}" width="${RUN_CARD_W}" height="${RUN_CARD_H}">
  <defs><clipPath id="map"><rect x="${mx}" y="${my}" width="${mw}" height="${mh}" rx="22"/></clipPath></defs>
  <rect width="${RUN_CARD_W}" height="${RUN_CARD_H}" fill="${LIME}"/>
  <polygon points="${hex(RUN_CARD_W / 2, 50, 13)}" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
  <rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" rx="34" fill="#FFFFFF"/>
  <circle cx="${cx + 44}" cy="${cy + 44}" r="22" fill="${INK}"/>
  <text x="${cx + 44}" y="${cy + 50}" font-family="Outfit_600SemiBold" font-size="16" fill="${LIME}" text-anchor="middle">${esc(initials)}</text>
  <text x="${cx + 78}" y="${cy + 40}" font-family="Outfit_600SemiBold" font-size="17" fill="${INK}">${esc(cut(d.name, 24))}</text>
  <text x="${cx + 78}" y="${cy + 60}" font-family="Outfit_400Regular" font-size="13" fill="${GREY}">${esc(cut(d.sub, 34))}</text>
  <text x="${cx + 22}" y="${cy + 116}" font-family="Outfit_600SemiBold" font-size="26" fill="${INK}">${esc(cut(d.title, 22))}</text>
  <g clip-path="url(#map)">
    <rect x="${mx}" y="${my}" width="${mw}" height="${mh}" fill="${MAP}"/>
    ${grid}
  </g>
  ${r
    ? `<path d="${r.d}" fill="none" stroke="#FFFFFF" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${r.d}" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${r.start[0].toFixed(1)}" cy="${r.start[1].toFixed(1)}" r="7" fill="#FFFFFF" stroke="${INK}" stroke-width="3"/>
  <circle cx="${r.end[0].toFixed(1)}" cy="${r.end[1].toFixed(1)}" r="8" fill="${LIME}" stroke="${INK}" stroke-width="3"/>`
    : `<polygon points="${hex(mx + mw / 2, my + mh / 2, 46)}" fill="none" stroke="${INK}" stroke-opacity="0.25" stroke-width="5" stroke-linejoin="round"/>`}
  ${zones > 0 ? `<rect x="${(RUN_CARD_W - chipW) / 2}" y="${chipY}" width="${chipW}" height="32" rx="16" fill="${INK}"/>
  <polygon points="${hex((RUN_CARD_W - chipW) / 2 + 20, chipY + 16, 7)}" fill="${LIME}"/>
  <text x="${(RUN_CARD_W - chipW) / 2 + 34}" y="${chipY + 21}" font-family="Outfit_600SemiBold" font-size="13" fill="#FFFFFF">${chipTxt}</text>` : ''}
  ${stats.map((st, i) => {
    const x = cx + colW * i + colW / 2;
    return `<text x="${x}" y="${statY}" font-family="Outfit_600SemiBold" font-size="24" fill="${INK}" text-anchor="middle">${esc(st.value)}</text>
  <text x="${x}" y="${statY + 21}" font-family="Outfit_400Regular" font-size="12" fill="${GREY}" text-anchor="middle">${esc(st.label)}</text>`;
  }).join('')}
  ${stats.slice(1).map((_, i) => `<line x1="${cx + colW * (i + 1)}" y1="${statY - 24}" x2="${cx + colW * (i + 1)}" y2="${statY + 22}" stroke="#E7E8E3" stroke-width="1"/>`).join('')}
  <text x="${RUN_CARD_W / 2}" y="${cy + ch + 46}" font-family="Outfit_600SemiBold" font-size="22" fill="${INK}" text-anchor="middle">runivo</text>
  <text x="${RUN_CARD_W / 2}" y="${cy + ch + 68}" font-family="Outfit_400Regular" font-size="13" fill="${INK}" text-anchor="middle" opacity="0.7">Run. Claim your streets.</text>
</svg>`;
}

// ── Zone card ────────────────────────────────────────────────────────────────

export interface ZoneCardData {
  /** "Indiranagar 12th Main" */
  name: string;
  /** "Held by Test Runner" or "Held by tester1" */
  owner: string;
  isOwn: boolean;
  /** "Block", "District"… */
  tier: string;
  area: string;
  fresh: number;
  /** The zone's outline, [lng, lat]. */
  ring: [number, number][];
}

/** A zone as a share card: its shape filled on a map, name, size and freshness. */
export function buildZoneCardSvg(d: ZoneCardData): string {
  const cx = 30, cy = 90, cw = 340, ch = 500;
  const mx = cx + 20, my = cy + 120, mw = cw - 40, mh = 250;
  const r = routePath(d.ring.map(([lng, lat]) => ({ lat, lng })), mx, my, mw, mh, 34);
  const grid = Array.from({ length: 5 }, (_, i) => `<line x1="${mx}" y1="${my + (i + 1) * mh / 6}" x2="${mx + mw}" y2="${my + (i + 1) * mh / 6}" stroke="#FFFFFF" stroke-width="5"/>`
    + `<line x1="${mx + (i + 1) * mw / 6}" y1="${my}" x2="${mx + (i + 1) * mw / 6}" y2="${my + mh}" stroke="#FFFFFF" stroke-width="5"/>`).join('');
  const fill = d.isOwn ? '#7DBA3C' : '#F2A43A';
  const fresh = Math.max(0, Math.min(100, Math.round(d.fresh)));
  const statY = my + mh + 46;
  const stats: [string, string][] = [[d.area, 'area'], [d.tier, 'tier'], [`${fresh}%`, 'fresh']];
  const colW = cw / 3;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${RUN_CARD_W} ${RUN_CARD_H}" width="${RUN_CARD_W}" height="${RUN_CARD_H}">
  <defs><clipPath id="map"><rect x="${mx}" y="${my}" width="${mw}" height="${mh}" rx="22"/></clipPath></defs>
  <rect width="${RUN_CARD_W}" height="${RUN_CARD_H}" fill="${LIME}"/>
  <polygon points="${hex(RUN_CARD_W / 2, 50, 13)}" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
  <rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" rx="34" fill="#FFFFFF"/>
  <text x="${cx + 22}" y="${cy + 50}" font-family="Outfit_500Medium" font-size="13" fill="${GREY}">${esc(d.isOwn ? 'MY ZONE' : 'RIVAL ZONE')}</text>
  <text x="${cx + 22}" y="${cy + 80}" font-family="Outfit_600SemiBold" font-size="25" fill="${INK}">${esc(cut(d.name, 22))}</text>
  <text x="${cx + 22}" y="${cy + 102}" font-family="Outfit_400Regular" font-size="13" fill="${GREY}">${esc(cut(d.owner, 36))}</text>
  <g clip-path="url(#map)">
    <rect x="${mx}" y="${my}" width="${mw}" height="${mh}" fill="${MAP}"/>
    ${grid}
  </g>
  ${r
    ? `<path d="${r.d}Z" fill="${fill}" fill-opacity="0.35" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`
    : `<polygon points="${hex(mx + mw / 2, my + mh / 2, 70)}" fill="${fill}" fill-opacity="0.35" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`}
  ${stats.map(([v, l], i) => {
    const x = cx + colW * i + colW / 2;
    return `<text x="${x}" y="${statY}" font-family="Outfit_600SemiBold" font-size="22" fill="${INK}" text-anchor="middle">${esc(v)}</text>
  <text x="${x}" y="${statY + 21}" font-family="Outfit_400Regular" font-size="12" fill="${GREY}" text-anchor="middle">${l}</text>`;
  }).join('')}
  <line x1="${cx + colW}" y1="${statY - 24}" x2="${cx + colW}" y2="${statY + 22}" stroke="#E7E8E3" stroke-width="1"/>
  <line x1="${cx + colW * 2}" y1="${statY - 24}" x2="${cx + colW * 2}" y2="${statY + 22}" stroke="#E7E8E3" stroke-width="1"/>
  <text x="${RUN_CARD_W / 2}" y="${cy + ch + 46}" font-family="Outfit_600SemiBold" font-size="22" fill="${INK}" text-anchor="middle">${d.isOwn ? 'Come and take it.' : 'I’m coming for it.'}</text>
  <text x="${RUN_CARD_W / 2}" y="${cy + ch + 70}" font-family="Outfit_400Regular" font-size="13" fill="${INK}" text-anchor="middle" opacity="0.7">runivo · run, claim your streets</text>
</svg>`;
}
