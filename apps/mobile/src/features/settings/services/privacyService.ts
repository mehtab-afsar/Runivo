import { supabase } from '@shared/services/supabase';
import { getSettings, saveSettings } from '@shared/services/store';

/** Private places and the two hide switches (20261113000010_privacy_places_controls.sql). */
export interface PrivatePlace { id: string; label: string; lat: number; lng: number; radiusM: number }
export interface PrivacyControls { hideFromLeaderboards: boolean; hideZonesFromMap: boolean }

async function cachePlaces(places: PrivatePlace[]): Promise<void> {
  const s = await getSettings();
  await saveSettings({ ...s, privatePlaces: places });
}

export async function fetchPrivatePlaces(): Promise<PrivatePlace[]> {
  const { data, error } = await supabase.rpc('get_my_privacy_places');
  if (error) return (await getSettings()).privatePlaces ?? [];
  const places = ((data ?? []) as { id: string; label: string; radius_m: number; lat: number; lng: number }[])
    .map(r => ({ id: r.id, label: r.label, lat: r.lat, lng: r.lng, radiusM: r.radius_m }));
  await cachePlaces(places).catch(() => {});
  return places;
}

export async function addPrivatePlace(label: string, lat: number, lng: number, radiusM: number): Promise<PrivatePlace[]> {
  const { error } = await supabase.rpc('add_privacy_place', { p_label: label, p_lat: lat, p_lng: lng, p_radius_m: radiusM });
  if (error) throw new Error(error.message);
  return fetchPrivatePlaces();
}

export async function removePrivatePlace(id: string): Promise<PrivatePlace[]> {
  const { error } = await supabase.rpc('remove_privacy_place', { p_id: id });
  if (error) throw new Error(error.message);
  return fetchPrivatePlaces();
}

export async function fetchPrivacyControls(): Promise<PrivacyControls> {
  const { data: { user } } = await supabase.auth.getUser();
  const local = await getSettings();
  const fallback = { hideFromLeaderboards: !!local.hideFromLeaderboards, hideZonesFromMap: !!local.hideZonesFromMap };
  if (!user) return fallback;
  const { data } = await supabase.from('profiles').select('hide_from_leaderboards, hide_zones_from_map').eq('id', user.id).maybeSingle();
  return data ? { hideFromLeaderboards: !!data.hide_from_leaderboards, hideZonesFromMap: !!data.hide_zones_from_map } : fallback;
}

export async function savePrivacyControls(c: Partial<PrivacyControls>): Promise<void> {
  const { error } = await supabase.rpc('set_privacy_controls', {
    p_hide_from_leaderboards: c.hideFromLeaderboards ?? null, p_hide_zones_from_map: c.hideZonesFromMap ?? null,
  });
  if (error) throw new Error(error.message);
  const s = await getSettings();
  await saveSettings({ ...s, ...c });
}
