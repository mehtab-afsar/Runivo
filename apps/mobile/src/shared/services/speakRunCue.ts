/**
 * Every spoken run cue (km splits, loop closing, zone banners, workout steps,
 * cheers) goes through speakRunCue() so that:
 *
 *  1. the audio session is ducking the user's music while the cue is spoken, and
 *     gives the music back when it ends (audioSession.beginDucking/endDucking);
 *  2. two cues never talk over each other: a cue arriving mid-sentence waits its
 *     turn, and only a 'high' priority cue may cut off a 'normal' one;
 *  3. a stuck utterance can not hold the music down: a watchdog releases it.
 *
 * Silent on builds without expo-speech (getSpeech() is null).
 */
import { getSpeech } from '@mobile/shared/lib/optionalNative';
import { beginDucking, endDucking } from './audioSession';

export type RunCuePriority = 'normal' | 'high';

export interface RunCueOptions {
  /** 'high' interrupts a 'normal' cue that is mid-sentence (the interrupted one is said after). Default 'normal'. */
  priority?: RunCuePriority;
  language?: string;
  rate?: number;
}

interface Cue {
  text: string;
  priority: RunCuePriority;
  language: string;
  rate: number;
}

interface Active {
  id: number;
  cue: Cue;
  timer: ReturnType<typeof setTimeout> | null;
  /** Each started cue holds exactly one ducking count; this makes releasing it idempotent. */
  released: boolean;
}

/** Waiting cues beyond this are dropped oldest-first: a 4th stale cue is worse than silence. */
export const MAX_QUEUED_CUES = 3;
const WATCHDOG_BASE_MS = 4000;
const WATCHDOG_PER_CHAR_MS = 120;

let queue: Cue[] = [];
let current: Active | null = null;
let seq = 0;

function releaseDuck(a: Active): void {
  if (a.released) return;
  a.released = true;
  if (a.timer) clearTimeout(a.timer);
  a.timer = null;
  void endDucking();
}

/** An utterance ended (done, stopped or errored). */
function finish(a: Active): void {
  if (current !== a) { releaseDuck(a); return; } // late callback from a cue that was already replaced
  current = null;
  // Start the next cue before releasing this one's duck so the music does not bounce up between them.
  const next = queue.shift();
  if (next) start(next);
  releaseDuck(a);
}

function start(cue: Cue): void {
  const speech = getSpeech();
  const a: Active = { id: ++seq, cue, timer: null, released: false };
  current = a;
  const ducked = beginDucking(); // counts synchronously; resolves once the session mode is applied
  void ducked.then(() => {
    if (current !== a || a.released) return; // stopRunCues() or an interrupt got here first
    a.timer = setTimeout(() => finish(a), WATCHDOG_BASE_MS + cue.text.length * WATCHDOG_PER_CHAR_MS);
    if (!speech) { finish(a); return; }
    try {
      speech.speak(cue.text, {
        language: cue.language,
        rate: cue.rate,
        onDone: () => finish(a),
        onStopped: () => finish(a),
        onError: () => finish(a),
      });
    } catch {
      finish(a);
    }
  });
}

function enqueue(cue: Cue): void {
  if (queue.some(q => q.text === cue.text)) return;
  queue.push(cue);
  // Keep high-priority cues over normal ones when trimming.
  while (queue.length > MAX_QUEUED_CUES) {
    const drop = queue.findIndex(q => q.priority === 'normal');
    queue.splice(drop === -1 ? 0 : drop, 1);
  }
}

export function speakRunCue(text: string, options: RunCueOptions = {}): void {
  const clean = text.trim();
  if (!clean || !getSpeech()) return;
  const cue: Cue = {
    text: clean,
    priority: options.priority ?? 'normal',
    language: options.language ?? 'en',
    rate: options.rate ?? 1.0,
  };

  if (!current) { start(cue); return; }
  if (current.cue.text === cue.text) return; // the same sentence twice in a row

  if (cue.priority === 'high' && current.cue.priority === 'normal') {
    const interrupted = current;
    current = null;
    queue.unshift(interrupted.cue); // said after, not lost
    while (queue.length > MAX_QUEUED_CUES) queue.pop();
    start(cue);
    releaseDuck(interrupted);
    try { void getSpeech()?.stop(); } catch { /* ignore */ }
    return;
  }
  enqueue(cue);
}

/** Run over (or screen closing): say nothing more and give the music back. */
export function stopRunCues(): void {
  queue = [];
  const a = current;
  current = null;
  if (a) {
    releaseDuck(a);
    try { void getSpeech()?.stop(); } catch { /* ignore */ }
  }
}

/** Tests only. */
export function __resetSpeakRunCueForTests(): void {
  queue = [];
  if (current?.timer) clearTimeout(current.timer);
  current = null;
  seq = 0;
}
