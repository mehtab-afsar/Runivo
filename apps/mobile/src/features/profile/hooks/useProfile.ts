import { useState, useEffect, useCallback, useMemo } from 'react';
import type { StoredRun, StoredShoe } from '@shared/services/store';
import { supabase } from '@shared/services/supabase';
import { fetchProfileData, updateProfile } from '../services/profileService';
import type { ProfileTab } from '../types';

const SWATCHES = ['#0A0A0A', '#E8435A', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];

export interface PersonalRecord {
  label: string;
  value: string;
}

export function useProfile() {
  const [runs, setRuns] = useState<StoredRun[]>([]);
  const [shoes, setShoes] = useState<StoredShoe[]>([]);
  const [weeklyGoalKm, setWeeklyGoalKm] = useState(20);
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([]);
  const [tab, setTab] = useState<ProfileTab>('overview');

  const [avatarColor, setAvatarColor] = useState(SWATCHES[0]);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(SWATCHES[0]);
  const [editBio, setEditBio] = useState('');

  const load = useCallback(async () => {
    const data = await fetchProfileData();
    setRuns(data.runs);
    setShoes(data.shoes);
    setWeeklyGoalKm(data.weeklyGoalKm);
    setPersonalRecords(data.personalRecords);
    if (data.avatarColor) setAvatarColor(data.avatarColor);
    if (data.displayName) setDisplayName(data.displayName);
    if (data.bio) setBio(data.bio);
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
      .reduce((s, r) => s + r.distanceMeters / 1000, 0);
  }, [runs]);

  const startEdit = useCallback(() => {
    setEditName(displayName);
    setEditColor(avatarColor);
    setEditBio(bio);
    setIsEditing(true);
  }, [displayName, avatarColor, bio]);

  const cancelEdit = useCallback(() => setIsEditing(false), []);

  const saveEdit = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await updateProfile(session.user.id, {
      display_name: editName,
      bio: editBio,
      avatar_color: editColor,
    });
    setDisplayName(editName);
    setBio(editBio);
    setAvatarColor(editColor);
    setIsEditing(false);
  }, [editName, editBio, editColor]);

  return {
    runs,
    shoes,
    weeklyGoalKm,
    personalRecords,
    thisWeekKm,
    tab,
    setTab,
    avatarColor,
    displayName,
    bio,
    isEditing,
    editName,
    setEditName,
    editColor,
    setEditColor,
    editBio,
    setEditBio,
    startEdit,
    saveEdit,
    cancelEdit,
  };
}
