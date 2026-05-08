import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PersonalRecordsCard } from './PersonalRecordsCard';
import { StatRow } from './StatRow';
import type { PersonalRecord } from '../hooks/useProfile';
import type { StoredRun } from '@shared/services/store';
import { Colors } from '@theme';

const C = Colors;

// ── helpers ──────────────────────────────────────────────────────────────────

function isoWeekStart(d: Date): string {
  const day = new Date(d);
  const dow = day.getDay() === 0 ? 6 : day.getDay() - 1; // Mon=0
  day.setDate(day.getDate() - dow);
  day.setHours(0, 0, 0, 0);
  return day.toISOString().slice(0, 10);
}

function weekLabel(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function parsePaceSec(pace: string): number {
  // "4:32" → seconds per km
  const [m, s] = pace.split(':').map(Number);
  if (isNaN(m)) return 0;
  return m * 60 + (s || 0);
}

function fmtTime(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function riegelPredict(baseSec: number, baseDist: number, targetDist: number): string {
  const t = baseSec * Math.pow(targetDist / baseDist, 1.06);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return <Text style={ss.section}>{label}</Text>;
}

function WeeklyChart({ runs }: { runs: StoredRun[] }) {
  const weeks = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of runs) {
      const key = isoWeekStart(new Date(r.startTime));
      map[key] = (map[key] ?? 0) + r.distanceMeters / 1000;
    }
    // Build last 8 ISO week keys
    const result: { key: string; km: number }[] = [];
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i * 7);
      const key = isoWeekStart(d);
      if (!result.find(r => r.key === key)) {
        result.push({ key, km: map[key] ?? 0 });
      }
    }
    return result.slice(-8);
  }, [runs]);

  const maxKm = Math.max(...weeks.map(w => w.km), 1);
  const currentWeekKey = isoWeekStart(new Date());

  return (
    <View style={ss.chartCard}>
      <View style={ss.bars}>
        {weeks.map(w => {
          const heightPct = w.km / maxKm;
          const isCurrent = w.key === currentWeekKey;
          return (
            <View key={w.key} style={ss.barCol}>
              <Text style={ss.barKm}>{w.km > 0 ? w.km.toFixed(0) : ''}</Text>
              <View style={ss.barTrack}>
                <View style={[ss.barFill, { flex: heightPct, backgroundColor: isCurrent ? C.red : C.mid }]} />
                <View style={{ flex: 1 - heightPct }} />
              </View>
              <Text style={[ss.barLabel, isCurrent && ss.barLabelActive]}>{weekLabel(w.key).split(' ')[0]}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function PaceZones({ runs }: { runs: StoredRun[] }) {
  const zones = useMemo(() => {
    const buckets = [
      { label: 'Easy',     range: 'Under 5:30',   maxSec: Infinity, minSec: 330, totalSec: 0 },
      { label: 'Moderate', range: '5:30 – 4:30',  maxSec: 330,      minSec: 270, totalSec: 0 },
      { label: 'Tempo',    range: '4:30 – 3:30',  maxSec: 270,      minSec: 210, totalSec: 0 },
      { label: 'Hard',     range: 'Under 3:30',   maxSec: 210,      minSec: 0,   totalSec: 0 },
    ];
    for (const r of runs) {
      const paceSec = parsePaceSec(r.avgPace);
      const bucket = buckets.find(b => paceSec >= b.minSec && paceSec < b.maxSec);
      if (bucket) bucket.totalSec += r.durationSec;
    }
    const total = buckets.reduce((s, b) => s + b.totalSec, 0) || 1;
    return buckets.map(b => ({ ...b, pct: b.totalSec / total }));
  }, [runs]);

  return (
    <View style={ss.zonesCard}>
      {zones.map(z => (
        <View key={z.label} style={ss.zoneRow}>
          <View style={ss.zoneLeft}>
            <Text style={ss.zoneLabel}>{z.label}</Text>
            <Text style={ss.zoneRange}>{z.range}</Text>
          </View>
          <View style={ss.zoneBarWrap}>
            <View style={[ss.zoneBarFill, { flex: Math.max(0.02, z.pct) }]} />
            <View style={{ flex: 1 - Math.max(0.02, z.pct) }} />
          </View>
          <Text style={ss.zoneTime}>{z.totalSec > 0 ? fmtTime(z.totalSec) : '—'}</Text>
        </View>
      ))}
    </View>
  );
}

function RacePredictions({ personalRecords }: { personalRecords: PersonalRecord[] }) {
  const fiveKRecord = personalRecords.find(r => r.label.toLowerCase().includes('5k') || r.label.toLowerCase().includes('5 k'));

  if (!fiveKRecord || fiveKRecord.value === '—') {
    return (
      <View style={ss.predictionsEmpty}>
        <Text style={ss.predictionsEmptyText}>Run a 5K to unlock race predictions.</Text>
      </View>
    );
  }

  // Parse "MM:SS" or "H:MM:SS"
  const parts = fiveKRecord.value.split(':').map(Number);
  let baseSec = 0;
  if (parts.length === 2) baseSec = parts[0] * 60 + parts[1];
  else if (parts.length === 3) baseSec = parts[0] * 3600 + parts[1] * 60 + parts[2];

  const predictions = [
    { label: '10K',    dist: 10 },
    { label: 'Half',   dist: 21.0975 },
    { label: 'Full',   dist: 42.195 },
  ];

  return (
    <View style={ss.predictionsGrid}>
      {predictions.map(p => (
        <View key={p.label} style={ss.predictCard}>
          <Text style={ss.predictVal}>{riegelPredict(baseSec, 5, p.dist)}</Text>
          <Text style={ss.predictLabel}>{p.label}</Text>
          <Text style={ss.predictNote}>predicted</Text>
        </View>
      ))}
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  personalRecords: PersonalRecord[];
  totalRuns: number;
  totalKm: number;
  totalTerritories: number;
  streakDays: number;
  runs: StoredRun[];
}

export function StatsTab({ personalRecords, totalRuns, totalKm, totalTerritories, streakDays, runs }: Props) {
  const allTime = [
    { label: 'Total runs',  value: String(totalRuns) },
    { label: 'Total km',    value: totalKm.toFixed(1) },
    { label: 'Territories', value: String(totalTerritories) },
    { label: 'Streak',      value: `${streakDays}d` },
  ];

  return (
    <View>
      <SectionHeader label="Personal records" />
      <PersonalRecordsCard records={personalRecords} />

      <SectionHeader label="Weekly km" />
      <WeeklyChart runs={runs} />

      <SectionHeader label="Pace zones" />
      <PaceZones runs={runs} />

      <SectionHeader label="Race predictions" />
      <RacePredictions personalRecords={personalRecords} />

      <SectionHeader label="All-time" />
      <View style={ss.grid}>
        {allTime.map(s => <StatRow key={s.label} label={s.label} value={s.value} />)}
      </View>
    </View>
  );
}

const ss = StyleSheet.create({
  section: {
    fontFamily: 'Barlow_500Medium', fontSize: 9, color: C.t3,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 20,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  // Weekly chart
  chartCard: {
    backgroundColor: C.white, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, padding: 16,
  },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 80 + 32 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 80 + 32 },
  barKm: { fontFamily: 'Barlow_300Light', fontSize: 8, color: C.t3, marginBottom: 2 },
  barTrack: { width: '100%', height: 80, justifyContent: 'flex-end', flexDirection: 'column' },
  barFill: { borderRadius: 3, width: '100%' },
  barLabel: { fontFamily: 'Barlow_300Light', fontSize: 9, color: C.t3, marginTop: 4 },
  barLabelActive: { fontFamily: 'Barlow_500Medium', color: C.red },

  // Pace zones
  zonesCard: {
    backgroundColor: C.white, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, padding: 16, gap: 12,
  },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  zoneLeft: { width: 72 },
  zoneLabel: { fontFamily: 'Barlow_500Medium', fontSize: 12, color: C.black },
  zoneRange: { fontFamily: 'Barlow_300Light', fontSize: 9, color: C.t3 },
  zoneBarWrap: { flex: 1, height: 6, backgroundColor: C.mid, borderRadius: 3, flexDirection: 'row', overflow: 'hidden' },
  zoneBarFill: { height: 6, backgroundColor: C.red, borderRadius: 3 },
  zoneTime: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t2, width: 32, textAlign: 'right' },

  // Race predictions
  predictionsGrid: { flexDirection: 'row', gap: 8 },
  predictCard: {
    flex: 1, backgroundColor: C.white, borderRadius: 14, borderWidth: 0.5, borderColor: C.border,
    padding: 14, alignItems: 'center',
  },
  predictVal: { fontFamily: 'Barlow_600SemiBold', fontSize: 16, color: C.black, letterSpacing: -0.5 },
  predictLabel: { fontFamily: 'Barlow_500Medium', fontSize: 11, color: C.black, marginTop: 2 },
  predictNote: { fontFamily: 'Barlow_300Light', fontSize: 9, color: C.t3, marginTop: 1 },
  predictionsEmpty: { backgroundColor: C.white, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, padding: 20, alignItems: 'center' },
  predictionsEmptyText: { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t2, textAlign: 'center' },
});
