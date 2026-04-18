import React from 'react';
import {
  View, Text, Pressable, StyleSheet, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Rss, Sparkles, User, Play } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const ACTIVE   = '#D93518';
const INACTIVE = '#C4C0BA';

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
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'ios' ? 16 : 8);

  return (
    <View style={[ss.wrapper, { paddingBottom: bottomPad }]}>
      <View style={ss.topBorder} />

      {/* Tabs */}
      <View style={ss.row}>
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
              <Pressable key={route.key} onPress={onPress} style={ss.runOuter}>
                <View style={[ss.runCircle, focused && ss.runCircleActive]}>
                  <Play size={20} color="#fff" fill="#fff" strokeWidth={0} />
                </View>
                <Text style={[ss.label, { color: ACTIVE, fontFamily: 'Barlow_500Medium' }]}>{meta.label}</Text>
              </Pressable>
            );
          }

          const IconComp = ICON_MAP[meta.icon as NonRunIcon];
          const color    = focused ? ACTIVE : INACTIVE;

          return (
            <Pressable key={route.key} onPress={onPress} style={ss.tab}>
              <IconComp size={22} color={color} strokeWidth={focused ? 2 : 1.5} />
              <Text style={[ss.label, { color, fontFamily: focused ? 'Barlow_500Medium' : 'Barlow_400Regular' }]}>
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const ss = StyleSheet.create({
  wrapper:         { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(245,243,239,0.97)', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: -3 } },
  topBorder:       { height: 0.5, backgroundColor: 'rgba(0,0,0,0.1)' },
  row:             { flexDirection: 'row', alignItems: 'flex-end', paddingTop: 6 },
  tab:             { flex: 1, alignItems: 'center', gap: 4, paddingBottom: 4 },
  label:           { fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase' },
  // Run button
  runOuter:        { flex: 1, alignItems: 'center', gap: 5, paddingBottom: 4 },
  runCircle:       { width: 54, height: 54, borderRadius: 27, backgroundColor: ACTIVE, alignItems: 'center', justifyContent: 'center', marginTop: -20, shadowColor: ACTIVE, shadowOpacity: 0.38, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  runCircleActive: { shadowOpacity: 0.55, shadowRadius: 16 },
  runPlay:         { fontSize: 18, color: '#fff', marginLeft: 2 },
});
