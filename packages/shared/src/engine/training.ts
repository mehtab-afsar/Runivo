/**
 * Training engine: structured sessions, pace targets and race plans.
 *
 * Pure functions, no I/O, so every rule is unit-tested (training.test.ts).
 * Plans are stored as JSON in training_plans.plan_data with `version: 2`.
 *
 * Safety rules (PRD T5, informed by reports of injuries from aggressive plans):
 *   - weekly distance grows at most 10% over the last full week;
 *   - every 4th week is a recovery week at 80%;
 *   - at most 25% of a week's distance is hard (tempo, intervals, race pace);
 *   - a taper before race week (1 week for 5K/10K, 2 for half, 3 for marathon);
 *   - a goal faster than 5% beyond what the 5K time predicts is capped.
 */

export type RaceDistance = '5k' | '10k' | 'half' | 'marathon';
export const RACE_KM: Record<RaceDistance, number> = { '5k': 5, '10k': 10, half: 21.0975, marathon: 42.195 };
/** The plan distance for a race of this length, or null when it isn't one we plan for. */
export function raceForKm(km: number | null | undefined): RaceDistance | null {
  if (!km) return null;
  const hit = (Object.keys(RACE_KM) as RaceDistance[]).find(r => Math.abs(km - RACE_KM[r]) / RACE_KM[r] <= 0.05);
  return hit ?? null;
}
export const RACE_LABEL: Record<RaceDistance, string> = { '5k': '5K', '10k': '10K', half: 'Half marathon', marathon: 'Marathon' };

/** Plan length in weeks, inclusive of race week. */
export const PLAN_WEEKS: Record<RaceDistance, { min: number; max: number }> = {
  '5k': { min: 4, max: 12 }, '10k': { min: 6, max: 14 }, half: { min: 8, max: 18 }, marathon: { min: 12, max: 24 },
};
const START_KM: Record<RaceDistance, number> = { '5k': 15, '10k': 20, half: 25, marathon: 30 };
const PEAK_KM: Record<RaceDistance, number> = { '5k': 30, '10k': 40, half: 50, marathon: 65 };
const LONG_CAP_KM: Record<RaceDistance, number> = { '5k': 10, '10k': 14, half: 20, marathon: 32 };
const TAPER_WEEKS: Record<RaceDistance, number> = { '5k': 1, '10k': 1, half: 2, marathon: 3 };

export type SessionKind = 'easy' | 'long' | 'tempo' | 'intervals' | 'recovery' | 'race';
export type StepKind = 'warmup' | 'run' | 'recover' | 'cooldown';
export type WeekFocus = 'base' | 'build' | 'recovery' | 'taper' | 'race';
export type SessionStatus = 'planned' | 'done' | 'skipped';

/** A pace range in seconds per km: `fast` is the lower number. */
export interface PaceBand { fast: number; slow: number }

export interface Step {
  kind: StepKind;
  label: string;
  distanceM?: number;
  durationSec?: number;
  pace?: PaceBand;
}

export interface Session {
  id: string;
  date: string; // YYYY-MM-DD
  kind: SessionKind;
  title: string;
  summary: string;
  steps: Step[];
  distanceKm: number;
  status: SessionStatus;
  runId?: string;
  eased?: boolean;
}

export interface PlanWeek {
  index: number; // 1-based
  startDate: string; // Monday
  focus: WeekFocus;
  km: number;
  sessions: Session[];
}

export interface Paces {
  easy: PaceBand; long: PaceBand; tempo: PaceBand; interval: PaceBand; recovery: PaceBand; race: PaceBand;
}

export interface TrainingPlanV2 {
  version: 2;
  race: RaceDistance;
  raceDate: string;
  goalSec: number | null;
  /** Goal after the safety cap (equals goalSec when it was realistic). */
  targetSec: number;
  goalCapped: boolean;
  fiveKSec: number;
  runDays: number[]; // 0 = Monday … 6 = Sunday
  longRunDay: number;
  paces: Paces;
  weeks: PlanWeek[];
}

export interface PlanInput {
  race: RaceDistance;
  raceDate: string; // YYYY-MM-DD
  fiveKSec: number; // current 5K time
  goalSec?: number | null;
  runDays: number[]; // 3–5 days, 0 = Monday
  longRunDay: number;
  /** Current weekly km (from onboarding or recent runs). */
  currentWeeklyKm?: number | null;
  today: string; // YYYY-MM-DD
}

export type PlanError = 'too_soon' | 'bad_days' | 'bad_time';

// ── Dates (UTC calendar days, no time zones) ─────────────────────────────────
const DAY = 86_400_000;
const parse = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => fmt(parse(d) + n * DAY);
/** 0 = Monday … 6 = Sunday */
export const weekday = (d: string) => (new Date(parse(d)).getUTCDay() + 6) % 7;
export const mondayOf = (d: string) => addDays(d, -weekday(d));
export const daysBetween = (a: string, b: string) => Math.round((parse(b) - parse(a)) / DAY);

// ── Paces ────────────────────────────────────────────────────────────────────
/** Riegel: predicted time over `km` from a 5K time. */
export function predictSec(fiveKSec: number, km: number): number {
  return fiveKSec * Math.pow(km / 5, 1.06);
}

export function pacesFrom(fiveKSec: number, raceSecPerKm: number): Paces {
  const p = fiveKSec / 5;
  const band = (a: number, b: number): PaceBand => ({ fast: Math.round(p * a), slow: Math.round(p * b) });
  return {
    easy: band(1.25, 1.4),
    long: band(1.22, 1.35),
    tempo: band(1.06, 1.1),
    interval: band(0.97, 1.01),
    recovery: band(1.4, 1.55),
    race: { fast: Math.round(raceSecPerKm * 0.98), slow: Math.round(raceSecPerKm * 1.02) },
  };
}

/** "5:12" */
export function fmtPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, '0')}`;
}
export const fmtBand = (b: PaceBand) => `${fmtPace(b.fast)}–${fmtPace(b.slow)}/km`;

// ── Volume ───────────────────────────────────────────────────────────────────
interface WeekShape { focus: WeekFocus; km: number }

export function weeklyShape(race: RaceDistance, weeks: number, startKm: number): WeekShape[] {
  const taper = Math.min(TAPER_WEEKS[race], weeks - 1);
  const peak = Math.max(PEAK_KM[race], startKm);
  const out: WeekShape[] = [];
  let last = startKm; // last full (non-recovery) week
  for (let i = 1; i <= weeks; i++) {
    const fromEnd = weeks - i; // 0 = race week
    if (fromEnd === 0) { out.push({ focus: 'race', km: round1(Math.max(RACE_KM[race], last * (race === 'marathon' ? 0.4 : 0.5))) }); continue; }
    if (fromEnd <= taper) {
      const f = race === 'marathon' ? (fromEnd === 2 ? 0.8 : 0.65) : race === 'half' ? 0.75 : 0.7;
      out.push({ focus: 'taper', km: round1(last * f) });
      continue;
    }
    if (i <= 2) { out.push({ focus: 'base', km: round1(i === 1 ? startKm : Math.min(peak, last * 1.1)) }); last = out[out.length - 1].km; continue; }
    if (i % 4 === 0) { out.push({ focus: 'recovery', km: round1(last * 0.8) }); continue; }
    const km = round1(Math.min(peak, last * 1.1));
    out.push({ focus: 'build', km });
    last = km;
  }
  return out;
}
const round1 = (n: number) => Math.round(n * 10) / 10;

// ── Sessions ─────────────────────────────────────────────────────────────────
function easySession(id: string, date: string, km: number, paces: Paces, kind: 'easy' | 'recovery' = 'easy'): Session {
  const pace = kind === 'easy' ? paces.easy : paces.recovery;
  return {
    id, date, kind, status: 'planned', distanceKm: round1(km),
    title: kind === 'easy' ? `Easy ${round1(km)} km` : `Recovery ${round1(km)} km`,
    summary: `Conversational, ${fmtBand(pace)}`,
    steps: [{ kind: 'run', label: kind === 'easy' ? 'Easy' : 'Recovery', distanceM: Math.round(km * 1000), pace }],
  };
}

function longSession(id: string, date: string, km: number, paces: Paces): Session {
  return {
    id, date, kind: 'long', status: 'planned', distanceKm: round1(km),
    title: `Long run ${round1(km)} km`, summary: `Steady and relaxed, ${fmtBand(paces.long)}`,
    steps: [{ kind: 'run', label: 'Long run', distanceM: Math.round(km * 1000), pace: paces.long }],
  };
}

function tempoSession(id: string, date: string, hardKm: number, paces: Paces): Session {
  const block = round1(Math.max(1.5, hardKm));
  return {
    id, date, kind: 'tempo', status: 'planned', distanceKm: round1(block + 3),
    title: `Tempo ${block} km`, summary: `2 km easy, ${block} km at ${fmtBand(paces.tempo)}, 1 km easy`,
    steps: [
      { kind: 'warmup', label: 'Warm up', distanceM: 2000, pace: paces.easy },
      { kind: 'run', label: 'Tempo', distanceM: Math.round(block * 1000), pace: paces.tempo },
      { kind: 'cooldown', label: 'Cool down', distanceM: 1000, pace: paces.easy },
    ],
  };
}

function intervalSession(id: string, date: string, hardKm: number, race: RaceDistance, weekIndex: number, paces: Paces): Session {
  const repM = race === '5k' ? (weekIndex % 2 ? 400 : 800) : race === '10k' ? (weekIndex % 2 ? 800 : 1000) : 1000;
  const reps = Math.max(3, Math.min(10, Math.round((hardKm * 1000) / repM)));
  const steps: Step[] = [{ kind: 'warmup', label: 'Warm up', distanceM: 2000, pace: paces.easy }];
  for (let r = 1; r <= reps; r++) {
    steps.push({ kind: 'run', label: `Rep ${r} of ${reps}`, distanceM: repM, pace: paces.interval });
    if (r < reps) steps.push({ kind: 'recover', label: 'Jog recovery', durationSec: 90 });
  }
  steps.push({ kind: 'cooldown', label: 'Cool down', distanceM: 1000, pace: paces.easy });
  const km = round1(3 + (reps * repM) / 1000 + ((reps - 1) * 90) / paces.recovery.slow);
  return {
    id, date, kind: 'intervals', status: 'planned', distanceKm: km,
    title: `${reps} × ${repM >= 1000 ? `${repM / 1000} km` : `${repM} m`}`,
    summary: `Reps at ${fmtBand(paces.interval)}, 90 s jog between`, steps,
  };
}

function raceSession(id: string, date: string, race: RaceDistance, targetSec: number, paces: Paces): Session {
  const km = RACE_KM[race];
  return {
    id, date, kind: 'race', status: 'planned', distanceKm: round1(km),
    title: `Race day: ${RACE_LABEL[race]}`,
    summary: `Target ${fmtDuration(targetSec)}, ${fmtBand(paces.race)}`,
    steps: [{ kind: 'run', label: RACE_LABEL[race], distanceM: Math.round(km * 1000), pace: paces.race }],
  };
}

export function fmtDuration(sec: number): string {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

/** Share of a session's distance that is hard. */
export function hardKm(s: Session): number {
  return s.steps
    .filter(st => (st.kind === 'run') && (s.kind === 'tempo' || s.kind === 'intervals' || s.kind === 'race'))
    .reduce((t, st) => t + (st.distanceM ?? 0) / 1000, 0);
}

// ── Plan ─────────────────────────────────────────────────────────────────────
export function buildPlan(input: PlanInput): TrainingPlanV2 | { error: PlanError; minWeeks?: number } {
  const days = [...new Set(input.runDays)].filter(d => d >= 0 && d <= 6).sort((a, b) => a - b);
  if (days.length < 3 || days.length > 5 || !days.includes(input.longRunDay)) return { error: 'bad_days' };
  if (!(input.fiveKSec >= 12 * 60 && input.fiveKSec <= 60 * 60)) return { error: 'bad_time' };

  const { race } = input;
  const raceMonday = mondayOf(input.raceDate);
  // Start today if it is Monday, otherwise next Monday: never in a week already under way.
  const firstMonday = weekday(input.today) === 0 ? input.today : mondayOf(addDays(input.today, 7));
  const available = Math.floor(daysBetween(firstMonday, raceMonday) / 7) + 1;
  const { min, max } = PLAN_WEEKS[race];
  if (available < min) return { error: 'too_soon', minWeeks: min };
  const weeks = Math.min(available, max);
  const startMonday = addDays(raceMonday, -7 * (weeks - 1));

  const predicted = predictSec(input.fiveKSec, RACE_KM[race]);
  const floor = predicted * 0.95;
  const goal = input.goalSec ?? null;
  const targetSec = goal && goal > 0 ? Math.max(goal, floor) : predicted;
  const goalCapped = !!goal && goal < floor;
  const paces = pacesFrom(input.fiveKSec, targetSec / RACE_KM[race]);

  const startKm = Math.max(days.length * 3, Math.min(PEAK_KM[race], input.currentWeeklyKm ?? START_KM[race]));
  const shape = weeklyShape(race, weeks, startKm);

  // Build week by week. Targets come from the shape, but growth is measured on
  // what was actually scheduled, so minimum session sizes can never push a week
  // past +10% (or make a taper week as big as the peak).
  const planWeeks: PlanWeek[] = [];
  let lastFull: number | null = null;
  let peakSoFar = 0;
  shape.forEach((w, wi) => {
    const index = wi + 1;
    const startDate = addDays(startMonday, wi * 7);
    let target = w.km;
    if (lastFull != null && (w.focus === 'base' || w.focus === 'build')) target = Math.min(target, lastFull * 1.1);
    if (lastFull != null && w.focus === 'recovery') target = Math.min(target, lastFull * 0.8);
    if (w.focus === 'taper') target = Math.min(target, peakSoFar * (race === 'marathon' || race === 'half' ? 0.75 : 0.7));
    const week = buildWeek({ index, startDate, focus: w.focus, target, days, longRunDay: input.longRunDay, race, raceDate: input.raceDate, targetSec, paces });
    planWeeks.push(week);
    if (w.focus === 'base' || w.focus === 'build') lastFull = week.km;
    peakSoFar = Math.max(peakSoFar, week.km);
  });

  return {
    version: 2, race, raceDate: input.raceDate, goalSec: goal, targetSec: Math.round(targetSec), goalCapped,
    fiveKSec: input.fiveKSec, runDays: days, longRunDay: input.longRunDay, paces, weeks: planWeeks,
  };
}

interface WeekArgs {
  index: number; startDate: string; focus: WeekFocus; target: number; days: number[]; longRunDay: number;
  race: RaceDistance; raceDate: string; targetSec: number; paces: Paces;
}

function buildWeek(a: WeekArgs): PlanWeek {
  const { index, startDate, focus, days, longRunDay, race, paces } = a;
  const sid = (d: number) => `w${index}d${d}`;
  const dateOf = (d: number) => addDays(startDate, d);
  const total = (ss: Session[]) => round1(ss.reduce((t, x) => t + x.distanceKm, 0));

  if (focus === 'race') {
    const raceDay = weekday(a.raceDate);
    const before = days.filter(d => d < raceDay);
    const easyDays = before.length > 2 ? [before[0], before[before.length - 2]] : before.slice(0, 2);
    const sessions = easyDays.map(d => easySession(sid(d), dateOf(d), Math.max(3, Math.min(6, a.target * 0.2)), paces));
    sessions.push(raceSession(sid(raceDay), a.raceDate, race, a.targetSec, paces));
    return { index, startDate, focus, km: total(sessions), sessions };
  }

  const others = days.filter(d => d !== longRunDay);
  const qualityCount = focus === 'base' ? (index === 1 ? 0 : 1) : days.length >= 5 && focus === 'build' ? 2 : 1;
  const qualityDays = pickQualityDays(others, longRunDay, qualityCount);
  const easyDays = others.filter(d => !qualityDays.includes(d));
  const easyKind = focus === 'recovery' ? 'recovery' : 'easy';

  // Shrink until the week fits its target: hard work first, then easy and long runs, to their minimums.
  let hardShare = focus === 'taper' || focus === 'recovery' ? 0.12 : 0.2;
  let sessions: Session[] = [];
  for (let attempt = 0; attempt < 8; attempt++) {
    const longShare = days.length === 3 ? 0.35 : days.length === 4 ? 0.3 : 0.27;
    const longKm = Math.min(LONG_CAP_KM[race], Math.max(4, a.target * longShare));
    const perHard = qualityCount ? (a.target * hardShare) / qualityCount : 0;
    const quality = qualityDays.map((d, qi) => {
      // Recovery and taper weeks keep one gentle tempo, never intervals.
      const light = focus === 'base' || focus === 'recovery' || focus === 'taper';
      const useIntervals = !light && (qualityCount === 2 ? qi === 1 : index % 2 === 0);
      return useIntervals
        ? intervalSession(sid(d), dateOf(d), perHard, race, index, paces)
        : tempoSession(sid(d), dateOf(d), perHard, paces);
    });
    const used = longKm + quality.reduce((t, x) => t + x.distanceKm, 0);
    // An easy run stays clearly shorter than the long run.
    const easyKm = Math.max(2, Math.min(longKm * 0.7, (a.target - used) / Math.max(1, easyDays.length)));
    sessions = days.map(d =>
      d === longRunDay ? longSession(sid(d), dateOf(d), longKm, paces)
      : qualityDays.includes(d) ? quality[qualityDays.indexOf(d)]
      : easySession(sid(d), dateOf(d), easyKm, paces, easyKind));
    if (total(sessions) <= a.target + 0.3) break;
    hardShare *= 0.75;
  }
  return { index, startDate, focus, km: total(sessions), sessions };
}

function pickQualityDays(others: number[], longDay: number, count: number): number[] {
  if (count === 0 || others.length === 0) return [];
  const notBeside = others.filter(d => Math.abs(d - longDay) > 1);
  const pool = notBeside.length >= count ? notBeside : others;
  if (count === 1) return [pool[0]];
  return [pool[0], pool[pool.length - 1]].filter((d, i, a) => a.indexOf(d) === i);
}

// ── Using a plan ─────────────────────────────────────────────────────────────
export const allSessions = (p: TrainingPlanV2) => p.weeks.flatMap(w => w.sessions);

/** Today's session, if one is planned today. */
export function sessionOn(p: TrainingPlanV2, date: string): Session | null {
  return allSessions(p).find(s => s.date === date) ?? null;
}

/** The next session that is still to do, from `today` on. */
export function nextSession(p: TrainingPlanV2, today: string): Session | null {
  return allSessions(p).filter(s => s.status === 'planned' && s.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1))[0] ?? null;
}

/** Planned sessions whose day has passed. */
export const isMissed = (s: Session, today: string) => s.status === 'planned' && s.date < today;

export function weekOf(p: TrainingPlanV2, date: string): PlanWeek | null {
  return p.weeks.find(w => date >= w.startDate && date <= addDays(w.startDate, 6)) ?? null;
}

function mapSessions(p: TrainingPlanV2, fn: (s: Session, w: PlanWeek) => Session): TrainingPlanV2 {
  return { ...p, weeks: p.weeks.map(w => ({ ...w, sessions: w.sessions.map(s => fn(s, w)) })) };
}

/** Move a session to another day of the same week; swaps with a session already there. */
export function moveSession(p: TrainingPlanV2, id: string, toDate: string): TrainingPlanV2 {
  const s = allSessions(p).find(x => x.id === id);
  if (!s || s.kind === 'race') return p;
  const w = weekOf(p, s.date);
  if (!w || toDate < w.startDate || toDate > addDays(w.startDate, 6)) return p;
  const other = w.sessions.find(x => x.date === toDate && x.id !== id);
  if (other?.kind === 'race') return p;
  const fromDate = s.date;
  return mapSessions(p, x => (x.id === id ? { ...x, date: toDate } : other && x.id === other.id ? { ...x, date: fromDate } : x));
}

/** "Not feeling 100%": the hard sessions in the next 7 days become easy and 30% shorter. */
export function easeNextDays(p: TrainingPlanV2, today: string, days = 7): TrainingPlanV2 {
  const until = addDays(today, days - 1);
  return mapSessions(p, s => {
    if (s.status !== 'planned' || s.date < today || s.date > until || s.kind === 'race') return s;
    const km = Math.max(2, round1(s.distanceKm * 0.7));
    const eased = easySession(s.id, s.date, km, p.paces, 'recovery');
    return { ...eased, eased: true };
  });
}

export function setStatus(p: TrainingPlanV2, id: string, status: SessionStatus, runId?: string): TrainingPlanV2 {
  return mapSessions(p, s => (s.id === id ? { ...s, status, runId: status === 'done' ? runId : undefined } : s));
}

/**
 * After a run: tick the planned session it fulfils (same day, or the day
 * before or after if that one is still open) when it covered at least half
 * the planned distance. Returns the plan unchanged when nothing matches.
 */
export function matchRun(p: TrainingPlanV2, run: { date: string; km: number; runId: string }): { plan: TrainingPlanV2; sessionId: string | null } {
  const candidates = allSessions(p)
    .filter(s => s.status === 'planned' && Math.abs(daysBetween(s.date, run.date)) <= 1)
    .sort((a, b) => Math.abs(daysBetween(a.date, run.date)) - Math.abs(daysBetween(b.date, run.date)));
  const hit = candidates.find(s => run.km >= s.distanceKm * 0.5);
  if (!hit) return { plan: p, sessionId: null };
  return { plan: setStatus(p, hit.id, 'done', run.runId), sessionId: hit.id };
}

// ── Live workout tracking ────────────────────────────────────────────────────
export interface StepState { index: number; startSec: number; startM: number }
export interface StepProgress {
  index: number;
  step: Step;
  next: Step | null;
  /** Metres or seconds left in this step. */
  remaining: { metres?: number; seconds?: number };
  done: boolean;
  /** True on the update that entered a new step (for a cue). */
  changed: boolean;
}

export const startState = (): StepState => ({ index: 0, startSec: 0, startM: 0 });

/** Move through the steps as time and distance accumulate. */
export function advance(steps: Step[], st: StepState, elapsedSec: number, distanceM: number): { state: StepState; progress: StepProgress } {
  let state = st;
  let changed = false;
  while (state.index < steps.length) {
    const step = steps[state.index];
    const doneByDist = step.distanceM != null && distanceM - state.startM >= step.distanceM;
    const doneByTime = step.durationSec != null && elapsedSec - state.startSec >= step.durationSec;
    if (!doneByDist && !doneByTime) break;
    state = { index: state.index + 1, startSec: elapsedSec, startM: distanceM };
    changed = true;
  }
  const done = state.index >= steps.length;
  const i = Math.min(state.index, steps.length - 1);
  const step = steps[i];
  const remaining = done ? {} : {
    metres: step.distanceM != null ? Math.max(0, step.distanceM - (distanceM - state.startM)) : undefined,
    seconds: step.durationSec != null ? Math.max(0, step.durationSec - (elapsedSec - state.startSec)) : undefined,
  };
  return { state, progress: { index: i, step, next: steps[i + 1] ?? null, remaining, done, changed } };
}

/** Against a target band, with 5 s/km of slack either side. */
export function paceStatus(secPerKm: number | null, band?: PaceBand): 'slow' | 'on' | 'fast' | null {
  if (!band || !secPerKm || !isFinite(secPerKm)) return null;
  if (secPerKm > band.slow + 5) return 'slow';
  if (secPerKm < band.fast - 5) return 'fast';
  return 'on';
}

// ── Pace updates from completed runs ─────────────────────────────────────────
/** 5K time a run implies (Riegel), or null for runs too short to tell. */
export function fiveKFromRun(distanceKm: number, durationSec: number): number | null {
  if (distanceKm < 3 || durationSec <= 0) return null;
  const est = durationSec * Math.pow(5 / distanceKm, 1.06);
  // Ignore GPS nonsense: faster than ~12:30 or slower than an hour for 5K.
  return est < 750 || est > 3600 ? null : Math.round(est);
}

const MIN_GAIN = 0.02;   // act on a 2% or bigger improvement
const MAX_STEP = 0.05;   // and move at most 5% per update

/**
 * When a run shows you are fitter than the plan assumes, speeds up the paces
 * of the sessions still ahead (race pace stays tied to the goal). Returns null
 * when nothing should change. Only ever speeds up: a slow day is not evidence.
 */
export function updatePacesFromRun(
  p: TrainingPlanV2, run: { distanceKm: number; durationSec: number }, today: string,
): { plan: TrainingPlanV2; fiveKSec: number } | null {
  const est = fiveKFromRun(run.distanceKm, run.durationSec);
  if (est == null || est > p.fiveKSec * (1 - MIN_GAIN)) return null;
  const fiveKSec = Math.round(Math.max(est, p.fiveKSec * (1 - MAX_STEP)));
  const fresh = pacesFrom(fiveKSec, 0);
  const paces: Paces = { ...fresh, race: p.paces.race };
  const keys = ['easy', 'long', 'tempo', 'interval', 'recovery'] as const;
  const same = (a: PaceBand, b: PaceBand) => a.fast === b.fast && a.slow === b.slow;
  const swap = (band?: PaceBand) => {
    if (!band) return band;
    const k = keys.find(key => same(p.paces[key], band));
    return k ? paces[k] : band;
  };
  const relabel = (text: string) =>
    keys.reduce((t, k) => t.split(fmtBand(p.paces[k])).join(fmtBand(paces[k])), text);

  const weeks = p.weeks.map(w => ({
    ...w,
    sessions: w.sessions.map(s => (s.status !== 'planned' || s.date < today) ? s : {
      ...s,
      summary: relabel(s.summary),
      title: relabel(s.title),
      steps: s.steps.map(st => ({ ...st, pace: swap(st.pace) })),
    }),
  }));
  return { plan: { ...p, fiveKSec, paces, weeks }, fiveKSec };
}
