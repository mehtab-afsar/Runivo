import { useState, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { NutritionEntry, NutritionProfile } from '@shared/services/store';
import type { Meal } from '@features/nutrition/types';
import {
  fetchTodayEntries,
  fetchNutritionProfile,
  addEntry,
  deleteEntry,
  todayKey,
} from '@features/nutrition/services/nutritionService';

export function useCalorieTracker() {
  const [profile, setProfile]         = useState<NutritionProfile | null>(null);
  const [entries, setEntries]         = useState<NutritionEntry[]>([]);
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
      return null; // signal no profile to screen
    }
    setProfile(prof);
    const e = await fetchTodayEntries(today);
    setEntries(e);
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

  return {
    profile,
    entries,
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
