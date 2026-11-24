import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type Opts = { onDone?: () => void; onStopped?: () => void; onError?: (e: Error) => void };
const h = vi.hoisted(() => ({
  speak: vi.fn((_t: string, _o: unknown) => {}),
  stop: vi.fn(async () => {}),
  beginDucking: vi.fn(async () => {}),
  endDucking: vi.fn(async () => {}),
  speech: null as unknown,
}));
const { speak, stop, beginDucking, endDucking } = h;
vi.mock('@mobile/shared/lib/optionalNative', () => ({ getSpeech: () => h.speech }));
vi.mock('./audioSession', () => ({ beginDucking: h.beginDucking, endDucking: h.endDucking }));

import { speakRunCue, stopRunCues, MAX_QUEUED_CUES, __resetSpeakRunCueForTests } from './speakRunCue';

const flush = () => vi.advanceTimersByTimeAsync(0);
const spoken = () => speak.mock.calls.map(c => c[0]);
const last = () => speak.mock.calls.at(-1)![1] as Opts;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  h.speech = { speak, stop };
  __resetSpeakRunCueForTests();
});
afterEach(() => vi.useRealTimers());

describe('speakRunCue', () => {
  it('ducks before speaking and releases when the cue is done', async () => {
    speakRunCue('Kilometre one');
    expect(beginDucking).toHaveBeenCalledTimes(1);
    await flush();
    expect(spoken()).toEqual(['Kilometre one']);
    expect(endDucking).not.toHaveBeenCalled();
    last().onDone!();
    expect(endDucking).toHaveBeenCalledTimes(1);
  });

  it.each(['onDone', 'onStopped', 'onError'] as const)('releases the duck on %s', async cb => {
    speakRunCue('Hello');
    await flush();
    (last()[cb] as () => void)();
    expect(endDucking).toHaveBeenCalledTimes(1);
  });

  it('releases the duck once even if two callbacks fire', async () => {
    speakRunCue('Hello');
    await flush();
    const o = last();
    o.onStopped!(); o.onDone!();
    expect(endDucking).toHaveBeenCalledTimes(1);
  });

  it('does not talk over itself: a second cue waits for the first', async () => {
    speakRunCue('Kilometre one');
    await flush();
    speakRunCue("Entering Ana's zone");
    await flush();
    expect(spoken()).toEqual(['Kilometre one']);
    last().onDone!();
    await flush();
    expect(spoken()).toEqual(['Kilometre one', "Entering Ana's zone"]);
  });

  it('keeps the music ducked between queued cues (no bounce)', async () => {
    speakRunCue('one');
    await flush();
    speakRunCue('two');
    last().onDone!();
    await flush();
    // the second cue took its duck before the first gave its own back
    expect(beginDucking).toHaveBeenCalledTimes(2);
    expect(endDucking).toHaveBeenCalledTimes(1);
    last().onDone!();
    expect(endDucking).toHaveBeenCalledTimes(2);
  });

  it('a high priority cue interrupts a normal one, which is said afterwards', async () => {
    speakRunCue('Kilometre three, split five minutes');
    await flush();
    const interrupted = last();
    speakRunCue('Interval: run hard', { priority: 'high' });
    expect(stop).toHaveBeenCalledTimes(1);
    await flush();
    expect(spoken()).toEqual(['Kilometre three, split five minutes', 'Interval: run hard']);
    interrupted.onStopped!(); // the old utterance reports in late: must be ignored
    expect(endDucking).toHaveBeenCalledTimes(1); // only the interrupted cue's own duck
    last().onDone!();
    await flush();
    expect(spoken().at(-1)).toBe('Kilometre three, split five minutes');
  });

  it('a normal cue never interrupts, and neither does high over high', async () => {
    speakRunCue('a', { priority: 'high' });
    await flush();
    speakRunCue('b', { priority: 'high' });
    speakRunCue('c');
    expect(stop).not.toHaveBeenCalled();
  });

  it('ignores duplicates and blank text', async () => {
    speakRunCue('  ');
    speakRunCue('same');
    await flush();
    speakRunCue('same');
    speakRunCue('next');
    speakRunCue('next');
    last().onDone!();
    await flush();
    last().onDone!();
    await flush();
    expect(spoken()).toEqual(['same', 'next']);
  });

  it('caps the queue and drops the oldest normal cue', async () => {
    speakRunCue('now');
    await flush();
    for (let i = 1; i <= MAX_QUEUED_CUES + 2; i++) speakRunCue(`cue ${i}`);
    for (let i = 0; i < MAX_QUEUED_CUES + 1; i++) { last().onDone!(); await flush(); }
    expect(spoken()).toEqual(['now', 'cue 3', 'cue 4', 'cue 5']);
  });

  it('a stuck utterance (no callback) is released by the watchdog and the next cue plays', async () => {
    speakRunCue('stuck');
    await flush();
    speakRunCue('after');
    await vi.advanceTimersByTimeAsync(4_700); // just past the 4.6 s watchdog for "stuck"
    expect(endDucking).toHaveBeenCalledTimes(1);
    expect(spoken()).toEqual(['stuck', 'after']);
  });

  it('a speak() that throws still releases the duck', async () => {
    speak.mockImplementationOnce(() => { throw new Error('native'); });
    speakRunCue('boom');
    await flush();
    expect(endDucking).toHaveBeenCalledTimes(1);
  });

  it('stopRunCues clears the queue, stops speech and releases the duck', async () => {
    speakRunCue('one');
    await flush();
    speakRunCue('two');
    stopRunCues();
    expect(stop).toHaveBeenCalled();
    expect(endDucking).toHaveBeenCalledTimes(1);
    await flush();
    expect(spoken()).toEqual(['one']);
  });

  it('is silent and never ducks without expo-speech', async () => {
    h.speech = null;
    speakRunCue('hello');
    await flush();
    expect(beginDucking).not.toHaveBeenCalled();
  });
});
