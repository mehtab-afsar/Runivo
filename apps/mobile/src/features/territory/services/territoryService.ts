import { getAllTerritories, getPlayer, type StoredTerritory } from '@shared/services/store';
import { supabase } from '@shared/services/supabase';

export type { StoredTerritory };

export async function fetchMyTerritories(): Promise<{ territories: StoredTerritory[]; playerId: string }> {
  const [player, all] = await Promise.all([getPlayer(), getAllTerritories()]);
  return { territories: all, playerId: player?.id ?? '' };
}

export async function fetchAllTerritories(): Promise<StoredTerritory[]> {
  return getAllTerritories();
}

export function subscribeToTerritoryChanges(
  onUpdate: (territories: StoredTerritory[]) => void,
): () => void {
  const channel = supabase
    .channel('territory-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'territories' },
      async () => {
        const all = await getAllTerritories();
        onUpdate(all);
      },
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

export async function fortifyTerritory(h3Index: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('fortify_territory', { p_h3_index: h3Index, p_user_id: userId });
  if (error) throw error;
}
