import { getRuns, getShoes, getSettings } from '@shared/services/store';
import { calculatePersonalRecords, formatRecordValue, getRecordLabel } from '@shared/services/personalRecords';
import { supabase } from '@shared/services/supabase';

export async function fetchProfileData() {
  const [runs, shoes, settings] = await Promise.all([
    getRuns(200),
    getShoes(),
    getSettings(),
  ]);

  const records = await calculatePersonalRecords();
  const personalRecords = records
    .slice(0, 6)
    .map((r: any) => ({ label: getRecordLabel(r.type), value: formatRecordValue(r) }));

  const { data: { session } } = await supabase.auth.getSession();
  let avatarColor: string | null = null;
  let displayName: string | null = null;
  let bio: string | null = null;

  if (session) {
    const { data } = await supabase
      .from('profiles')
      .select('bio, avatar_color, display_name')
      .eq('id', session.user.id)
      .single();
    if (data) {
      avatarColor = data.avatar_color ?? null;
      displayName = data.display_name ?? null;
      bio = data.bio ?? null;
    }
  }

  return { runs, shoes, weeklyGoalKm: settings.weeklyGoalKm, personalRecords, avatarColor, displayName, bio };
}

export async function updateProfile(
  userId: string,
  patch: { display_name?: string; bio?: string; avatar_color?: string },
): Promise<void> {
  await supabase.from('profiles').update(patch).eq('id', userId);
}

export async function updateUsername(userId: string, name: string): Promise<void> {
  await supabase.from('profiles').update({ display_name: name }).eq('id', userId);
}

export async function updateAvatarColor(userId: string, color: string): Promise<void> {
  await supabase.from('profiles').update({ avatar_color: color }).eq('id', userId);
}
