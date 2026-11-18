import { } from 'react-native';
import { appAlert } from '@mobile/shared/components/AppAlert';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getRuns, getTerritoryPolygons } from '@shared/services/store';
import { supabase } from '@shared/services/supabase';
import { toGpx, toCsv, toGeoJson } from '@shared/services/exportData';

type Kind = 'gpx' | 'csv' | 'geojson';

const META: Record<Kind, { mime: string; uti: string; title: string }> = {
  gpx:     { mime: 'application/gpx+xml', uti: 'com.topografix.gpx', title: 'Your activities (GPX)' },
  csv:     { mime: 'text/csv',            uti: 'public.comma-separated-values-text', title: 'Your activities (CSV)' },
  geojson: { mime: 'application/geo+json', uti: 'public.json', title: 'Your zones (GeoJSON)' },
};

/** Writes the file to the cache folder and opens the share sheet. */
export async function exportData(kind: Kind): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    appAlert('Sharing is unavailable', "This device can't share files.");
    return;
  }
  let body: string;
  if (kind === 'geojson') {
    const { data: { user } } = await supabase.auth.getUser();
    const zones = await getTerritoryPolygons(user?.id);
    if (!zones.length) { appAlert('No zones yet', 'Close a loop on a run to claim your first zone.'); return; }
    body = toGeoJson(zones);
  } else {
    const runs = await getRuns();
    if (!runs.length) { appAlert('Nothing to export', 'Record an activity first.'); return; }
    body = kind === 'gpx' ? toGpx(runs) : toCsv(runs);
  }
  const uri = `${FileSystem.cacheDirectory}runivo-${kind === 'geojson' ? 'zones' : 'activities'}-${new Date().toISOString().slice(0, 10)}.${kind}`;
  await FileSystem.writeAsStringAsync(uri, body);
  await Sharing.shareAsync(uri, { mimeType: META[kind].mime, UTI: META[kind].uti, dialogTitle: META[kind].title });
}

export function chooseExport(): void {
  const run = (k: Kind) => () => { exportData(k).catch(() => appAlert("Couldn't export", 'Try again.')); };
  appAlert('Export my data', 'Saved from this phone. Activities recorded elsewhere appear once they have synced.', [
    { text: 'Activities as GPX', onPress: run('gpx') },
    { text: 'Activities as CSV', onPress: run('csv') },
    { text: 'Zones as GeoJSON', onPress: run('geojson') },
    { text: 'Cancel', style: 'cancel' },
  ]);
}
