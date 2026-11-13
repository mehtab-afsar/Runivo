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
  const rows = yearHighlights(y).slice(0, 7);
  const lines = rows.map((r, i) => {
    const yy = 300 + i * 52;
    return `<text x="36" y="${yy}" font-family="Helvetica" font-size="13" fill="#8A857F">${esc(r.label.toUpperCase())}</text>
<text x="36" y="${yy + 24}" font-family="Helvetica" font-size="21" font-weight="700" fill="#0A0A0A">${esc(r.value)}</text>`;
  }).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 700" width="400" height="700">
<rect width="400" height="700" fill="#F7F6F4"/>
<rect width="400" height="8" fill="#FF4518"/>
<text x="36" y="70" font-family="Helvetica" font-size="13" letter-spacing="3" fill="#A39E98">RUNIVO</text>
<text x="36" y="150" font-family="Helvetica" font-size="72" font-weight="800" fill="#0A0A0A">${y.year}</text>
<text x="36" y="190" font-family="Helvetica" font-size="20" fill="#0A0A0A">${esc(username)}'s year</text>
<text x="36" y="242" font-family="Helvetica" font-size="46" font-weight="800" fill="#FF4518">${esc(`${Math.round(y.km).toLocaleString('en')} km`)}</text>
${lines}
<text x="36" y="670" font-family="Helvetica" font-size="12" fill="#A39E98">Run. Claim. Defend. · runivo</text>
</svg>`;
}
