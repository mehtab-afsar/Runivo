import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useTheme, type AppColors } from '@theme';

interface Props {
  feature: string;
  description?: string;
}

export function ComingSoon({ feature, description }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);

  return (
    <View style={s.container}>
      <View style={s.iconCircle}>
        <Bell size={36} color={C.t3} strokeWidth={1.5} />
      </View>

      <Text style={s.title}>{feature}</Text>

      <View style={s.badge}>
        <Text style={s.badgeText}>COMING SOON</Text>
      </View>

      {description ? (
        <Text style={s.description}>{description}</Text>
      ) : null}

      <Text style={s.hint}>We're working hard to bring you this feature!</Text>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
      backgroundColor: C.bg,
    },
    iconCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: C.surface,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 22,
      fontFamily: 'Barlow_700Bold',
      color: C.t1,
      marginBottom: 10,
      textAlign: 'center',
    },
    badge: {
      backgroundColor: C.red,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 20,
      marginBottom: 20,
    },
    badgeText: {
      fontSize: 11,
      fontFamily: 'Barlow_700Bold',
      color: '#fff',
      letterSpacing: 1,
    },
    description: {
      fontSize: 15,
      fontFamily: 'Barlow_400Regular',
      color: C.t2,
      textAlign: 'center',
      marginBottom: 16,
      lineHeight: 22,
    },
    hint: {
      fontSize: 13,
      fontFamily: 'Barlow_400Regular',
      color: C.t3,
      textAlign: 'center',
    },
  });
}
