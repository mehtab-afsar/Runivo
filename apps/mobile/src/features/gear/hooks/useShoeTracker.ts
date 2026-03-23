import { useState, useEffect, useCallback } from 'react';
import type { StoredShoe } from '@shared/services/store';
import {
  fetchShoes,
  fetchShoeKmMap,
  setDefaultShoe,
  retireShoe,
  deleteShoeById,
} from '@features/gear/services/gearService';

export function useShoeTracker() {
  const [shoes, setShoes]     = useState<StoredShoe[]>([]);
  const [shoeKm, setShoeKm]   = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [allShoes, km] = await Promise.all([fetchShoes(), fetchShoeKmMap()]);
      setShoes(allShoes);
      setShoeKm(km);
    } catch { /* offline */ }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const handleSetDefault = useCallback(async (id: string) => {
    const updated = await setDefaultShoe(id, shoes);
    setShoes(updated);
  }, [shoes]);

  const handleRetire = useCallback(async (id: string) => {
    const updated = await retireShoe(id, shoes);
    setShoes(updated);
  }, [shoes]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteShoeById(id);
    setShoes(prev => prev.filter(s => s.id !== id));
  }, []);

  return {
    shoes,
    shoeKm,
    loading,
    refreshing,
    refresh,
    setDefault: handleSetDefault,
    retire: handleRetire,
    deleteShoe: handleDelete,
  };
}
