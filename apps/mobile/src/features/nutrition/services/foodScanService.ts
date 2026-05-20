import * as FileSystem from 'expo-file-system';
import { supabase } from '@shared/services/supabase';

export interface ScannedFood {
  name:        string;
  kcal:        number;
  proteinG:    number;
  carbsG:      number;
  fatG:        number;
  servingSize: string;
}

// ─── Barcode lookup via Open Food Facts ──────────────────────────────────────

export async function lookupBarcode(barcode: string): Promise<ScannedFood | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
      { headers: { 'User-Agent': 'Runivo/1.0 (https://runivo.app)' } },
    );
    if (!res.ok) return null;

    const json = await res.json();
    if (json.status !== 1 || !json.product) return null;

    const p   = json.product;
    const n   = p.nutriments ?? {};

    // Serving size in grams — fall back to 100g if missing
    const servingQtyG = parseFloat(p.serving_quantity ?? '') || 100;
    const factor      = servingQtyG / 100;

    const kcal100  = n['energy-kcal_100g'] ?? n['energy_100g'] ? (n['energy_100g'] ?? 0) / 4.184 : 0;
    const kcalPer  = n['energy-kcal_100g'] ?? kcal100;

    return {
      name:        (p.product_name_en || p.product_name || 'Unknown food').trim(),
      kcal:        Math.round(kcalPer * factor),
      proteinG:    Math.round((n.proteins_100g    ?? 0) * factor),
      carbsG:      Math.round((n.carbohydrates_100g ?? 0) * factor),
      fatG:        Math.round((n.fat_100g         ?? 0) * factor),
      servingSize: p.serving_size ?? `${servingQtyG}g`,
    };
  } catch {
    return null;
  }
}

// ─── AI photo scan via Claude Vision (Supabase edge function) ────────────────

export async function scanFoodPhoto(imageUri: string): Promise<ScannedFood | null> {
  try {
    // Convert image to base64
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: 'base64',
    });

    const { data, error } = await supabase.functions.invoke('ai-coach', {
      body: {
        feature:      'food_scan',
        imageBase64:  base64,
        mediaType:    'image/jpeg',
      },
    });

    if (error || !data?.data) return null;

    const d = data.data as Partial<ScannedFood>;
    if (!d.name || !d.kcal) return null;

    return {
      name:        String(d.name),
      kcal:        Number(d.kcal)     || 0,
      proteinG:    Number(d.proteinG) || 0,
      carbsG:      Number(d.carbsG)   || 0,
      fatG:        Number(d.fatG)     || 0,
      servingSize: String(d.servingSize ?? '1 serving'),
    };
  } catch {
    return null;
  }
}
