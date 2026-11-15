import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Image, StyleSheet, Animated, Easing, StatusBar, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import LandingHero from '../components/LandingHero';
import LandingActions from '../components/LandingActions';
import { SignUpSheet } from '../components/SignUpSheet';
import { RunivoMark } from '@mobile/shared/components/RunivoMark';
import { Colors, Fonts } from '@theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const RUNNER = require('../../../../assets/images/welcome-runner.jpg');

/**
 * The first screen (2026 redesign): the runner in the Runivo hexagon, then
 * "Run smarter." and the two ways in. Always the light design, whatever the
 * system theme.
 */
export default function LandingScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const cardW = width - 32;
  // The art is 680 × 820; on short phones it shrinks so the buttons still fit.
  const cardH = Math.min(Math.round(cardW * (820 / 680)), Math.max(220, height - insets.top - insets.bottom - 330));

  const [sheet, setSheet] = useState(false);
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 650, delay: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter]);
  const rise = enter.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <View style={[s.root, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 18 }]}>
      <StatusBar barStyle="dark-content" />
      <View style={s.top}>
        <View style={s.logo}>
          <RunivoMark size={24} />
          <Text style={s.word}>runivo</Text>
        </View>
        <Pressable style={s.signIn} onPress={() => navigation.navigate('Login')} accessibilityRole="button">
          <Text style={s.signInTxt}>Sign in</Text>
        </Pressable>
      </View>

      <View style={[s.card, { width: cardW, height: cardH }]}>
        <Image source={RUNNER} style={{ width: cardW, height: cardH }} resizeMode="cover" accessibilityIgnoresInvertColors accessible accessibilityLabel="A runner mid-stride inside the Runivo hexagon" />
      </View>

      <Animated.View style={[s.bottom, { opacity: enter, transform: [{ translateY: rise }] }]}>
        <LandingHero />
        <LandingActions onSignUp={() => setSheet(true)} onSignIn={() => navigation.navigate('Login')} />
      </Animated.View>
      <SignUpSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        onEmail={() => { setSheet(false); navigation.navigate('SignUp'); }}
        onSignIn={() => { setSheet(false); navigation.navigate('Login'); }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: Colors.bg },
  top:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 14 },
  logo:      { flexDirection: 'row', alignItems: 'center', gap: 7 },
  word:      { fontFamily: Fonts.wordmark, fontSize: 23, letterSpacing: -0.8, color: Colors.t1 },
  signIn:    { height: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: Colors.card, justifyContent: 'center' },
  signInTxt: { fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.t1 },
  card:      { alignSelf: 'center', borderRadius: 34, overflow: 'hidden', backgroundColor: '#ECEBE7' },
  bottom:    { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 22, gap: 18, paddingTop: 16 },
});
