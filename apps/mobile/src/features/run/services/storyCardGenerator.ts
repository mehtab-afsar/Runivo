/**
 * storyCardGenerator — generates a run story card as a base64-encoded PNG data URL.
 * Uses an SVG template (no native module required). The SVG is base64-encoded
 * and uploaded as-is via storiesService (Supabase accepts SVG blobs too).
 */

interface StoryCardData {
  distance: string;   // e.g. "5.32"
  duration: string;   // e.g. "27:14"
  pace: string;       // e.g. "5:07"
  paceEarned: number;
  heading: string;    // e.g. "Run Complete"
  actionType?: string;
  route?: { lat: number; lng: number }[];
  runnerRank?: string;
  username?: string;
}

/**
 * Build a minimal SVG story card and return it as a data URL.
 * 400×700 vertical card — matches web story dimensions.
 */
function buildSVGRoutePath(points: { lat: number; lng: number }[], w: number, h: number): string {
  if (points.length < 2) return '';
  const lats = points.map(p => p.lat), lngs = points.map(p => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const span = Math.max(maxLat - minLat, maxLng - minLng) || 0.001;
  const pad = 0.1;
  const scale = (w * (1 - pad * 2)) / span;
  const dx = (w - (maxLng - minLng) * scale) / 2;
  const dy = (h - (maxLat - minLat) * scale) / 2;
  const pts = points.map(p => {
    const x = dx + (p.lng - minLng) * scale;
    const y = dy + (maxLat - p.lat) * scale;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M ${pts.join(' L ')}`;
}

export function buildStoryDataUrl(data: StoryCardData): string {
  const { distance, duration, pace, paceEarned, heading, actionType, route } = data;

  const accentColor = actionType === 'attack' ? '#D93518'
    : actionType === 'defend' ? '#1A6B40'
    : actionType === 'fortify' ? '#D4A200'
    : '#0A0A0A';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 700" width="400" height="700">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#F7F6F4"/>
      <stop offset="100%" stop-color="#EDEAE5"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="400" height="700" fill="url(#bg)"/>

  <!-- Top accent bar -->
  <rect x="0" y="0" width="400" height="6" fill="${accentColor}"/>

  <!-- Logo / brand -->
  <text x="200" y="60" font-family="serif" font-size="13" fill="#A39E98" text-anchor="middle" letter-spacing="3">RUNIVO</text>

  <!-- Heading -->
  <text x="200" y="130" font-family="serif" font-size="30" font-style="italic" fill="#0A0A0A" text-anchor="middle">${escapeXml(heading)}</text>

  <!-- Divider -->
  <line x1="140" y1="155" x2="260" y2="155" stroke="#DDD9D4" stroke-width="0.5"/>

  <!-- Route polyline -->
  ${route && route.length >= 2 ? `<g>
    <path d="${buildSVGRoutePath(route, 400, 420)}" fill="none" stroke="${accentColor}" stroke-width="12" stroke-opacity="0.12" stroke-linecap="round" stroke-linejoin="round" transform="translate(0,170)"/>
    <path d="${buildSVGRoutePath(route, 400, 420)}" fill="none" stroke="${accentColor}" stroke-width="3" stroke-opacity="0.9" stroke-linecap="round" stroke-linejoin="round" transform="translate(0,170)"/>
  </g>` : ''}

  <!-- Stats grid -->
  <!-- Distance -->
  <text x="100" y="230" font-family="sans-serif" font-size="38" font-weight="700" fill="#0A0A0A" text-anchor="middle">${escapeXml(distance)}</text>
  <text x="100" y="252" font-family="sans-serif" font-size="11" fill="#A39E98" text-anchor="middle" letter-spacing="1">km</text>

  <!-- Time -->
  <text x="300" y="230" font-family="sans-serif" font-size="38" font-weight="700" fill="#0A0A0A" text-anchor="middle">${escapeXml(duration)}</text>
  <text x="300" y="252" font-family="sans-serif" font-size="11" fill="#A39E98" text-anchor="middle" letter-spacing="1">time</text>

  <!-- Pace -->
  <text x="200" y="330" font-family="sans-serif" font-size="28" font-weight="600" fill="${accentColor}" text-anchor="middle">${escapeXml(pace)}<tspan font-size="14" fill="#A39E98">/km</tspan></text>
  <text x="200" y="352" font-family="sans-serif" font-size="11" fill="#A39E98" text-anchor="middle" letter-spacing="1">avg pace</text>

  <!-- PACE chip -->
  <rect x="145" y="390" width="110" height="30" rx="15" fill="${accentColor}"/>
  <text x="200" y="410" font-family="sans-serif" font-size="12" font-weight="700" fill="#FFFFFF" text-anchor="middle">+${paceEarned} PACE</text>

  <!-- Bottom tag -->
  <text x="200" y="660" font-family="sans-serif" font-size="10" fill="#C8C4C0" text-anchor="middle" letter-spacing="2">tracked on runivo</text>
</svg>`;

  const b64 = btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${b64}`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
