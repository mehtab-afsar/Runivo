/**
 * The one place that configures the app's audio session (AVAudioSession on iOS,
 * audio focus on Android). Nothing else may call setAudioModeAsync: two callers
 * with different settings used to overwrite each other (theme/sounds.ts said
 * "respect the silent switch", the beat pacer said "play on silent"), and whoever
 * ran last won.
 *
 * Two modes:
 *
 *  - idle: UI sounds. Respect the silent switch, never stay alive in the
 *    background, mix with the user's music so a tap never pauses or dips it.
 *  - run:  an active run. Plays on silent, keeps playing with the screen locked
 *    (needs UIBackgroundModes "audio"), and still MIXES with the user's music, so
 *    the pacer click and the km tick never dip Spotify or Apple Music.
 *
 * Ducking is a third, short state on top of run: speakRunCue() asks for it with
 * beginDucking() just before a voice cue and gives it back with endDucking() when
 * the cue ends. iOS applies the session's options for as long as the session is
 * active, so a standing "duckOthers" would hold the music down for the whole run
 * (every click re-activates the session). Raising it only around speech is what
 * makes the music dip for a sentence and come back.
 *
 * expo-audio 55 has no separate Android ducking flag: interruptionMode
 * 'duckOthers' requests transient focus with ducking on Android too.
 */
import { setAudioModeAsync, setIsAudioActiveAsync, type AudioMode } from 'expo-audio';

type ModeConfig = Pick<AudioMode, 'playsInSilentMode' | 'shouldPlayInBackground' | 'interruptionMode' | 'allowsRecording'>;

export const IDLE_MODE: ModeConfig = {
  playsInSilentMode: false,
  shouldPlayInBackground: false,
  interruptionMode: 'mixWithOthers',
  allowsRecording: false,
};

export const RUN_MODE: ModeConfig = {
  playsInSilentMode: true,
  shouldPlayInBackground: true,
  interruptionMode: 'mixWithOthers',
  allowsRecording: false,
};

export const RUN_DUCK_MODE: ModeConfig = { ...RUN_MODE, interruptionMode: 'duckOthers' };

let runActive = false;
let duckDepth = 0;
let applied: ModeConfig | null = null;
let chain: Promise<void> = Promise.resolve();

function desiredMode(): ModeConfig {
  if (!runActive) return IDLE_MODE;
  return duckDepth > 0 ? RUN_DUCK_MODE : RUN_MODE;
}

/**
 * Applies whatever mode is wanted NOW. Calls are chained so two quick changes can
 * not reach the native side out of order, and each link reads the latest wish
 * rather than the one it was queued with (a stale "duck" never lands after "release").
 */
function apply(): Promise<void> {
  chain = chain.then(async () => {
    const want = desiredMode();
    if (applied === want) return;
    try {
      await setAudioModeAsync(want);
      applied = want;
    } catch {
      // Audio failure must never affect the run. Try again on the next change.
      applied = null;
    }
  });
  return chain;
}

/** Hands the session back so the user's music returns to full volume. */
async function releaseSession(): Promise<void> {
  try { await setIsAudioActiveAsync(false); } catch { /* another sound still running: iOS refuses, fine */ }
}

/** App start, and after every run. */
export function configureIdleAudioSession(): Promise<void> {
  runActive = false;
  duckDepth = 0;
  return apply();
}

/** A run is starting (or its countdown is). Safe to call twice. */
export function enterRunAudioSession(): Promise<void> {
  runActive = true;
  return apply();
}

/** The run finished, was discarded or its screen went away. */
export async function exitRunAudioSession(): Promise<void> {
  runActive = false;
  duckDepth = 0;
  await apply();
  await releaseSession();
}

export function isRunAudioActive(): boolean {
  return runActive;
}

/**
 * Lower other apps' audio. Counted, so two overlapping cues share one dip and the
 * music only returns when the last one calls endDucking().
 */
export function beginDucking(): Promise<void> {
  duckDepth += 1;
  return apply();
}

export async function endDucking(): Promise<void> {
  if (duckDepth === 0) return;
  duckDepth -= 1;
  if (duckDepth > 0) return;
  await apply();
  // A cue may have started while the mode was changing: do not pull the session from under it.
  if (duckDepth > 0) return;
  // AVSpeechSynthesizer activates the session and never deactivates it; without this
  // the music stays ducked after the sentence ends.
  await releaseSession();
}

/** Tests only. */
export function __resetAudioSessionForTests(): void {
  runActive = false;
  duckDepth = 0;
  applied = null;
  chain = Promise.resolve();
}
