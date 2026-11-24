import { describe, it, expect, vi } from 'vitest';
import { handleAppStateChange, type ResumeDeps } from './appStateResume';
import { createRunSession } from './session';
import type { RunUi } from './types';

const FOOT = 7.5;
// ~5 m north per second: counts as distance.
const fix = (i: number) => ({ lat: 51 + i * 0.000045, lng: 0, timestamp: 1_000_000 + i * 1000, speed: 5, accuracy: 3 });
const buffer = [0, 1, 2, 3].map(fix);

const setup = (patch: Partial<ReturnType<typeof createRunSession>> = {}, deps: Partial<ResumeDeps> = {}) => {
  const s = Object.assign(createRunSession(), { appState: 'background' as const, runId: 'r1' }, patch);
  const ui = { setState: vi.fn(), setGpsLocked: vi.fn(), setBackgroundWarning: vi.fn() } as RunUi;
  const d: ResumeDeps = {
    activateKeepAwake: vi.fn().mockResolvedValue(undefined),
    drainBuffer: vi.fn().mockReturnValue(buffer),
    reportError: vi.fn(),
    ...deps,
  };
  return { s, ui, d };
};

describe('handleAppStateChange', () => {
  it('on resume: re-acquires keep-awake, merges the screen-off points, refreshes the screen', async () => {
    const { s, ui, d } = setup();
    await handleAppStateChange(s, ui, 'active', FOOT, d);
    expect(d.activateKeepAwake).toHaveBeenCalledOnce();
    expect(d.drainBuffer).toHaveBeenCalledWith('r1');
    expect(s.gpsPoints).toHaveLength(4);
    expect(s.appState).toBe('active');
    expect(ui.setState).toHaveBeenCalledOnce();
  });

  it('a keep-awake rejection is reported, and neither the merge nor the appState update is skipped', async () => {
    const boom = new Error('keep-awake unavailable');
    const { s, ui, d } = setup({}, { activateKeepAwake: vi.fn().mockRejectedValue(boom) });
    await expect(handleAppStateChange(s, ui, 'active', FOOT, d)).resolves.toBeUndefined();
    expect(d.reportError).toHaveBeenCalledWith(boom);
    expect(s.gpsPoints).toHaveLength(4);
    expect(s.totalDistance).toBeGreaterThan(0);
    expect(s.appState).toBe('active');
    expect(ui.setState).toHaveBeenCalledOnce();
  });

  it('does not report anything when keep-awake succeeds', async () => {
    const { s, ui, d } = setup();
    await handleAppStateChange(s, ui, 'active', FOOT, d);
    expect(d.reportError).not.toHaveBeenCalled();
  });

  it('a run paused while backgrounded merges nothing but still records the new app state', async () => {
    const { s, ui, d } = setup({ isPaused: true });
    await handleAppStateChange(s, ui, 'active', FOOT, d);
    expect(s.gpsPoints).toHaveLength(0);
    expect(ui.setState).not.toHaveBeenCalled();
    expect(s.appState).toBe('active');
  });

  it('going to the background only records the state (no keep-awake, no drain)', async () => {
    const { s, ui, d } = setup({ appState: 'active' });
    await handleAppStateChange(s, ui, 'background', FOOT, d);
    expect(d.activateKeepAwake).not.toHaveBeenCalled();
    expect(d.drainBuffer).not.toHaveBeenCalled();
    expect(s.appState).toBe('background');
  });

  it('active → active is not a resume', async () => {
    const { s, ui, d } = setup({ appState: 'active' });
    await handleAppStateChange(s, ui, 'active', FOOT, d);
    expect(d.drainBuffer).not.toHaveBeenCalled();
  });
});
