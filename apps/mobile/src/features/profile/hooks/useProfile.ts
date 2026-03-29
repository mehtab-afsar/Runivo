import { useState, useEffect, useCallback, useMemo } from 'react';
import * as ImagePicker from 'expo-image-picker';
import type { StoredRun, StoredShoe } from '@shared/services/store';
import { supabase } from '@shared/services/supabase';
import { fetchProfileData, updateProfile, uploadAvatar } from '../services/profileService';
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
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [instagram, setInstagram] = useState('');
  const [strava, setStrava] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(SWATCHES[0]);
  const [editBio, setEditBio] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editInstagram, setEditInstagram] = useState('');
  const [editStrava, setEditStrava] = useState('');
  const [editAvatarUri, setEditAvatarUri] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await fetchProfileData();
    setRuns(data.runs);
    setShoes(data.shoes);
    setWeeklyGoalKm(data.weeklyGoalKm);
    setPersonalRecords(data.personalRecords);
    if (data.avatarColor) setAvatarColor(data.avatarColor);
    if (data.displayName) setDisplayName(data.displayName);
    if (data.bio) setBio(data.bio);
    if (data.location) setLocation(data.location);
    if (data.instagram) setInstagram(data.instagram);
    if (data.strava) setStrava(data.strava);
    if (data.avatarUrl) setAvatarUri(data.avatarUrl);
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

  const pickAvatar = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setEditAvatarUri(result.assets[0].uri);
    }
  }, []);

  const startEdit = useCallback(() => {
    setEditName(displayName);
    setEditColor(avatarColor);
    setEditBio(bio);
    setEditLocation(location);
    setEditInstagram(instagram);
    setEditStrava(strava);
    setEditAvatarUri(avatarUri);
    setIsEditing(true);
  }, [displayName, avatarColor, bio, location, instagram, strava, avatarUri]);

  const cancelEdit = useCallback(() => setIsEditing(false), []);

  const saveEdit = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    let newAvatarUrl: string | undefined;
    if (editAvatarUri && editAvatarUri !== avatarUri) {
      const url = await uploadAvatar(session.user.id, editAvatarUri);
      if (url) newAvatarUrl = url;
    }
    await updateProfile(session.user.id, {
      display_name: editName,
      bio: editBio,
      avatar_color: editColor,
      location: editLocation,
      instagram: editInstagram,
      strava: editStrava,
      ...(newAvatarUrl ? { avatar_url: newAvatarUrl } : {}),
    });
    setDisplayName(editName);
    setBio(editBio);
    setAvatarColor(editColor);
    setLocation(editLocation);
    setInstagram(editInstagram);
    setStrava(editStrava);
    if (newAvatarUrl) setAvatarUri(newAvatarUrl);
    setIsEditing(false);
  }, [editName, editBio, editColor, editLocation, editInstagram, editStrava, editAvatarUri, avatarUri]);

  return {
    runs, shoes, weeklyGoalKm, personalRecords, thisWeekKm,
    tab, setTab,
    avatarColor, avatarUri, displayName, bio, location, instagram, strava,
    isEditing,
    editName, setEditName,
    editColor, setEditColor,
    editBio, setEditBio,
    editLocation, setEditLocation,
    editInstagram, setEditInstagram,
    editStrava, setEditStrava,
    editAvatarUri, pickAvatar,
    startEdit, saveEdit, cancelEdit,
  };
}
