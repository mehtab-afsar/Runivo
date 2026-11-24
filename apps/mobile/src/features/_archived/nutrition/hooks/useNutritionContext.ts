/**
 * useNutritionContext — rule-based context messages for the calorie tracker.
 * No API calls. Reads today's runs from store + current nutrition data.
 */
import { useState, useEffect } from 'react';
import { getRuns } from '@shared/services/store';

interface NutritionContext {
  headerMessage: string | null;
  proteinNote: string | null;
  carbsNote: string | null;
  fatNote: string | null;
}

interface Params {
  proteinConsumed: number;
  proteinGoal: number;
  carbsConsumed: number;
  carbsGoal: number;
  fatConsumed: number;
  fatGoal: number;
}

function todayStart(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function useNutritionContext({ proteinConsumed, proteinGoal, carbsConsumed, carbsGoal, fatConsumed, fatGoal }: Params): NutritionContext {
  const [ranToday, setRanToday] = useState(false);
  const [runKm, setRunKm]       = useState(0);

  useEffect(() => {
    const since = todayStart();
    getRuns(50).then(runs => {
      const todayRuns = runs.filter(r => (r.startTime ?? 0) >= since);
      const km = todayRuns.reduce((s, r) => s + r.distanceMeters / 1000, 0);
      setRanToday(km > 0.5);
      setRunKm(km);
    }).catch(() => {});
  }, []);

  const hour = new Date().getHours();
  const isEvening = hour >= 20;
  const proteinLow = proteinConsumed < proteinGoal * 0.5;

  // Header message
  let headerMessage: string | null = null;
  if (ranToday && runKm > 0) {
    headerMessage = `Great run today! Refuel with ${Math.round(runKm * 4)}g carbs + 30-40g protein in the next 2 hours.`;
  } else if (isEvening && proteinLow) {
    headerMessage = 'Protein is low for the day — add a protein-rich snack before bed.';
  } else if (isEvening) {
    headerMessage = "You're on track for the day. Keep it up!";
  }

  // Macro notes
  const proteinNote: string | null = ranToday
    ? 'Post-run: aim for 30-40g protein to kickstart muscle repair.'
    : proteinLow && isEvening
    ? 'Protein is low — add eggs, Greek yoghurt, or a shake.'
    : null;

  const carbsNote: string | null = ranToday
    ? `You ran ${runKm.toFixed(1)}km — replenish with ${Math.round(runKm * 4)}g carbs.`
    : carbsConsumed > carbsGoal * 1.1
    ? 'Carbs are slightly over goal today.'
    : null;

  const fatNote: string | null = fatConsumed > fatGoal * 1.15
    ? 'Fat intake is a bit high — watch oils and dressings.'
    : null;

  return { headerMessage, proteinNote, carbsNote, fatNote };
}
