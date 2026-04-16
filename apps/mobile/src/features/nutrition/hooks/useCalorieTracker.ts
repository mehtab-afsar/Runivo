import { useState, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { NutritionEntry, NutritionProfile } from '@shared/services/store';
import { getNutritionEntriesRange, getRunsSince } from '@shared/services/store';
import type { Meal } from '@features/nutrition/types';
import {
  fetchTodayEntries,
  fetchNutritionProfile,
  addEntry,
  deleteEntry,
  todayKey,
} from '@features/nutrition/services/nutritionService';

function getWeekDates(): string[] {
  const dates: string[] = [];
  const today = new Date();
  // Start from Monday of current week
  const day = today.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

export function useCalorieTracker() {
  const [profile, setProfile]         = useState<NutritionProfile | null>(null);
  const [entries, setEntries]         = useState<NutritionEntry[]>([]);
  const [weekEntries, setWeekEntries] = useState<Record<string, NutritionEntry[]>>({});
  const [runBurnKcal, setRunBurnKcal] = useState(0);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [defaultMeal, setDefaultMeal] = useState<Meal>('snacks');
  const [expandedMeal, setExpandedMeal] = useState<Meal | null>(null);

  const today = todayKey();

  const load = useCallback(async () => {
    const prof = await fetchNutritionProfile();
    if (!prof) {
      setLoading(false);
      setRefreshing(false);
      return null;
    }
    setProfile(prof);
    const e = await fetchTodayEntries(today);
    setEntries(e);

    // Weekly entries for chart
    const weekDates = getWeekDates();
    try {
      const range = await getNutritionEntriesRange(weekDates[0], weekDates[weekDates.length - 1]);
      const byDate: Record<string, NutritionEntry[]> = {};
      weekDates.forEach(d => { byDate[d] = []; });
      range.forEach(entry => { if (byDate[entry.date]) byDate[entry.date].push(entry); });
      setWeekEntries(byDate);
    } catch { /* offline */ }

    // Run calorie burn today
    try {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayRuns = await getRunsSince(todayStart.getTime());
      const burn = todayRuns.reduce((s, r) => s + Math.round(r.distanceMeters / 1000 * 60 * 0.95), 0);
      setRunBurnKcal(burn);
    } catch { /* offline */ }

    setLoading(false);
    setRefreshing(false);
    return prof;
  }, [today]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const { consumed, remaining, pct, proteinConsumed, carbsConsumed, fatConsumed } =
    useMemo(() => {
      const food = entries.filter(e => e.source !== 'run');
      const consumed = food.reduce((s, e) => s + e.kcal, 0);
      const dailyGoal = profile?.dailyGoalKcal ?? 2000;
      return {
        consumed,
        remaining: Math.max(0, dailyGoal - consumed),
        pct: Math.min(consumed / Math.max(dailyGoal, 1), 1),
        proteinConsumed: entries.reduce((s, e) => s + e.proteinG, 0),
        carbsConsumed: entries.reduce((s, e) => s + e.carbsG, 0),
        fatConsumed: entries.reduce((s, e) => s + e.fatG, 0),
      };
    }, [entries, profile]);

  const handleAddEntry = useCallback(
    async (entry: Omit<NutritionEntry, 'id' | 'date' | 'loggedAt' | 'xpAwarded'>) => {
      const full: NutritionEntry = {
        ...entry,
        date: today,
        loggedAt: Date.now(),
        xpAwarded: false,
      };
      const id = await addEntry(full as Omit<NutritionEntry, 'id'>);
      setEntries(prev => [...prev, { ...full, id }]);
      setShowAddModal(false);
    },
    [today],
  );

  const handleDeleteEntry = useCallback(async (id: number) => {
    await deleteEntry(id);
    setEntries(prev => prev.filter(e => e.id !== id));
  }, []);

  const openAdd = useCallback((meal: Meal) => {
    setDefaultMeal(meal);
    setShowAddModal(true);
  }, []);

  const { weekKcals, weekAvg, weekDates } = useMemo(() => {
    const dates = getWeekDates();
    const kcals = dates.map(d =>
      (weekEntries[d] ?? []).filter(e => e.source !== 'run').reduce((s, e) => s + e.kcal, 0)
    );
    const logged = kcals.filter(k => k > 0);
    return {
      weekDates: dates,
      weekKcals: kcals,
      weekAvg: logged.length > 0 ? Math.round(logged.reduce((a, b) => a + b, 0) / logged.length) : 0,
    };
  }, [weekEntries]);

  return {
    profile,
    entries,
    weekEntries,
    weekKcals,
    weekAvg,
    weekDates,
    runBurnKcal,
    loading,
    refreshing,
    showAddModal,
    setShowAddModal,
    defaultMeal,
    expandedMeal,
    setExpandedMeal,
    consumed,
    remaining,
    pct,
    proteinConsumed,
    carbsConsumed,
    fatConsumed,
    addEntry: handleAddEntry,
    deleteEntry: handleDeleteEntry,
    refresh,
    openAdd,
  };
}
