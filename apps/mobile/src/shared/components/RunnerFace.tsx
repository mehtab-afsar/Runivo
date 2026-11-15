import React, { useId } from 'react';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

/**
 * Illustrated profile picture, as in the HTML mock. Used whenever a runner
 * has no uploaded photo. The look is picked deterministically from `seed`
 * (user id or username), so a runner always gets the same face.
 */

type HairStyle = 'short' | 'long' | 'buzz' | 'bun';

export interface FaceLook {
  bg: string; skin: string; hair: string; shirt: string; style: HairStyle;
}

// The mock's eight runners, kept as the first looks so the app reads the same.
const PRESETS: FaceLook[] = [
  { bg: '#EADFD6', skin: '#C68B5E', hair: '#1D1A18', shirt: '#0C0C0D', style: 'short' },
  { bg: '#ECE3CF', skin: '#E9B48A', hair: '#5A3A22', shirt: '#4E7F1F', style: 'long'  },
  { bg: '#DCE3EE', skin: '#7A4B2E', hair: '#141414', shirt: '#2F56F5', style: 'buzz'  },
  { bg: '#E3DEEE', skin: '#B7794E', hair: '#1A1A1A', shirt: '#5B47C9', style: 'long'  },
  { bg: '#DCE7DF', skin: '#F0C6A3', hair: '#B56A2A', shirt: '#1D6B4A', style: 'short' },
  { bg: '#EDDDE3', skin: '#D9A07A', hair: '#2B1B12', shirt: '#B0306A', style: 'bun'   },
  { bg: '#DFE6EC', skin: '#F2CFB3', hair: '#D9B56B', shirt: '#2E6FA8', style: 'short' },
  { bg: '#DAE8E4', skin: '#A86E48', hair: '#3A2418', shirt: '#1F7A6A', style: 'long'  },
];

/** Photo backgrounds a runner can pick on the edit screen (stored as avatar_color). */
export const FACE_TINTS = ['#EADFD6', '#ECE3CF', '#DCE3EE', '#DCE7DF', '#E3DEEE', '#EDDDE3'];

const BG    = ['#EADFD6', '#ECE3CF', '#DCE3EE', '#E3DEEE', '#DCE7DF', '#EDDDE3', '#DFE6EC', '#DAE8E4'];
const SKIN  = ['#F2CFB3', '#F0C6A3', '#E9B48A', '#D9A07A', '#C68B5E', '#B7794E', '#A86E48', '#7A4B2E', '#5C3A24'];
const HAIR  = ['#141414', '#1D1A18', '#2B1B12', '#3A2418', '#5A3A22', '#B56A2A', '#D9B56B', '#8A8580'];
const SHIRT = ['#0C0C0D', '#FF4518', '#2F56F5', '#5B47C9', '#1D6B4A', '#B0306A', '#2E6FA8', '#1F7A6A', '#E0A019'];
const STYLE: HairStyle[] = ['short', 'long', 'buzz', 'bun'];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function faceLook(seed: string): FaceLook {
  const h = hash(seed || '?');
  // A third of runners get one of the mock's hand-picked looks.
  if (h % 3 === 0) return PRESETS[(h >>> 2) % PRESETS.length];
  return {
    bg:    BG[(h >>> 3) % BG.length],
    skin:  SKIN[(h >>> 7) % SKIN.length],
    hair:  HAIR[(h >>> 11) % HAIR.length],
    shirt: SHIRT[(h >>> 15) % SHIRT.length],
    style: STYLE[(h >>> 19) % STYLE.length],
  };
}

export function RunnerFace({ seed, size = 40, look }: { seed: string; size?: number; look?: FaceLook }) {
  const p = look ?? faceLook(seed);
  const clip = `face${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Defs>
        <ClipPath id={clip}><Circle cx="20" cy="20" r="20" /></ClipPath>
      </Defs>
      <G clipPath={`url(#${clip})`}>
        <Rect width="40" height="40" fill={p.bg} />
        {p.style === 'long' && <Path d="M11.5 18c0-7.5 4-11 8.5-11s8.5 3.5 8.5 11v12h-17z" fill={p.hair} />}
        {p.style === 'bun'  && <Circle cx="20" cy="7.6" r="4.2" fill={p.hair} />}
        <Path d="M5 42c1.5-9 7.5-14 15-14s13.5 5 15 14z" fill={p.shirt} />
        <Rect x="17" y="22" width="6" height="7" rx="3" fill={p.skin} />
        <Circle cx="12.6" cy="18" r="1.8" fill={p.skin} />
        <Circle cx="27.4" cy="18" r="1.8" fill={p.skin} />
        <Circle cx="20" cy="17" r="7.6" fill={p.skin} />
        {p.style === 'buzz'
          ? <Path d="M12.6 15.4c.6-4.8 3.6-7.3 7.4-7.3s6.8 2.5 7.4 7.3c-2-1.7-4.6-2.5-7.4-2.5s-5.4.8-7.4 2.5z" fill={p.hair} />
          : <Path d="M12.3 16.6c-.3-5.7 3.3-9.1 7.7-9.1s8 3.4 7.7 9.1c-1.6-2.7-4.4-4.1-7.7-4.1s-6.1 1.4-7.7 4.1z" fill={p.hair} />}
      </G>
    </Svg>
  );
}
