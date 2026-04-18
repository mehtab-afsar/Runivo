import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { useTheme, type AppColors } from '@theme';

interface FeatureRowProps {
  name: string;
  sub: string;
  type?: 'check' | 'cross';
}

export function FeatureRow({ name, sub, type = 'check' }: FeatureRowProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const isCheck = type === 'check';
  return (
    <View style={ss.row}>
      <View style={[ss.circle, isCheck ? ss.checkCircle : ss.xCircle]}>
        {isCheck
          ? <Check size={10} color={C.green} strokeWidth={2} />
          : <X     size={10} color={C.red}   strokeWidth={2} />
        }
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ss.name}>{name}</Text>
        {sub ? <Text style={ss.sub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

function mkStyles(C: AppColors) { return StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 10 },
  circle: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  checkCircle: { backgroundColor: C.greenLo },
  xCircle: { backgroundColor: C.redLo },
  mark: { fontFamily: 'Barlow_700Bold', fontSize: 10 },
  checkMark: { color: C.green },
  xMark: { color: C.red },
  name: { fontFamily: 'Barlow_500Medium', fontSize: 13, color: C.black, marginBottom: 1 },
  sub: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t2 },
}); }
