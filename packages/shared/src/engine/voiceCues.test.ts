import { describe, it, expect } from 'vitest';
import { spokenDuration, kmCue, loopCue, stepCue } from './voiceCues';

describe('voice cues', () => {
  it('speaks durations naturally', () => {
    expect(spokenDuration(312)).toBe('5 minutes 12 seconds');
    expect(spokenDuration(60)).toBe('1 minute');
    expect(spokenDuration(48)).toBe('48 seconds');
    expect(spokenDuration(3840)).toBe('1 hour 4 minutes');
  });
  it('builds km, loop and step cues', () => {
    expect(kmCue(1, 312, 312)).toBe('1 kilometre. Split 5 minutes 12 seconds per kilometre. Time 5 minutes 12 seconds.');
    expect(kmCue(5, 150, 900, true)).toBe('5 kilometres. Speed 24 kilometres per hour. Time 15 minutes.');
    expect(loopCue(83)).toBe('Loop closing in 80 metres.');
    expect(stepCue('Rep 2 of 5', 800, undefined, { fast: 290, slow: 305 })).toBe('Rep 2 of 5. 800 metres, 4 minutes 50 seconds to 5 minutes 5 seconds per kilometre.');
    expect(stepCue('Cool down', undefined, 300)).toBe('Cool down. 5 minutes.');
  });
});
