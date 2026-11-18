/** The Year in Runivo share card, as SVG (400 × 700), exported to PNG for sharing. */
import type { YearStats } from '../services/yearService';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function fmtArea(m2: number): string {
  return m2 >= 1_000_000 ? `${(m2 / 1_000_000).toFixed(2)} km²` : m2 >= 10_000 ? `${(m2 / 10_000).toFixed(1)} ha` : `${Math.round(m2).toLocaleString('en')} m²`;
}

/** The headline lines on the card and the screen, in order. */
export function yearHighlights(y: YearStats): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [
    { label: 'Distance', value: `${y.km.toLocaleString('en', { maximumFractionDigits: 1 })} km` },
    { label: 'Activities', value: String(y.activities) },
    { label: 'Time moving', value: `${Math.round(y.hours)} h` },
    { label: 'Zones claimed', value: String(y.zonesClaimed) },
  ];
  if (y.paceEarned) rows.push({ label: 'PACE earned', value: y.paceEarned.toLocaleString('en') });
  if (y.biggestStealM2 && y.biggestStealFrom) rows.push({ label: 'Biggest steal', value: `${fmtArea(y.biggestStealM2)} from ${y.biggestStealFrom}` });
  if (y.biggestZoneM2) rows.push({ label: 'Biggest zone held', value: fmtArea(y.biggestZoneM2) });
  if (y.bestMonth && y.bestMonthKm) rows.push({ label: 'Best month', value: `${MONTHS[y.bestMonth - 1]} · ${y.bestMonthKm} km` });
  return rows;
}

export function buildYearSvg(y: YearStats, username: string): string {
  // Same family as the run and profile cards: lime, a white card, Outfit.
  const rows = yearHighlights(y).slice(0, 7);
  const hexPts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${(200 + 13 * Math.cos(a)).toFixed(1)},${(50 + 13 * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  const lines = rows.map((r, i) => {
    const yy = 300 + i * 44;
    return `<text x="54" y="${yy}" font-family="Outfit_500Medium" font-size="12" fill="#6B6E68">${esc(r.label.toUpperCase())}</text>
<text x="54" y="${yy + 21}" font-family="Outfit_600SemiBold" font-size="18" fill="#17181A">${esc(r.value)}</text>`;
  }).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 700" width="400" height="700">
<rect width="400" height="700" fill="#C9F06B"/>
<polygon points="${hexPts}" fill="none" stroke="#17181A" stroke-width="2.6" stroke-linejoin="round"/>
<rect x="30" y="90" width="340" height="540" rx="34" fill="#FFFFFF"/>
<text x="54" y="170" font-family="Outfit_600SemiBold" font-size="68" fill="#17181A">${y.year}</text>
<text x="54" y="200" font-family="Outfit_400Regular" font-size="16" fill="#6B6E68">${esc(username)}'s year on Runivo</text>
<text x="54" y="252" font-family="Outfit_600SemiBold" font-size="42" fill="#4E7F1F">${esc(`${Math.round(y.km).toLocaleString('en')} km`)}</text>
${lines}
<text x="200" y="672" font-family="Outfit_600SemiBold" font-size="20" fill="#17181A" text-anchor="middle">runivo</text>
</svg>`;
}

