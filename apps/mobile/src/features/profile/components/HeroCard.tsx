import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { StoredRun, StoredPlayer } from '@shared/services/store';
import { GlyphIcon } from '@mobile/shared/components/GlyphIcon';
import { useTheme, Type, Fonts, type AppColors } from '@theme';

interface HeroBadge { icon?: string; label: string }

type HeroCardData =
  | { kind: 'empty' }
  | { kind: 'stats'; eyebrow: string; bigNumber: string; bigUnit: string; subline: string; badges: HeroBadge[] };

function computeHeroCard(runs: StoredRun[], player: StoredPlayer | null): HeroCardData {
  // Lifetime run count === 0 — same check the rest of the card's stats would
  // otherwise divide-by-zero on; no separate query needed.
  if (runs.length === 0) {
    return { kind: 'empty' };
  }

  const streakDays = player?.streakDays ?? 0;
  const weekPace = player?.paceWeeklyEarned ?? 0;

  const badges: HeroBadge[] = [];
  if (streakDays > 0) badges.push({ icon: '🔥', label: `${streakDays}-day streak` });
  if (weekPace > 0) badges.push({ label: `+${weekPace} PACE` });

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
      kind: 'stats',
      eyebrow: 'NEW HIGH',
      bigNumber: thisWeekKm.toFixed(1),
      bigUnit: 'km this week',
      subline: `Your biggest week yet — ${maxPrevWeekKm.toFixed(1)} km was your previous best`,
      badges,
    };
  }

  if (streakDays >= 7 && streakDays % 7 === 0) {
    return {
      kind: 'stats',
      eyebrow: 'MILESTONE',
      bigNumber: String(streakDays),
      bigUnit: 'day streak',
      subline: `${thisWeekKm.toFixed(1)} km covered this week`,
      badges,
    };
  }

  return {
    kind: 'stats',
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
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const card = useMemo(() => computeHeroCard(runs, player), [runs, player]);

  if (card.kind === 'empty') {
    return (
      <View style={ss.card}>
        <Text style={ss.emptyHeadline}>Your story starts with one run.</Text>
        <Text style={ss.emptyCaption}>Runs, territory, and records show up here.</Text>
      </View>
    );
  }

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
            <View key={b.label} style={ss.badge}>
              {!!b.icon && <GlyphIcon glyph={b.icon} size={11} color="rgba(255,255,255,0.8)" />}
              <Text style={ss.badgeText}>{b.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card: {
      // Fixed near-black bold card in both themes — not C.black, which is the "ink"
      // token and inverts to near-white in dark mode (would strand the fixed-white
      // text/overlays below against a now-light background).
      backgroundColor: C.alwaysDark,
      borderRadius: 16,
      padding: 20,
      marginBottom: 12,
    },
    eyebrow: {
      ...Type.overline,
      color: 'rgba(255,255,255,0.55)',
      marginBottom: 8,
    },
    numberRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
      marginBottom: 8,
    },
    bigNumber: {
      fontFamily: Fonts.semiBold,
      fontSize: 42,
      color: C.alwaysLight,
      letterSpacing: -1,
      lineHeight: 48,
      fontVariant: ['tabular-nums'],
    },
    bigUnit: {
      fontFamily: Fonts.regular,
      fontSize: 13,
      color: 'rgba(255,255,255,0.5)',
    },
    subline: {
      fontFamily: Fonts.regular,
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
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(255,255,255,0.10)',
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    badgeText: {
      fontFamily: Fonts.medium,
      fontSize: 10,
      color: 'rgba(255,255,255,0.8)',
    },
    emptyHeadline: {
      fontFamily: Fonts.display,
      fontSize: 21,
      lineHeight: 26,
      color: C.alwaysLight,
    },
    emptyCaption: {
      fontFamily: Fonts.regular,
      fontSize: 12.5,
      lineHeight: 18,
      color: 'rgba(255,255,255,0.55)',
      marginTop: 6,
    },
  });
}
