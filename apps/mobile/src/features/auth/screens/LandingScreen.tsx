import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, StatusBar, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import LandingScene from '../components/LandingScene';
import LandingHero from '../components/LandingHero';
import LandingActions from '../components/LandingActions';
import { Colors } from '@theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * The first screen: a daylight city map where a run loops the park and the
 * ground turns red, under a sheet that says what the game is. Always the
 * light design, whatever the system theme.
 */
export default function LandingScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  // The sheet takes the bottom 47% of the screen, as in the mock.
  const { height } = useWindowDimensions();

  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 650, delay: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter]);
  const rise = enter.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />

      <View style={StyleSheet.absoluteFill}>
        <LandingScene />
      </View>

      <Animated.View
        style={[s.sheet, { height: Math.round(height * 0.47), paddingBottom: 26 + insets.bottom, transform: [{ translateY: rise }] }]}
      >
        <LandingHero />
        <View style={s.spacer} />
        <LandingActions
          onSignUp={() => navigation.navigate('SignUp')}
          onSignIn={() => navigation.navigate('Login')}
        />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: Colors.bg },
  sheet:      {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.bg, borderTopLeftRadius: 30, borderTopRightRadius: 30,
    paddingTop: 28, paddingHorizontal: 22,
    shadowColor: '#14120F', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: -12 }, elevation: 12,
  },
  spacer:     { flex: 1, minHeight: 20 },
});
