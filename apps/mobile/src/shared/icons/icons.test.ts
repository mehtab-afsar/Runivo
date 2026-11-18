import { describe, it, expect, vi } from 'vitest';

// The icon components are React Native code; the table only needs distinct stand-ins.
vi.mock('phosphor-react-native', async () => {
  const { readFileSync: read } = await import('fs');
  const src = read(`${__dirname}/glyphs.ts`, 'utf8');
  const names = src.slice(src.indexOf('import {'), src.indexOf("} from 'phosphor-react-native'")).match(/\b[A-Z]\w+\b/g) ?? [];
  return Object.fromEntries(names.map(n => [n, n]));
});
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { AWARD_DEFINITIONS } from '@shared/constants/awards';
import { glyphFor, hasGlyph, ROUTE_ICON_KEYS } from './glyphs';

describe('icon set', () => {
  it('draws every award with its own icon', () => {
    for (const [id, def] of Object.entries(AWARD_DEFINITIONS)) {
      expect(hasGlyph(def.icon), `${id} ${def.icon}`).toBe(true);
    }
  });

  it('draws every route icon', () => {
    for (const k of ROUTE_ICON_KEYS) expect(hasGlyph(k), k).toBe(true);
  });

  it('ignores emoji variation selectors', () => {
    expect(glyphFor('🛡️')).toBe(glyphFor('🛡'));
    expect(glyphFor('⚔️').label).toBe('Battle');
  });

  it('never returns the raw emoji for unknown keys', () => {
    expect(glyphFor('🦄').label).toBe('Flag');
    expect(glyphFor(null).label).toBe('Flag');
  });
});

// Emoji belong only in what people write. The app's own screens draw icons.
// Allowed: the glyph table itself (it maps stored emoji to icons) and stored
// data defaults (club badge_emoji kept for older builds).
const ALLOWED = [/shared[\\/]icons[\\/]/, /clubService\.ts$/, /ClubScreen\.tsx$/, /AwardDetailScreen\.tsx$/, /FootScanScreen\.tsx$/, /AwardUnlockSheet\.tsx$/, /CalorieTrackerScreen\.tsx$/];
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2705}\u{274C}\u{2B22}\u{2B21}\u{25B2}\u{25BC}\u{2713}\u{2714}]/u;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) && !/\.test\./.test(n) ? [p] : [];
  });
}

describe('no emoji in the interface', () => {
  it('finds none outside the icon table', () => {
    const bad: string[] = [];
    for (const f of files(join(__dirname, '..', '..'))) {
      if (ALLOWED.some(r => r.test(f))) continue;
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        const t = line.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('{/*')) return;
        if (EMOJI.test(line)) bad.push(`${f.split('src')[1]}:${i + 1}`);
      });
    }
    expect(bad).toEqual([]);
  });
});
