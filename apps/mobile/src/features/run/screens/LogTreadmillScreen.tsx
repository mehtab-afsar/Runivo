/**
 * R5: log a treadmill run by hand — when, how long, how far. No GPS, so it
 * counts for distance, goals and your log, but never claims zones or PACE.
 */
import React, { useState } from 'react';
import { appAlert } from '@mobile/shared/components/AppAlert';
import { } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { FormScreen, FormField, ChipGroup, FormButton, FormTip } from '@mobile/shared/components/form/FormKit';
import { saveRun } from '@shared/services/store';
import { useDistanceUnit } from '@mobile/shared/hooks/useDistanceUnit';
import { KM_TO_MI, fmtPace } from '@mobile/shared/lib/formatters';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const DAYS = [{ label: 'Today', back: 0 }, { label: 'Yesterday', back: 1 }, { label: '2 days ago', back: 2 }];

export default function LogTreadmillScreen() {
  const navigation = useNavigation<Nav>();
  const [day, setDay] = useState(0);
  const [mins, setMins] = useState('');
  const unit = useDistanceUnit();
  const [km, setKm] = useState('');   // typed in the user's unit (km or mi)
  const [saving, setSaving] = useState(false);

  const minutes = Number(mins.replace(',', '.'));
  // Typed in the user's unit; everything stored and validated below is km.
  const typed = Number(km.replace(',', '.'));
  const dist = unit === 'mi' ? typed / KM_TO_MI : typed;
  const ok = minutes > 0 && minutes <= 600 && dist > 0 && dist <= 100;
  const pace = ok ? (minutes * 60) / dist : null;
  const tooFast = pace != null && pace < 1000 / 6.5;

  const save = async () => {
    if (!ok || tooFast) return;
    setSaving(true);
    try {
      const end = new Date(); end.setDate(end.getDate() - day);
      if (day > 0) end.setHours(19, 0, 0, 0);
      const durationSec = Math.round(minutes * 60);
      const start = end.getTime() - durationSec * 1000;
      const p = durationSec / dist;
      await saveRun({
        id: (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`) as string,
        activityType: 'treadmill', startTime: start, endTime: end.getTime(),
        distanceMeters: Math.round(dist * 1000), durationSec,
        avgPace: `${Math.floor(p / 60)}:${String(Math.round(p % 60)).padStart(2, '0')}`,
        gpsPoints: [], territoriesClaimed: [], territoriesFortified: [], enemyCaptured: 0, preRunLevel: 0, synced: false,
        title: 'Treadmill run',
      });
      navigation.goBack();
    } catch {
      appAlert("Couldn't save it", 'Try again.');
    } finally { setSaving(false); }
  };

  return (
    <FormScreen
      title="Log a"
      accent="treadmill run."
      subtitle="Counts toward your distance, goals and training log. With no GPS it can't claim zones or earn PACE."
      onClose={() => navigation.goBack()}
      closeIcon="back"
      footer={<>
        {pace != null && (
          <FormTip lead={tooFast ? 'Check the numbers.' : 'Pace'}>
            {tooFast ? "That's faster than anyone runs." : `${fmtPace(unit === 'mi' ? pace / KM_TO_MI : pace)} /${unit}`}
          </FormTip>
        )}
        <FormButton label="Save run" onPress={save} disabled={!ok || tooFast} busy={saving} />
      </>}
    >
      <ChipGroup label="When" options={DAYS.map(d => ({ value: d.back, label: d.label }))} value={day} onChange={setDay} />
      <FormField label="Time (minutes)" value={mins} onChangeText={setMins} keyboardType="decimal-pad" placeholder="30" maxLength={5} />
      <FormField label={`Distance (${unit}, from the treadmill)`} value={km} onChangeText={setKm} keyboardType="decimal-pad" placeholder="5.0" maxLength={5} />
    </FormScreen>
  );
}
