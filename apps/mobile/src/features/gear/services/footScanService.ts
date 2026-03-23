import * as FileSystem from 'expo-file-system';
import { supabase } from '@shared/services/supabase';

export type ArchType = 'flat' | 'neutral' | 'high';

export interface FootScanResult {
  archType:           ArchType;
  confidence:         number;
  explanation:        string;
  shoeRecommendation: string;
}

export const ARCH_INFO: Record<ArchType, { label: string; emoji: string; desc: string }> = {
  flat:    { label: 'Flat arch',    emoji: '🦶', desc: 'Full foot contact. Look for stability or motion-control shoes.' },
  neutral: { label: 'Neutral arch', emoji: '👟', desc: 'Moderate contact. Most neutral cushioned shoes work well.' },
  high:    { label: 'High arch',    emoji: '🏃', desc: 'Minimal mid-foot contact. Cushioned, flexible shoes recommended.' },
};

/** Converts a local file URI to base64 and sends it to the foot-scan edge function. */
export async function analyseFootImage(localUri: string): Promise<FootScanResult> {
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: 'base64' as const,
  });

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/foot-scan`;
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg' }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`foot-scan error ${res.status}: ${text}`);
  }

  const json = await res.json();
  return json as FootScanResult;
}
