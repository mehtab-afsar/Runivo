import { useState, useCallback } from 'react';
import { saveShoe, type StoredShoe } from '@shared/services/store';
import { uploadShoePhoto } from '@features/gear/services/gearService';

type Category = StoredShoe['category'];

export const MAX_KM_DEFAULTS: Record<Category, number> = {
  road: 700, trail: 500, track: 400, casual: 300,
};

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export function useGearAdd() {
  const [brand, setBrand]       = useState('');
  const [model, setModel]       = useState('');
  const [nickname, setNickname] = useState('');
  const [category, setCategory] = useState<Category>('road');
  const [maxKm, setMaxKm]       = useState(String(MAX_KM_DEFAULTS.road));
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const isValid = brand.trim().length > 0 && model.trim().length > 0;

  const updateField = useCallback((field: string, value: string) => {
    switch (field) {
      case 'brand':    setBrand(value);    break;
      case 'model':    setModel(value);    break;
      case 'nickname': setNickname(value); break;
      case 'maxKm':    setMaxKm(value);    break;
    }
  }, []);

  const updateCategory = useCallback((cat: Category) => {
    setCategory(cat);
    setMaxKm(String(MAX_KM_DEFAULTS[cat]));
  }, []);

  const submit = useCallback(async (): Promise<boolean> => {
    if (!isValid) return false;
    setSubmitting(true);
    try {
      const id = uuid();
      let resolvedPhotoUrl: string | null = null;
      if (photoUri) {
        setUploadingPhoto(true);
        resolvedPhotoUrl = await uploadShoePhoto(photoUri, id);
        setUploadingPhoto(false);
      }
      const shoe: StoredShoe = {
        id,
        brand: brand.trim(),
        model: model.trim(),
        nickname: nickname.trim() || null,
        category,
        maxKm: parseFloat(maxKm) || MAX_KM_DEFAULTS[category],
        isRetired: false,
        isDefault: false,
        color: null,
        notes: null,
        purchasedAt: null,
        createdAt: Date.now(),
        synced: false,
        ...(resolvedPhotoUrl ? { photoUrl: resolvedPhotoUrl } : {}),
      } as StoredShoe;
      await saveShoe(shoe);
      return true;
    } catch {
      return false;
    } finally {
      setSubmitting(false);
      setUploadingPhoto(false);
    }
  }, [brand, model, nickname, category, maxKm, photoUri, isValid]);

  return {
    brand, model, nickname, category, maxKm, photoUri,
    setPhotoUri,
    updateField, updateCategory,
    submit, isValid, submitting, uploadingPhoto,
  };
}
