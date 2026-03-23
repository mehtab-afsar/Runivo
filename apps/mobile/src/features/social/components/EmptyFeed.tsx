import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const C = { black: '#0A0A0A', t2: '#6B6B6B' };

interface Props {
  tab?: 'explore' | 'following';
}

export function EmptyFeed({ tab }: Props) {
  const title = tab === 'following' ? 'No one to follow yet.' : 'No posts yet.';
  const body = tab === 'following'
    ? 'Explore the feed to find runners.'
    : 'Complete a run to appear here.';

  return (
    <View style={s.wrap}>
      <Text style={s.title}>{title}</Text>
      <Text style={s.text}>{body}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 48 },
  title: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 18, color: C.black, marginBottom: 6 },
  text: { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t2, textAlign: 'center' },
});
