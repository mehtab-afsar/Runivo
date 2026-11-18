import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  View, Text, Image, Pressable, StyleSheet, Platform, Animated, Easing,
} from 'react-native';
import { useTabBarHiddenByScreen } from './tabBarVisibility';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import * as Haptics from '@theme/hapticsGated';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme, Fonts, type AppColors } from '@theme';
import { getPlayer } from '@shared/services/store';
import { useMyIdentity } from '@mobile/shared/hooks/useMyIdentity';
import { FEATURES } from '../config/features';
import { useCoachNav } from './CoachNavContext';

/**
 * The floating tab bar (2026 redesign): Home, Map, Record, Groups, You.
 * A white pill that floats above the content. The active tab sits on a mint
 * pill with a filled icon; Record is the black Runivo hexagon with a lime
 * play mark; You shows the runner's initials.
 */

const TAB_ENABLED: Record<string, boolean> = {
  Dashboard: FEATURES.DASHBOARD,
  Map:       true,
  Run:       FEATURES.RUN_TRACKING,
  Groups:    true,
  Profile:   FEATURES.PROFILE,
};

type TabKey = 'Dashboard' | 'Map' | 'Run' | 'Groups' | 'Profile';
const LABEL: Record<TabKey, string> = {
  Dashboard: 'Home', Map: 'Map', Run: 'Record', Groups: 'Groups', Profile: 'You',
};

/** Pill height, and how far it floats above the bottom safe area. */
const BAR_H = 70;
/** Bottom padding a tab's scroll content needs to clear the floating bar. */
export const TAB_BAR_CLEARANCE = 130;
const BAR_GAP = 10;


/** The mock's tab icons: outline when idle, filled ink when active. */
function TabIcon({ name, active, C }: { name: TabKey; active: boolean; C: AppColors }) {
  const idle = C.t2, ink = C.t1;
  switch (name) {
    case 'Dashboard':
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-5H9v5H5.5A1.5 1.5 0 0 1 4 19Z" fill={active ? ink : 'none'} stroke={active ? ink : idle} strokeWidth={1.7} strokeLinejoin="round" />
        </Svg>
      );
    case 'Map':
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path d="M9 4.5 3.5 6.5v13l5.5-2 6 2 5.5-2v-13l-5.5 2Z" fill={active ? ink : 'none'} stroke={active ? ink : idle} strokeWidth={1.7} strokeLinejoin="round" />
          <Path d="M9 4.5v13M15 6.5v13" stroke={active ? '#C9F06B' : idle} strokeWidth={1.7} />
        </Svg>
      );
    case 'Run':
      return (
        <Svg width={26} height={26} viewBox="0 0 24 24">
          <Path d="M12 1.8 21 7v10l-9 5.2L3 17V7Z" fill={ink} />
          <Path d="M10 8.6v6.8l5.4-3.4Z" fill="#C9F06B" />
        </Svg>
      );
    case 'Groups':
      return active ? (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path d="M7.5 3.5 11 5.5v4l-3.5 2L4 9.5v-4ZM16.5 3.5 20 5.5v4l-3.5 2L13 9.5v-4Z" fill={ink} stroke={ink} strokeWidth={1.6} strokeLinejoin="round" />
          <Path d="M12 12.5l3.5 2v4l-3.5 2-3.5-2v-4Z" fill="#7DBA3C" stroke={ink} strokeWidth={1.6} strokeLinejoin="round" />
        </Svg>
      ) : (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path d="M7.5 3.5 11 5.5v4l-3.5 2L4 9.5v-4ZM16.5 3.5 20 5.5v4l-3.5 2L13 9.5v-4ZM12 12.5l3.5 2v4l-3.5 2-3.5-2v-4Z" stroke={idle} strokeWidth={1.6} strokeLinejoin="round" />
        </Svg>
      );
    default:
      return null;
  }
}

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const insets = useSafeAreaInsets();
  // Mock: the bar sits 22 pt above the screen edge on a 34 pt home-indicator phone.
  const bottomPad = Math.max(insets.bottom - 12, Platform.OS === 'ios' ? 12 : 10);
  const totalH = BAR_H + BAR_GAP + bottomPad;

  const [username, setUsername] = useState('');
  useEffect(() => { getPlayer().then(p => setUsername(p?.username ?? '')).catch(() => {}); }, []);
  const me = useMyIdentity();
  // The runner's photo, else initials of their name (or username).
  const initials = (me.name || username).split(/\s+/).filter(Boolean).map(w => w.replace(/[^a-z0-9]/gi, '')[0] ?? '').join('').slice(0, 2).toUpperCase()
    || username.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase();

  const { coachActive, tourActive } = useCoachNav();
  const hiddenByScreen = useTabBarHiddenByScreen();
  const hidden = coachActive || tourActive || hiddenByScreen;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: hidden ? totalH : 0,
      duration: hidden ? 280 : 220,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [hidden, totalH]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeRoute = state.routes[state.index];
  if (activeRoute.name === 'Run') return null;
  if (hidden) return null;

  return (
    <>
      {/* No spacer: the bar floats over the screen, as in the mock. Each tab's
          scroll content carries its own bottom padding (TAB_BAR_CLEARANCE). */}

      <Animated.View
        style={[s.wrapper, { bottom: bottomPad, transform: [{ translateY: slideAnim }] }]}
        pointerEvents="box-none"
      >
        <View style={s.bar} accessibilityRole="tablist">
          {state.routes.map((route, index) => {
            const name = route.name as TabKey;
            const focused = state.index === index;
            const enabled = TAB_ENABLED[name] !== false;
            const label = LABEL[name] ?? route.name;

            const onPress = () => {
              Haptics.impactAsync(name === 'Run' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            };

            // maxFontSizeMultiplier is capped: the bar has a fixed height, and
            // uncapped accessibility sizes would clip the labels against it.
            return (
              <Pressable
                key={route.key} onPress={onPress} style={[s.tab, focused && enabled && s.tabOn]} hitSlop={{ top: 6, bottom: 6 }}
                accessibilityRole="tab" accessibilityState={{ selected: focused }}
                accessibilityLabel={enabled ? label : `${label}, coming soon`}
              >
                <View style={s.pill}>
                  {name === 'Profile' ? (
                    <View style={[s.avatar, focused && s.avatarOn]}>
                      {me.avatarUrl
                        ? <Image source={{ uri: me.avatarUrl }} style={s.avatarImg} />
                        : initials
                        ? <Text style={s.avatarTxt} maxFontSizeMultiplier={1.1}>{initials}</Text>
                        : (
                          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                            <Circle cx={12} cy={8} r={4} stroke="#2F4D12" strokeWidth={2.2} />
                            <Path d="M4 21a8 8 0 0 1 16 0" stroke="#2F4D12" strokeWidth={2.2} strokeLinecap="round" />
                          </Svg>
                        )}
                    </View>
                  ) : (
                    <TabIcon name={name} active={focused && enabled} C={C} />
                  )}
                </View>
                <Text
                  style={[s.label, { color: focused && enabled ? C.t1 : C.t2 }, focused && s.labelOn]}
                  maxFontSizeMultiplier={1.2} accessibilityElementsHidden importantForAccessibility="no"
                >
                  {enabled ? label : 'Soon'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    wrapper: { position: 'absolute', left: 14, right: 14 },
    // Mock: 70 tall, white at 97%, soft shadow plus a 1 px #EEF0EA ring.
    bar: {
      height: BAR_H, borderRadius: BAR_H / 2, backgroundColor: C.card,
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, gap: 2,
      shadowColor: '#17181A', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 12 }, elevation: 10,
      borderWidth: 1, borderColor: C.border,
    },
    tab:      { flex: 1, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', gap: 3 },
    tabOn:    { backgroundColor: C.mint },
    pill:     { height: 26, alignItems: 'center', justifyContent: 'center' },
    label:    { fontFamily: Fonts.medium, fontSize: 12 },
    labelOn:  { fontFamily: Fonts.semiBold },
    avatar:   { width: 26, height: 26, borderRadius: 13, backgroundColor: C.mint2, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.card },
    avatarOn: { borderColor: C.t1 },
    avatarImg:{ width: 22, height: 22, borderRadius: 11 },
    avatarTxt:{ fontFamily: Fonts.bold, fontSize: 10, color: C.green },
  });
}
