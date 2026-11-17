import { describe, expect, it } from 'vitest';
import { parseCoachReply, sessionFromCoach } from './coachSession';

const block = (o: unknown) => `Tomorrow is intervals.\n<session>${JSON.stringify(o)}</session>`;
const good = {
  date: '2026-11-23', kind: 'intervals', title: 'Intervals', distanceKm: 6.4, durationMin: 40,
  steps: [
    { kind: 'warmup', label: 'Warm up', distanceM: 1500 },
    { kind: 'run', label: '4 × 800 m', distanceM: 3200, pace: { fast: 295, slow: 285 } },
    { kind: 'cooldown', label: 'Cool down', distanceM: 1500 },
  ],
};

describe('parseCoachReply', () => {
  it('splits the card off the text', () => {
    const r = parseCoachReply(block(good));
    expect(r.text).toBe('Tomorrow is intervals.');
    expect(r.session?.title).toBe('Intervals');
    expect(r.session?.steps).toHaveLength(3);
    expect(r.session?.steps[1]?.pace).toEqual({ fast: 285, slow: 295 }); // reordered
  });
  it('plain replies have no card', () => {
    expect(parseCoachReply('Rest today.')).toEqual({ text: 'Rest today.', session: null });
  });
  it('drops bad blocks but keeps the text', () => {
    for (const bad of [
      'not json', { ...good, kind: 'race' }, { ...good, date: 'tomorrow' }, { ...good, distanceKm: 900 },
      { ...good, steps: [{ kind: 'sprint', label: 'x' }] },
    ]) {
      const r = parseCoachReply(typeof bad === 'string' ? `Hi <session>${bad}</session>` : block(bad));
      expect(r.session).toBeNull();
      expect(r.text).not.toContain('<session>');
    }
  });
  it('ignores bad steps and out-of-range numbers', () => {
    const r = parseCoachReply(block({ ...good, steps: [...good.steps, { kind: 'run' }, { kind: 'run', label: 'Fast', distanceM: -5 }] }));
    expect(r.session?.steps).toHaveLength(4);
    expect(r.session?.steps[3]?.distanceM).toBeUndefined();
  });
  it('makes a planned session', () => {
    const s = sessionFromCoach(parseCoachReply(block(good)).session!, 'x1');
    expect(s).toMatchObject({ id: 'x1', date: '2026-11-23', status: 'planned', distanceKm: 6.4 });
  });
});
