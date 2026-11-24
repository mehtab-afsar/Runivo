// ─── Deterministic red-flag detection ──────────────────────────────────────────
// The rules in prompts.ts are instructions, not a guarantee — a model can be
// talked past its own system prompt. For the highest-risk signals (acute medical
// distress, disordered eating), this runs BEFORE any Anthropic call and — on a
// match — returns a fixed response instead, so the model's judgment is never the
// only thing standing between a user and an unsafe reply for these cases.
// Deliberately matches specific phrases over single common words (e.g. not
// bare "pain" or "tight") to keep false positives on a hard tempo run low;
// tune with real usage rather than trying to be exhaustive up front.
const RED_FLAG_PATTERNS: RegExp[] = [
  // Acute medical distress
  /chest (pain|tightness|pressure)/i,
  /can'?t (breathe|catch my breath)/i,
  /irregular heart ?beat/i,
  /heart (racing|pounding) (and|but)/i,
  /(fainted|passed out|blacking out)/i,
  /(severe|sharp|shooting) pain/i,
  /can'?t (walk|move|put weight)/i,
  /(numb|no feeling) in my/i,
  // Disordered eating
  /haven'?t eaten (in|for) \d/i,
  /starving myself/i,
  /(purge|purging|throw(ing)? up) (after|on purpose)/i,
  /binge(d|ing)? and (then|after)/i,
];

export const SAFE_REDIRECT_MESSAGE =
  "That sounds like something worth a real person's attention rather than an app — if this is urgent (chest pain, trouble breathing, a serious injury), please contact emergency services or a doctor now. I'm not the right tool for this one. I'm here whenever you want to talk training, pace, or your Runivo stats.";

export function detectRedFlag(text: string | undefined | null): boolean {
  if (!text) return false;
  return RED_FLAG_PATTERNS.some(p => p.test(text));
}
