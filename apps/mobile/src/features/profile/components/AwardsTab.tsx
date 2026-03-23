import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const C = { black: '#0A0A0A', t2: '#6B6B6B', t3: '#ADADAD', white: '#FFFFFF', border: '#DDD9D4' };

interface Award {
  id: string;
  emoji: string;
  title: string;
  description: string;
}

interface Props {
  awards?: Award[];
}

const DEFAULT_AWARDS: Award[] = [
  { id: 'first-run',  emoji: '🏅', title: 'First Steps',   description: 'Completed your first run' },
  { id: 'five-k',     emoji: '🥉', title: '5K Club',       description: 'Ran 5 km in a single session' },
  { id: 'ten-k',      emoji: '🥈', title: '10K Warrior',   description: 'Ran 10 km in a single session' },
  { id: 'half-marathon', emoji: '🥇', title: 'Half Hero', description: 'Completed a half marathon' },
];

export function AwardsTab({ awards = DEFAULT_AWARDS }: Props) {
  if (awards.length === 0) {
    return (
      <View style={ss.empty}>
        <Text style={ss.emptyTitle}>No awards yet</Text>
        <Text style={ss.emptyText}>Keep running to earn badges and awards.</Text>
      </View>
    );
  }

  return (
    <>
      <Text style={ss.sectionTitle}>Awards & Badges</Text>
      <View style={ss.grid}>
        {awards.map(award => (
          <View key={award.id} style={ss.card}>
            <Text style={ss.emoji}>{award.emoji}</Text>
            <Text style={ss.title}>{award.title}</Text>
            <Text style={ss.desc}>{award.description}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

const ss = StyleSheet.create({
  sectionTitle: {
    fontFamily: 'Barlow_600SemiBold', fontSize: 12, color: C.black,
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '47%', backgroundColor: C.white, borderRadius: 12,
    borderWidth: 0.5, borderColor: C.border, padding: 14, alignItems: 'center', gap: 6,
  },
  emoji: { fontSize: 28 },
  title: { fontFamily: 'Barlow_600SemiBold', fontSize: 12, color: C.black, textAlign: 'center' },
  desc: { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3, textAlign: 'center', lineHeight: 14 },
  empty: { alignItems: 'center', paddingVertical: 32 },
  emptyTitle: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 18, color: C.black, marginBottom: 6 },
  emptyText: { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t2, textAlign: 'center', lineHeight: 18 },
});
