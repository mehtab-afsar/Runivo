/**
 * T8: short strength and mobility sessions for runners (10–20 minutes).
 * Each step is timed; the guided screen walks through them with a countdown.
 */
export interface StrengthStep { name: string; seconds: number; cue: string; rest?: boolean }
export interface StrengthSession { id: string; title: string; focus: 'strength' | 'mobility'; minutes: number; blurb: string; steps: StrengthStep[] }

const rest = (seconds = 15): StrengthStep => ({ name: 'Rest', seconds, cue: 'Shake it out, breathe.', rest: true });
const circuit = (steps: StrengthStep[], rounds: number, restSec = 15): StrengthStep[] =>
  Array.from({ length: rounds }, () => steps.flatMap(s => [s, rest(restSec)])).flat().slice(0, -1);

export const STRENGTH_SESSIONS: StrengthSession[] = [
  {
    id: 'core-12', title: 'Runner core', focus: 'strength', minutes: 12,
    blurb: 'A steady trunk keeps your stride efficient late in a run.',
    steps: circuit([
      { name: 'Plank', seconds: 40, cue: 'Elbows under shoulders, squeeze your glutes.' },
      { name: 'Dead bug', seconds: 40, cue: 'Low back pressed down, move slowly.' },
      { name: 'Side plank, left', seconds: 30, cue: 'Hips high, body in a line.' },
      { name: 'Side plank, right', seconds: 30, cue: 'Hips high, body in a line.' },
      { name: 'Glute bridge', seconds: 40, cue: 'Drive through your heels, pause at the top.' },
    ], 3),
  },
  {
    id: 'legs-16', title: 'Strong legs', focus: 'strength', minutes: 16,
    blurb: 'Single-leg work for knees and ankles that hold up to mileage.',
    steps: circuit([
      { name: 'Split squat, left', seconds: 40, cue: 'Front knee over the ankle, torso tall.' },
      { name: 'Split squat, right', seconds: 40, cue: 'Front knee over the ankle, torso tall.' },
      { name: 'Single-leg calf raise, left', seconds: 30, cue: 'All the way up, slow down.' },
      { name: 'Single-leg calf raise, right', seconds: 30, cue: 'All the way up, slow down.' },
      { name: 'Squat', seconds: 40, cue: 'Sit back, chest up, knees track your toes.' },
      { name: 'Single-leg deadlift, alternate', seconds: 40, cue: 'Hinge at the hip, back flat.' },
    ], 3, 15),
  },
  {
    id: 'hips-12', title: 'Hip stability', focus: 'strength', minutes: 12,
    blurb: 'Glute medius work: the fix for knees that cave in.',
    steps: circuit([
      { name: 'Clamshell, left', seconds: 40, cue: 'Heels together, open the top knee.' },
      { name: 'Clamshell, right', seconds: 40, cue: 'Heels together, open the top knee.' },
      { name: 'Side-lying leg raise, left', seconds: 30, cue: 'Toes forward, lift from the hip.' },
      { name: 'Side-lying leg raise, right', seconds: 30, cue: 'Toes forward, lift from the hip.' },
      { name: 'Single-leg bridge, alternate', seconds: 40, cue: 'Hips level, no twisting.' },
    ], 3),
  },
  {
    id: 'mobility-10', title: 'Post-run mobility', focus: 'mobility', minutes: 10,
    blurb: 'Gentle range of motion for after a run. Never push into pain.',
    steps: [
      { name: 'Easy marching on the spot', seconds: 60, cue: 'Let your heart rate settle.' },
      { name: 'Standing quad stretch, left', seconds: 45, cue: 'Knees together, hips forward.' },
      { name: 'Standing quad stretch, right', seconds: 45, cue: 'Knees together, hips forward.' },
      { name: 'Calf stretch on a wall, left', seconds: 45, cue: 'Back heel down, lean in.' },
      { name: 'Calf stretch on a wall, right', seconds: 45, cue: 'Back heel down, lean in.' },
      { name: 'Hip flexor lunge, left', seconds: 45, cue: 'Tuck your pelvis, squeeze the back glute.' },
      { name: 'Hip flexor lunge, right', seconds: 45, cue: 'Tuck your pelvis, squeeze the back glute.' },
      { name: 'Hamstring fold', seconds: 60, cue: 'Soft knees, let your head hang.' },
      { name: 'Figure-four, left', seconds: 45, cue: 'Ankle over knee, sit back.' },
      { name: 'Figure-four, right', seconds: 45, cue: 'Ankle over knee, sit back.' },
      { name: "Child's pose", seconds: 60, cue: 'Breathe into your back.' },
    ],
  },
  {
    id: 'warmup-8', title: 'Pre-run warm-up', focus: 'mobility', minutes: 8,
    blurb: 'Dynamic moves to wake your legs up before a hard session.',
    steps: [
      { name: 'Easy jog or brisk walk', seconds: 180, cue: 'Conversational, just getting warm.' },
      { name: 'Leg swings, front to back, left', seconds: 30, cue: 'Hold something, swing loose.' },
      { name: 'Leg swings, front to back, right', seconds: 30, cue: 'Hold something, swing loose.' },
      { name: 'Leg swings, side to side', seconds: 40, cue: 'Swap legs halfway.' },
      { name: 'Walking lunges', seconds: 45, cue: 'Long steps, upright.' },
      { name: 'High knees', seconds: 30, cue: 'Quick feet, light contacts.' },
      { name: 'Butt kicks', seconds: 30, cue: 'Heels to glutes.' },
      { name: 'A-skips', seconds: 40, cue: 'Drive the knee, stay tall.' },
      { name: 'Strides', seconds: 60, cue: 'Build to fast-but-relaxed, walk back.' },
    ],
  },
  {
    id: 'full-17', title: 'Full-body for runners', focus: 'strength', minutes: 17,
    blurb: 'Twice a week with your plan: legs, hips, core and upper back.',
    steps: circuit([
      { name: 'Squat', seconds: 45, cue: 'Sit back, chest up.' },
      { name: 'Push-up', seconds: 40, cue: 'Body in a line; knees down is fine.' },
      { name: 'Reverse lunge, alternate', seconds: 45, cue: 'Step back, front knee steady.' },
      { name: 'Superman', seconds: 40, cue: 'Lift chest and legs, look down.' },
      { name: 'Plank shoulder taps', seconds: 40, cue: 'Hips still as you tap.' },
      { name: 'Calf raise', seconds: 40, cue: 'Slow down for three counts.' },
    ], 3, 15),
  },
];

export const sessionSeconds = (s: StrengthSession): number => s.steps.reduce((n, x) => n + x.seconds, 0);
