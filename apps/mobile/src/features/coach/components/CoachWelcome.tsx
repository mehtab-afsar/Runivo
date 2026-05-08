import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { useTheme } from '@theme';

interface Props {
  insight?: string;
}

export function CoachWelcome({ insight }: Props) {
  const C = useTheme();
  return (
    <View style={ss.wrap}>
      <View style={ss.avatar}>
        <Sparkles size={30} color="#7C3AED" strokeWidth={1.5} />
      </View>
      <Text style={[ss.greeting, { color: C.black }]}>Your AI Running Coach</Text>
      <Text style={[ss.sub, { color: C.t2 }]}>
        {insight ?? 'Ask me about training, pace, nutrition, recovery, or race strategy. I know your data.'}
      </Text>
    </View>
  );
}

const ss = StyleSheet.create({
  wrap:     { alignItems: 'center', paddingHorizontal: 40, paddingTop: 52, paddingBottom: 28 },
  avatar:   { width: 72, height: 72, borderRadius: 24, backgroundColor: 'rgba(124,58,237,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  greeting: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 22, textAlign: 'center', marginBottom: 10 },
  sub:      { fontFamily: 'DMSans_300Light', fontSize: 14, textAlign: 'center', lineHeight: 22, color: 'rgba(10,10,10,0.55)' },
});
