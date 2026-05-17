import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { StoredRun, StoredPlayer } from '@shared/services/store';

interface HeroCardData {
  eyebrow: string;
  bigNumber: string;
  bigUnit: string;
  subline: string;
  badges: string[];
}

function computeHeroCard(runs: StoredRun[], player: StoredPlayer | null): HeroCardData {
  const streakDays = player?.streakDays ?? 0;
  const weekPace = player?.paceWeeklyEarned ?? 0;

  const badges: string[] = [];
  if (streakDays > 0) badges.push(`🔥 ${streakDays}-day streak`);
  if (weekPace > 0) badges.push(`+${weekPace} PACE`);

  if (runs.length === 0) {
    return {
      eyebrow: 'WELCOME',
      bigNumber: '0',
      bigUnit: 'km this week',
      subline: 'Start your first run to build your stats',
      badges: [],
    };
  }

  const now = new Date();
  const todayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - todayIdx);
  weekStart.setHours(0, 0, 0, 0);

  const weekRuns = runs.filter(r => r.startTime >= weekStart.getTime());
  const thisWeekKm = weekRuns.reduce((s, r) => s + r.distanceMeters / 1000, 0);

  // Compute last 8 previous weeks max
  let maxPrevWeekKm = 0;
  for (let i = 1; i <= 8; i++) {
    const wStart = new Date(weekStart);
    wStart.setDate(wStart.getDate() - i * 7);
    const wEnd = new Date(weekStart);
    wEnd.setDate(wEnd.getDate() - (i - 1) * 7);
    const km = runs
      .filter(r => r.startTime >= wStart.getTime() && r.startTime < wEnd.getTime())
      .reduce((s, r) => s + r.distanceMeters / 1000, 0);
    if (km > maxPrevWeekKm) maxPrevWeekKm = km;
  }

  if (thisWeekKm > maxPrevWeekKm && thisWeekKm > 0 && maxPrevWeekKm > 0) {
    return {
      eyebrow: 'NEW HIGH',
      bigNumber: thisWeekKm.toFixed(1),
      bigUnit: 'km this week',
      subline: `Your biggest week yet — ${maxPrevWeekKm.toFixed(1)} km was your previous best`,
      badges,
    };
  }

  if (streakDays >= 7 && streakDays % 7 === 0) {
    return {
      eyebrow: 'MILESTONE',
      bigNumber: String(streakDays),
      bigUnit: 'day streak',
      subline: `${thisWeekKm.toFixed(1)} km covered this week`,
      badges,
    };
  }

  return {
    eyebrow: 'THIS WEEK',
    bigNumber: thisWeekKm.toFixed(1),
    bigUnit: 'km',
    subline: `${weekRuns.length} run${weekRuns.length !== 1 ? 's' : ''} · ${streakDays > 0 ? `${streakDays}-day streak` : 'Keep it up'}`,
    badges,
  };
}

interface Props {
  runs: StoredRun[];
  player: StoredPlayer | null;
}

export function HeroCard({ runs, player }: Props) {
  const card = useMemo(() => computeHeroCard(runs, player), [runs, player]);

  return (
    <View style={ss.card}>
      <Text style={ss.eyebrow}>{card.eyebrow}</Text>
      <View style={ss.numberRow}>
        <Text style={ss.bigNumber}>{card.bigNumber}</Text>
        <Text style={ss.bigUnit}>{card.bigUnit}</Text>
      </View>
      <Text style={ss.subline}>{card.subline}</Text>
      {card.badges.length > 0 && (
        <View style={ss.badgesRow}>
          {card.badges.map(b => (
            <View key={b} style={ss.badge}>
              <Text style={ss.badgeText}>{b}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const ss = StyleSheet.create({
  card: {
    backgroundColor: '#0F0F0F',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  eyebrow: {
    fontFamily: 'Barlow_500Medium',
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 8,
  },
  bigNumber: {
    fontFamily: 'Barlow_600SemiBold',
    fontSize: 42,
    color: '#FFFFFF',
    letterSpacing: -1,
    lineHeight: 48,
  },
  bigUnit: {
    fontFamily: 'Barlow_400Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  subline: {
    fontFamily: 'Barlow_300Light',
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontFamily: 'Barlow_500Medium',
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
  },
});
