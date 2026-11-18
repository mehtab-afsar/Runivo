/**
 * The profile share card: photo, name, three numbers and a QR code that
 * opens the runner's profile. One SVG is drawn on screen and exported as the
 * shared PNG, so what you see is exactly what you send.
 */
import { qrMatrix, qrPath } from '@shared/lib/qrCode';

export const PROFILE_LINK_BASE = 'https://runivo.app/r/';

/** The link inside the QR and the shared text. Opens the app's runner/:id when installed. */
export function profileLink(userId: string, username?: string | null): string {
  const u = username && /^[A-Za-z0-9_]{1,30}$/.test(username) ? `?u=${username}` : '';
  return `${PROFILE_LINK_BASE}${userId}${u}`;
}

/** The runner id from a scanned code: our https link or the runivo:// deep link. */
export function runnerIdFromLink(text: string): string | null {
  const m = text.trim().match(/^(?:https:\/\/(?:www\.)?runivo\.app\/r\/|runivo:\/\/runner\/)([0-9a-f-]{36})(?:[/?#].*)?$/i);
  return m ? m[1].toLowerCase() : null;
}

export interface ProfileCardData {
  name: string;
  username?: string | null;
  rank: string;
  runs: number;
  km: number;
  zones: number;
  link: string;
  /** data:image/...;base64 URI of the photo. Initials are drawn without one. */
  photo?: string | null;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const INK = '#17181A', LIME = '#C9F06B', AMBER = '#F2A43A', GREY = '#6B6E68', LINE = '#E7E8E3';

export const CARD_W = 340;
export const CARD_H = 520;
/** Where the photo sits on the card (card units), shared with the on-screen overlay. */
export const PHOTO_CY = 74;
export const PHOTO_R = 44;
export const STORY_W = 400;
export const STORY_H = 711;

function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
}

function fmtNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return n >= 100 || Number.isInteger(n) ? String(Math.round(n)) : n.toFixed(1);
}

/** The card's inner markup, drawn at (0,0) in a CARD_W × CARD_H box. */
function cardBody(d: ProfileCardData): string {
  const initials = d.name.replace(/[^a-z0-9 ]/gi, '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'R';
  const name = d.name.length > 22 ? `${d.name.slice(0, 21)}…` : d.name;
  const sub = [d.username ? `@${d.username}` : null, d.rank].filter(Boolean).join(' · ');

  const m = qrMatrix(d.link);
  const quiet = 2;
  const QR = 196;
  const unit = QR / (m.length + quiet * 2);
  const qx = (CARD_W - QR) / 2, qy = 262;
  const logo = 44;

  const stats: [string, string][] = [[fmtNum(d.runs), d.runs === 1 ? 'run' : 'runs'], [fmtNum(d.km), 'km'], [fmtNum(d.zones), d.zones === 1 ? 'zone' : 'zones']];
  const col = (i: number) => 58 + i * 112;

  return `
  <rect width="${CARD_W}" height="${CARD_H}" rx="34" fill="#FFFFFF"/>
  <circle cx="${CARD_W / 2}" cy="74" r="46" fill="${INK}"/>
  ${d.photo
    ? `<clipPath id="ph"><circle cx="${CARD_W / 2}" cy="74" r="44"/></clipPath>
       <image href="${d.photo}" x="${CARD_W / 2 - 44}" y="30" width="88" height="88" preserveAspectRatio="xMidYMid slice" clip-path="url(#ph)"/>`
    : `<text x="${CARD_W / 2}" y="86" font-family="Outfit_600SemiBold" font-size="32" fill="${LIME}" text-anchor="middle">${esc(initials)}</text>`}
  <text x="${CARD_W / 2}" y="150" font-family="Outfit_600SemiBold" font-size="25" fill="${INK}" text-anchor="middle">${esc(name)}</text>
  <text x="${CARD_W / 2}" y="173" font-family="Outfit_400Regular" font-size="14" fill="${GREY}" text-anchor="middle">${esc(sub)}</text>
  ${stats.map(([n, l], i) => `
  <text x="${col(i) + 0}" y="214" font-family="Outfit_600SemiBold" font-size="21" fill="${INK}" text-anchor="middle">${esc(n)}</text>
  <text x="${col(i)}" y="233" font-family="Outfit_400Regular" font-size="12" fill="${GREY}" text-anchor="middle">${l}</text>`).join('')}
  <line x1="${col(0) + 56}" y1="198" x2="${col(0) + 56}" y2="236" stroke="${LINE}" stroke-width="1"/>
  <line x1="${col(1) + 56}" y1="198" x2="${col(1) + 56}" y2="236" stroke="${LINE}" stroke-width="1"/>
  <g transform="translate(${qx + unit * quiet} ${qy + unit * quiet}) scale(${unit})">
    <path d="${qrPath(m)}" fill="${INK}" shape-rendering="crispEdges"/>
  </g>
  <rect x="${CARD_W / 2 - logo / 2}" y="${qy + QR / 2 - logo / 2}" width="${logo}" height="${logo}" rx="12" fill="#FFFFFF"/>
  <polygon points="${hexPoints(CARD_W / 2, qy + QR / 2, 15)}" fill="none" stroke="${AMBER}" stroke-width="3.2" stroke-linejoin="round"/>
  <text x="${CARD_W / 2}" y="${qy + QR + 34}" font-family="Outfit_500Medium" font-size="14" fill="${GREY}" text-anchor="middle">Scan to follow me on runivo</text>`;
}

/** Just the card, for the screen. */
export function buildProfileCardSvg(d: ProfileCardData): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}" width="${CARD_W}" height="${CARD_H}">${cardBody(d)}</svg>`;
}

/** The card on a lime story background (9:16), for sharing as an image. */
export function buildProfileStorySvg(d: ProfileCardData): string {
  const x = (STORY_W - CARD_W) / 2, y = 92;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${STORY_W} ${STORY_H}" width="${STORY_W}" height="${STORY_H}">
  <rect width="${STORY_W}" height="${STORY_H}" fill="${LIME}"/>
  <polygon points="${hexPoints(STORY_W / 2, 50, 13)}" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
  <g transform="translate(${x} ${y})">${cardBody(d)}</g>
  <text x="${STORY_W / 2}" y="${y + CARD_H + 52}" font-family="Outfit_600SemiBold" font-size="22" fill="${INK}" text-anchor="middle">runivo</text>
  <text x="${STORY_W / 2}" y="${y + CARD_H + 74}" font-family="Outfit_400Regular" font-size="13" fill="${INK}" text-anchor="middle" opacity="0.7">Run. Claim your streets.</text>
</svg>`;
}
