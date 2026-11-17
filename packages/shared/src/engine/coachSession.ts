/**
 * PaceX chat session cards (mock PaceXChat: "Intervals · 6.4 km · Mon · 40 min",
 * steps, "Add to my plan").
 *
 * When PaceX recommends one specific run, the ai-coach function asks it to end
 * the reply with <session>{…}</session>. This module splits that block off the
 * text and checks it hard: it is model output, so anything malformed, out of
 * range or unknown is dropped rather than shown or saved.
 */
import type { Session, SessionKind, Step, StepKind } from './training';

export interface CoachSession {
  date: string;            // YYYY-MM-DD
  kind: SessionKind;
  title: string;
  distanceKm: number;
  durationMin: number | null;
  steps: Step[];
}

const KINDS: SessionKind[] = ['easy', 'long', 'tempo', 'intervals', 'recovery'];
const STEP_KINDS: StepKind[] = ['warmup', 'run', 'recover', 'cooldown'];
const BLOCK = /<session>([\s\S]*?)<\/session>/i;

const num = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};
const str = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

function parseStep(raw: unknown): Step | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const kind = STEP_KINDS.includes(r.kind as StepKind) ? (r.kind as StepKind) : null;
  const label = str(r.label, 40);
  if (!kind || !label) return null;
  const step: Step = { kind, label };
  const d = num(r.distanceM, 50, 50_000);
  if (d != null) step.distanceM = Math.round(d);
  const t = num(r.durationSec, 10, 4 * 3600);
  if (t != null) step.durationSec = Math.round(t);
  const p = r.pace as Record<string, unknown> | undefined;
  const fast = num(p?.fast, 120, 900);
  const slow = num(p?.slow, 120, 900);
  if (fast != null && slow != null) step.pace = { fast: Math.min(fast, slow), slow: Math.max(fast, slow) };
  return step;
}

/** Splits a PaceX reply into its text and (if valid) its session card. */
export function parseCoachReply(reply: string): { text: string; session: CoachSession | null } {
  const m = reply.match(BLOCK);
  if (!m) return { text: reply, session: null };
  const text = reply.replace(BLOCK, '').trim();
  let raw: Record<string, unknown>;
  try { raw = JSON.parse(m[1]!) as Record<string, unknown>; } catch { return { text, session: null }; }
  if (!raw || typeof raw !== 'object') return { text, session: null };

  const date = typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) && !Number.isNaN(Date.parse(raw.date)) ? raw.date : null;
  const kind = KINDS.includes(raw.kind as SessionKind) ? (raw.kind as SessionKind) : null;
  const title = str(raw.title, 40);
  const distanceKm = num(raw.distanceKm, 0.5, 60);
  const steps = (Array.isArray(raw.steps) ? raw.steps : []).slice(0, 8).map(parseStep).filter((s): s is Step => !!s);
  if (!date || !kind || !title || distanceKm == null || steps.length === 0) return { text, session: null };
  const dur = num(raw.durationMin, 5, 360);
  return {
    text,
    session: { date, kind, title, distanceKm: Math.round(distanceKm * 10) / 10, durationMin: dur == null ? null : Math.round(dur), steps },
  };
}

/** The plan entry for a session card (a new planned session on that date). */
export function sessionFromCoach(cs: CoachSession, id: string): Session {
  return {
    id,
    date: cs.date,
    kind: cs.kind,
    title: cs.title,
    summary: `${cs.distanceKm} km${cs.durationMin ? ` · ${cs.durationMin} min` : ''} · from PaceX`,
    steps: cs.steps,
    distanceKm: cs.distanceKm,
    status: 'planned',
  };
}
