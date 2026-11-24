import { describe, it, expect, vi, beforeEach } from 'vitest';

const { setAudioModeAsync, setIsAudioActiveAsync } = vi.hoisted(() => ({
  setAudioModeAsync: vi.fn(async (_m: unknown) => {}),
  setIsAudioActiveAsync: vi.fn(async (_a: boolean) => {}),
}));
vi.mock('expo-audio', () => ({ setAudioModeAsync, setIsAudioActiveAsync }));

import {
  configureIdleAudioSession, enterRunAudioSession, exitRunAudioSession,
  beginDucking, endDucking, isRunAudioActive, __resetAudioSessionForTests,
  IDLE_MODE, RUN_MODE, RUN_DUCK_MODE,
} from './audioSession';

const modes = () => setAudioModeAsync.mock.calls.map(c => c[0]);

beforeEach(() => {
  vi.clearAllMocks();
  __resetAudioSessionForTests();
});

describe('audio modes', () => {
  it('idle respects the silent switch, stays out of the background and mixes', () => {
    expect(IDLE_MODE).toMatchObject({ playsInSilentMode: false, shouldPlayInBackground: false, interruptionMode: 'mixWithOthers' });
  });
  it('run plays on silent and in the background but still mixes (no standing duck)', () => {
    expect(RUN_MODE).toMatchObject({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'mixWithOthers' });
  });
  it('the duck mode is the run mode with duckOthers', () => {
    expect(RUN_DUCK_MODE).toEqual({ ...RUN_MODE, interruptionMode: 'duckOthers' });
  });
});

describe('run lifecycle', () => {
  it('idle -> run -> idle, releasing the session at the end', async () => {
    await configureIdleAudioSession();
    await enterRunAudioSession();
    expect(isRunAudioActive()).toBe(true);
    await exitRunAudioSession();
    expect(isRunAudioActive()).toBe(false);
    expect(modes()).toEqual([IDLE_MODE, RUN_MODE, IDLE_MODE]);
    expect(setIsAudioActiveAsync).toHaveBeenLastCalledWith(false);
  });

  it('entering twice does not reconfigure the session', async () => {
    await enterRunAudioSession();
    await enterRunAudioSession();
    expect(setAudioModeAsync).toHaveBeenCalledTimes(1);
  });

  it('never throws when the native call fails, and retries on the next change', async () => {
    setAudioModeAsync.mockRejectedValueOnce(new Error('native'));
    await expect(enterRunAudioSession()).resolves.toBeUndefined();
    await enterRunAudioSession();
    expect(setAudioModeAsync).toHaveBeenCalledTimes(2);
  });
});

describe('ducking', () => {
  it('ducks, then goes back to the run mode and releases the session', async () => {
    await enterRunAudioSession();
    await beginDucking();
    expect(modes().at(-1)).toEqual(RUN_DUCK_MODE);
    await endDucking();
    expect(modes().at(-1)).toEqual(RUN_MODE);
    expect(setIsAudioActiveAsync).toHaveBeenCalledWith(false);
  });

  it('is counted: overlapping cues share one duck and the last one releases it', async () => {
    await enterRunAudioSession();
    await beginDucking();
    await beginDucking();
    await endDucking();
    expect(modes().at(-1)).toEqual(RUN_DUCK_MODE);
    expect(setIsAudioActiveAsync).not.toHaveBeenCalled();
    await endDucking();
    expect(modes().at(-1)).toEqual(RUN_MODE);
    expect(setIsAudioActiveAsync).toHaveBeenCalledTimes(1);
  });

  it('an extra endDucking is a no-op', async () => {
    await enterRunAudioSession();
    await endDucking();
    expect(setIsAudioActiveAsync).not.toHaveBeenCalled();
  });

  it('ending the run mid-cue drops the duck', async () => {
    await enterRunAudioSession();
    await beginDucking();
    await exitRunAudioSession();
    expect(modes().at(-1)).toEqual(IDLE_MODE);
    await endDucking(); // the cue finishing later must not bring ducking back
    expect(modes().at(-1)).toEqual(IDLE_MODE);
  });

  it('applies changes in order even when they are fired back to back', async () => {
    await enterRunAudioSession();
    const a = beginDucking();
    const b = endDucking();
    await Promise.all([a, b]);
    expect(modes().at(-1)).toEqual(RUN_MODE);
  });
});
