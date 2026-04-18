import React, { useMemo } from 'react';
import {
  View, Text, Pressable, StyleSheet, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Rss, Sparkles, User, Play } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme, type AppColors } from '@theme';

type NonRunIcon = 'Home' | 'Rss' | 'Sparkles' | 'User';
const ICON_MAP: Record<NonRunIcon, React.FC<{ size: number; color: string; strokeWidth: number }>> = {
  Home, Rss, Sparkles, User,
};

const TAB_META: { label: string; icon: NonRunIcon | 'Run' }[] = [
  { label: 'HOME',    icon: 'Home'     },
  { label: 'FEED',    icon: 'Rss'      },
  { label: 'RUN',     icon: 'Run'      },
  { label: 'COACH',   icon: 'Sparkles' },
  { label: 'PROFILE', icon: 'User'     },
];

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'ios' ? 16 : 8);

  const activeRoute = state.routes[state.index];
  if (activeRoute.name === 'Run') return null;

  return (
    <View style={[s.wrapper, { paddingBottom: bottomPad }]}>
      <View style={s.topBorder} />

      {/* Tabs */}
      <View style={s.row}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const meta    = TAB_META[index];
          const isRun   = meta.icon === 'Run';

          const onPress = () => {
            Haptics.impactAsync(isRun
              ? Haptics.ImpactFeedbackStyle.Medium
              : Haptics.ImpactFeedbackStyle.Light);
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          if (isRun) {
            return (
              <Pressable key={route.key} onPress={onPress} style={s.runOuter}>
                <View style={[s.runCircle, focused && s.runCircleActive]}>
                  <Play size={20} color="#fff" fill="#fff" strokeWidth={0} />
                </View>
                <Text style={[s.label, { color: C.red, fontFamily: 'Barlow_500Medium' }]}>{meta.label}</Text>
              </Pressable>
            );
          }

          const IconComp = ICON_MAP[meta.icon as NonRunIcon];
          const color    = focused ? C.red : C.t3;

          return (
            <Pressable key={route.key} onPress={onPress} style={s.tab}>
              <IconComp size={22} color={color} strokeWidth={focused ? 2 : 1.5} />
              <Text style={[s.label, { color, fontFamily: focused ? 'Barlow_500Medium' : 'Barlow_400Regular' }]}>
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    wrapper:         { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.bg, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: -3 } },
    topBorder:       { height: 0.5, backgroundColor: C.border },
    row:             { flexDirection: 'row', alignItems: 'flex-end', paddingTop: 6 },
    tab:             { flex: 1, alignItems: 'center', gap: 4, paddingBottom: 4 },
    label:           { fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase' },
    runOuter:        { flex: 1, alignItems: 'center', gap: 5, paddingBottom: 4 },
    runCircle:       { width: 54, height: 54, borderRadius: 27, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', marginTop: -20, shadowColor: C.red, shadowOpacity: 0.38, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
    runCircleActive: { shadowOpacity: 0.55, shadowRadius: 16 },
    runPlay:         { fontSize: 18, color: '#fff', marginLeft: 2 },
  });
}
