import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ProfileForm, PhotoChange, Gender } from '../components/EditProfileSheet';
import type { StoredRun } from '@shared/services/store';
import { getSettings, saveSettings } from '@shared/services/store';
import { supabase } from '@shared/services/supabase';
import {
  fetchProfileData, updateProfile, uploadAvatar,
  fetchAwards, fetchProfileStats, setPinnedRun, fetchFollowCounts,
} from '../services/profileService';
import type { ProfileTab } from '../types';
import type { ProfileStats } from '@shared/types/game';

const SWATCHES = ['#0A0A0A', '#D93518', '#3B82F6', '#1A6B40', '#F59E0B', '#8B5CF6'];

export interface PersonalRecord {
  label: string;
  value: string;
}

export function useProfile() {
  const [runs, setRuns] = useState<StoredRun[]>([]);
  const [weeklyGoalKm, setWeeklyGoalKm] = useState(20);
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([]);
  const [tab, setTab] = useState<ProfileTab>('overview');

  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);

  // New: awards, stats, pinned run
  const [earnedAwards, setEarnedAwards] = useState<{ awardId: string; unlockedAt: string }[]>([]);
  const [statsPeriod, setStatsPeriod] = useState<'week' | 'month' | 'year' | 'all'>('all');
  const [statsData, setStatsData] = useState<ProfileStats>({ totalKm: 0, totalRuns: 0, avgPaceSec: 0, totalCalories: 0, totalZones: 0 });
  const [pinnedRunId, setPinnedRunId] = useState<string | null>(null);
  const [avatarColor, setAvatarColor] = useState(SWATCHES[0]);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [instagram, setInstagram] = useState('');
  const [strava, setStrava] = useState('');

  const [gender, setGender] = useState<Gender>(null);
  const [age, setAge] = useState<number | null>(null);
  const [heightCm, setHeightCm] = useState<number | null>(null);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const load = useCallback(async () => {
    const data = await fetchProfileData();
    setRuns(data.runs);
    setWeeklyGoalKm(data.weeklyGoalKm);
    setPersonalRecords(data.personalRecords);
    setFollowers(data.followers);
    setFollowing(data.following);
    if (data.avatarColor) setAvatarColor(data.avatarColor);
    if (data.displayName) setDisplayName(data.displayName);
    if (data.bio) setBio(data.bio);
    if (data.location) setLocation(data.location);
    if (data.instagram) setInstagram(data.instagram);
    if (data.strava) setStrava(data.strava);
    if (data.avatarUrl) setAvatarUri(data.avatarUrl);
    setGender(data.gender === 'male' || data.gender === 'female' || data.gender === 'other' ? data.gender : null);
    setAge(data.age);
    setHeightCm(data.heightCm);
    setWeightKg(data.weightKg);

    // Sync Supabase profile preferences back to local settings store
    // so other screens (dashboard weekly goal, distance unit, etc.) pick them up
    const toWrite: Partial<Parameters<typeof saveSettings>[0]> = {};
    if (data.weeklyGoalKm != null) toWrite.weeklyGoalKm = data.weeklyGoalKm;
    if (data.distanceUnit === 'km' || data.distanceUnit === 'mi') toWrite.distanceUnit = data.distanceUnit;
    if (data.notificationsEnabled != null) toWrite.notificationsEnabled = data.notificationsEnabled;
    if (data.profileVisibility === 'public' || data.profileVisibility === 'followers' || data.profileVisibility === 'private') {
      toWrite.privacy = data.profileVisibility;
    }
    if (Object.keys(toWrite).length > 0) {
      const current = await getSettings();
      await saveSettings({ ...current, ...toWrite });
    }

    // Load awards and stats
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const [awards, stats] = await Promise.all([
        fetchAwards(session.user.id),
        fetchProfileStats(session.user.id, 'all'),
      ]);
      setEarnedAwards(awards);
      setStatsData(stats);
    }
  }, []);

  const loadStats = useCallback(async (period: 'week' | 'month' | 'year' | 'all') => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const stats = await fetchProfileStats(session.user.id, period);
    setStatsData(stats);
  }, []);

  // Cheap, focus-triggered refresh — full `load()` reloads runs/records/awards
  // and would flash the loading state every time this tab regains focus.
  // Counts alone are the one thing that reliably goes stale after following
  // someone from FollowersScreen/FollowingScreen and tabbing back here.
  const refreshCounts = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { followers: f, following: g } = await fetchFollowCounts(session.user.id);
    setFollowers(f);
    setFollowing(g);
  }, []);

  useEffect(() => { load(); }, [load]);

  const thisWeekKm = useMemo(() => {
    const now = new Date();
    const todayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - todayIdx);
    weekStart.setHours(0, 0, 0, 0);
    return runs
      .filter(r => r.startTime >= weekStart.getTime())
      .filter(r => !r.excluded).reduce((s, r) => s + r.distanceMeters / 1000, 0);
  }, [runs]);

  // The editor's starting values (EditProfileSheet keeps its own draft).
  const editInitial = useMemo((): ProfileForm => ({
    displayName, bio, location, instagram, strava, avatarColor, gender,
    age: age != null ? String(age) : '',
    heightCm: heightCm != null ? String(heightCm) : '',
    weightKg: weightKg != null ? String(weightKg) : '',
  }), [displayName, bio, location, instagram, strava, avatarColor, gender, age, heightCm, weightKg]);

  const startEdit = useCallback(() => setIsEditing(true), []);
  const cancelEdit = useCallback(() => setIsEditing(false), []);

  /** Saves the editor's form; throws (with a readable message) if it didn't save. */
  const saveProfile = useCallback(async (form: ProfileForm, photo: PhotoChange) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('You are signed out. Sign in again to save.');
    let avatarUrl: string | null | undefined;
    if (photo?.kind === 'new') {
      const url = await uploadAvatar(session.user.id, photo.uri);
      if (!url) throw new Error("Couldn't upload your photo. Try again, or save without it.");
      avatarUrl = `${url}?v=${Date.now()}`;   // new URL so cached copies of the old photo don't show
    } else if (photo?.kind === 'remove') {
      avatarUrl = null;
    }
    const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
    const nextAge = num(form.age), nextHeight = num(form.heightCm), nextWeight = num(form.weightKg);
    await updateProfile(session.user.id, {
      display_name: form.displayName || null,
      bio: form.bio || null,
      avatar_color: form.avatarColor,
      location: form.location || null,
      instagram: form.instagram.trim() || null,
      strava: form.strava.trim() || null,
      gender: form.gender,
      age: nextAge != null ? Math.round(nextAge) : null,
      height_cm: nextHeight != null ? Math.round(nextHeight) : null,
      weight_kg: nextWeight != null ? Math.round(nextWeight * 10) / 10 : null,
      ...(avatarUrl !== undefined ? { avatar_url: avatarUrl } : {}),
    });
    setDisplayName(form.displayName);
    setBio(form.bio);
    setAvatarColor(form.avatarColor);
    setLocation(form.location);
    setInstagram(form.instagram.trim());
    setStrava(form.strava.trim());
    setGender(form.gender);
    setAge(nextAge != null ? Math.round(nextAge) : null);
    setHeightCm(nextHeight != null ? Math.round(nextHeight) : null);
    setWeightKg(nextWeight);
    if (avatarUrl !== undefined) setAvatarUri(avatarUrl);
    setIsEditing(false);
  }, []);

  const pinRun = useCallback(async (runId: string | null) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await setPinnedRun(session.user.id, runId);
    setPinnedRunId(runId);
  }, []);

  return {
    runs, weeklyGoalKm, personalRecords, thisWeekKm,
    followers, following,
    tab, setTab,
    avatarColor, avatarUri, displayName, bio, location, instagram, strava,
    isEditing, editInitial, startEdit, cancelEdit, saveProfile,
    earnedAwards,
    statsData, statsPeriod, setStatsPeriod: (p: 'week' | 'month' | 'year' | 'all') => {
      setStatsPeriod(p);
      loadStats(p);
    },
    pinnedRunId, pinRun,
    refreshCounts,
    /** After the goal sheet saved a new weekly goal (H4). */
    setWeeklyGoal: setWeeklyGoalKm,
  };
}
