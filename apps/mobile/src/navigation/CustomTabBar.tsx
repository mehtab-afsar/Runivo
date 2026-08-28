import React, { useMemo, useRef, useEffect } from 'react';
import {
  View, Text, Pressable, StyleSheet, Platform, Animated, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { House as Home, Rss, User, Play, type Icon } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme, Fonts, type AppColors } from '@theme';
import { FEATURES } from '../config/features';
import { useCoachNav } from './CoachNavContext';

const TAB_ENABLED: Record<string, boolean> = {
  Dashboard: FEATURES.DASHBOARD,
  Feed:      FEATURES.SOCIAL_FEED,
  Run:       FEATURES.RUN_TRACKING,
  Coach:     FEATURES.AI_COACH,
  Profile:   FEATURES.PROFILE,
};

type NonRunIcon = 'Home' | 'Rss' | 'PaceX' | 'User';
const ICON_MAP: Record<Exclude<NonRunIcon, 'PaceX'>, Icon> = {
  Home, Rss, User,
};

const TAB_META: { label: string; icon: NonRunIcon | 'Run' }[] = [
  { label: 'HOME',    icon: 'Home'  },
  { label: 'FEED',    icon: 'Rss'   },
  { label: 'RUN',     icon: 'Run'   },
  { label: 'PACE',    icon: 'PaceX' },
  { label: 'PROFILE', icon: 'User'  },
];

// Approximate tab bar content height (excluding safe area padding).
// Used to size the spacer and compute slide distance.
const TAB_CONTENT_H = 62;

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'ios' ? 16 : 8);
  const tabBarH = TAB_CONTENT_H + bottomPad;

  const { coachActive, tourActive } = useCoachNav();
  const hidden = coachActive || tourActive;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: hidden ? tabBarH : 0,
      duration: hidden ? 280 : 220,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [hidden, tabBarH]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeRoute = state.routes[state.index];
  if (activeRoute.name === 'Run') return null;
  if (hidden) return null;

  return (
    <>
      {/* Spacer so content behind tab bar isn't occluded. Hidden when coach/tour is active. */}
      {!hidden && <View style={{ height: tabBarH }} />}

      <Animated.View
        style={[s.wrapper, { paddingBottom: bottomPad, transform: [{ translateY: slideAnim }] }]}
        pointerEvents={hidden ? 'none' : 'auto'}
      >
        <View style={s.topBorder} />

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

            // maxFontSizeMultiplier caps below are deliberate: this is a fixed-height
            // (TAB_CONTENT_H) 5-across bottom bar, the one piece of chrome present on
            // almost every screen — uncapped iOS accessibility text sizes would clip
            // vertically against the fixed bar height and collide horizontally between
            // adjacent tabs (e.g. "PROFILE"). A capped ~20% grow still helps without
            // breaking the bar; unlike this label text, ordinary screen content is left
            // uncapped elsewhere in the app.
            if (isRun) {
              return (
                <Pressable
                  key={route.key} onPress={onPress} style={s.runOuter}
                  accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={meta.label}
                >
                  <View style={[s.runCircle, focused && s.runCircleActive]}>
                    <Play size={20} color={C.alwaysLight} weight="fill" />
                  </View>
                  <Text
                    style={[s.label, s.labelActive, { color: C.red }]} maxFontSizeMultiplier={1.2}
                    accessibilityElementsHidden importantForAccessibility="no"
                  >
                    {meta.label}
                  </Text>
                </Pressable>
              );
            }

            const isPaceX  = meta.icon === 'PaceX';
            const enabled  = TAB_ENABLED[route.name] !== false;
            const color    = enabled && focused ? C.red : C.t3;
            const IconComp = isPaceX ? null : ICON_MAP[meta.icon as Exclude<NonRunIcon, 'PaceX'>];

            return (
              <Pressable
                key={route.key} onPress={onPress} style={s.tab}
                accessibilityRole="tab" accessibilityState={{ selected: focused }}
                accessibilityLabel={enabled ? meta.label : `${meta.label} — coming soon`}
              >
                {isPaceX || !IconComp
                  // "X" is a visual brand glyph, not the tab's name — VoiceOver reads
                  // the Pressable's accessibilityLabel (meta.label) instead, so this
                  // decorative glyph itself must not also be announced.
                  ? <Text style={{ fontFamily: Fonts.bold, fontSize: 22, color, lineHeight: 26 }} maxFontSizeMultiplier={1.2} accessibilityElementsHidden importantForAccessibility="no">X</Text>
                  : <IconComp size={22} color={color} weight={focused ? 'regular' : 'light'} />
                }
                {enabled ? (
                  <Text
                    style={[s.label, focused && s.labelActive, { color }]} maxFontSizeMultiplier={1.2}
                    accessibilityElementsHidden importantForAccessibility="no"
                  >
                    {meta.label}
                  </Text>
                ) : (
                  <View style={s.soonBadge}>
                    <Text style={s.soonText} maxFontSizeMultiplier={1.2}>SOON</Text>
                  </View>
                )}
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
    wrapper:         {
      // No overflow:hidden here — the floating red Run button (runCircle) pokes
      // above this view via a negative margin, and clipping would cut it off.
      // A rounded background still renders correctly without it.
      position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.bg,
      borderTopLeftRadius: 26, borderTopRightRadius: 26,
      shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: -4 },
    },
    // Inset past the rounded corners so the hairline doesn't poke out past the curve.
    topBorder:       { height: 0.5, backgroundColor: C.border, marginHorizontal: 26 },
    row:             { flexDirection: 'row', alignItems: 'flex-end', paddingTop: 6 },
    tab:             { flex: 1, alignItems: 'center', gap: 4, paddingBottom: 4 },
    // 10px tracked-uppercase floor — 9px system font was both illegible and an SF leak.
    label:           { fontFamily: Fonts.regular, fontSize: 10, letterSpacing: 1 },
    labelActive:     { fontFamily: Fonts.medium },
    soonBadge:       { backgroundColor: C.orange, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6 },
    soonText:        { fontFamily: Fonts.bold, fontSize: 10, color: C.alwaysLight, letterSpacing: 0.5 },
    runOuter:        { flex: 1, alignItems: 'center', gap: 5, paddingBottom: 4 },
    runCircle:       { width: 54, height: 54, borderRadius: 27, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', marginTop: -20, shadowColor: C.red, shadowOpacity: 0.38, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
    runCircleActive: { shadowOpacity: 0.55, shadowRadius: 16 },
  });
}
