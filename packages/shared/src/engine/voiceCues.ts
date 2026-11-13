/**
 * What the voice coach says (PRD L1). Pure text, so it can be tested; the
 * app speaks it with expo-speech.
 */

/** "5 minutes 12 seconds", "48 seconds", "1 hour 4 minutes". */
export function spokenDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const part = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  if (h) return [part(h, 'hour'), m ? part(m, 'minute') : ''].filter(Boolean).join(' ');
  if (m) return [part(m, 'minute'), r ? part(r, 'second') : ''].filter(Boolean).join(' ');
  return part(r, 'second');
}

/** The cue at each whole kilometre. Rides get speed instead of pace. */
export function kmCue(km: number, splitSec: number, elapsedSec: number, ride = false): string {
  const dist = `${km} ${km === 1 ? 'kilometre' : 'kilometres'}.`;
  const split = ride
    ? `Speed ${Math.round(3600 / Math.max(1, splitSec))} kilometres per hour.`
    : `Split ${spokenDuration(splitSec)} per kilometre.`;
  return `${dist} ${split} Time ${spokenDuration(elapsedSec)}.`;
}

/** "Loop closing in 80 metres" once you're heading back near the start. */
export function loopCue(toStartM: number): string {
  return `Loop closing in ${Math.max(10, Math.round(toStartM / 10) * 10)} metres.`;
}

/** A workout step: "Rep 2 of 5. 800 metres, 4 minutes 50 to 5 minutes 5 per kilometre." */
export function stepCue(label: string, metres?: number, seconds?: number, band?: { fast: number; slow: number }): string {
  const size = metres ? (metres >= 1000 ? `${(metres / 1000).toFixed(metres % 1000 ? 1 : 0)} kilometres` : `${Math.round(metres)} metres`)
    : seconds ? spokenDuration(seconds) : '';
  const pace = band ? `, ${spokenDuration(band.fast)} to ${spokenDuration(band.slow)} per kilometre` : '';
  return `${label}.${size ? ` ${size}${pace}.` : ''}`;
}
