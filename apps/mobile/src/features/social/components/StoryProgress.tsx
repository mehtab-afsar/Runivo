import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface Props {
  count: number;
  currentIndex: number;
  progress: number;
}

export function StoryProgress({ count, currentIndex, progress }: Props) {
  return (
    <View style={s.row}>
      {Array.from({ length: count }).map((_, i) => {
        const fill = i < currentIndex ? 1 : i === currentIndex ? progress : 0;
        return (
          <View key={i} style={s.track}>
            <View style={[s.fill, { width: `${fill * 100}%` }]} />
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 3 },
  track: {
    flex: 1, height: 2.5, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: '#fff' },
});
