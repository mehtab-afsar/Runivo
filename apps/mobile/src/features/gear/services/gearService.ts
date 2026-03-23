import {
  getShoes,
  getRuns,
  saveShoe,
  deleteShoe,
  type StoredShoe,
} from '@shared/services/store';
import { supabase } from '@shared/services/supabase';

export async function fetchShoes(): Promise<StoredShoe[]> {
  return getShoes();
}

export async function fetchRunsForShoe(shoeId: string): Promise<number> {
  const runs = await getRuns(500);
  return runs
    .filter(r => r.shoeId === shoeId)
    .reduce((sum, r) => sum + r.distanceMeters / 1000, 0);
}

export async function fetchShoeKmMap(): Promise<Record<string, number>> {
  const runs = await getRuns(500);
  const km: Record<string, number> = {};
  for (const run of runs) {
    if (run.shoeId) {
      km[run.shoeId] = (km[run.shoeId] ?? 0) + run.distanceMeters / 1000;
    }
  }
  return km;
}

export async function setDefaultShoe(id: string, allShoes: StoredShoe[]): Promise<StoredShoe[]> {
  const updated = allShoes.map(s => ({ ...s, isDefault: s.id === id }));
  for (const s of updated) await saveShoe(s);
  return updated;
}

export async function retireShoe(id: string, allShoes: StoredShoe[]): Promise<StoredShoe[]> {
  const updated = allShoes.map(s => s.id === id ? { ...s, isRetired: true } : s);
  const shoe = updated.find(s => s.id === id);
  if (shoe) await saveShoe(shoe);
  return updated;
}

export async function deleteShoeById(id: string): Promise<void> {
  return deleteShoe(id);
}

export async function addShoe(shoe: StoredShoe): Promise<void> {
  await saveShoe(shoe);
}

export async function uploadShoePhoto(localUri: string, shoeId: string): Promise<string | null> {
  try {
    const response = await fetch(localUri);
    const blob = await response.blob();
    const ext = localUri.split('.').pop() ?? 'jpg';
    const path = `shoes/${shoeId}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('user-media')
      .upload(path, blob, { contentType: `image/${ext}`, upsert: true });

    if (uploadErr) { console.warn('[gear] photo upload failed:', uploadErr); return null; }

    const { data: { publicUrl } } = supabase.storage.from('user-media').getPublicUrl(path);
    return publicUrl;
  } catch (err) {
    console.warn('[gear] photo upload error:', err);
    return null;
  }
}
