import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const C = { black: '#0A0A0A', t2: '#6B6B6B', green: '#1A6B40', greenLo: '#EDF7F2', red: '#D93518', redLo: '#FEF0EE' };

interface FeatureRowProps {
  name: string;
  sub: string;
  type?: 'check' | 'cross';
}

export function FeatureRow({ name, sub, type = 'check' }: FeatureRowProps) {
  const isCheck = type === 'check';
  return (
    <View style={ss.row}>
      <View style={[ss.circle, isCheck ? ss.checkCircle : ss.xCircle]}>
        <Text style={[ss.mark, isCheck ? ss.checkMark : ss.xMark]}>{isCheck ? '✓' : '✕'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ss.name}>{name}</Text>
        {sub ? <Text style={ss.sub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

const ss = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 10 },
  circle: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  checkCircle: { backgroundColor: C.greenLo },
  xCircle: { backgroundColor: C.redLo },
  mark: { fontFamily: 'Barlow_700Bold', fontSize: 10 },
  checkMark: { color: C.green },
  xMark: { color: C.red },
  name: { fontFamily: 'Barlow_500Medium', fontSize: 13, color: C.black, marginBottom: 1 },
  sub: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t2 },
});
