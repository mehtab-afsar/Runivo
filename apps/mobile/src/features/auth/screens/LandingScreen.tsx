import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, SafeAreaView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import HexMark from '../components/HexMark';
import LandingHero from '../components/LandingHero';
import LandingFeatures from '../components/LandingFeatures';
import LandingActions from '../components/LandingActions';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function LandingScreen() {
  const navigation = useNavigation<Nav>();
  const float1 = useRef(new Animated.Value(0)).current;
  const float2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(float1, { toValue: -18, duration: 3000, useNativeDriver: true }),
      Animated.timing(float1, { toValue: 0,   duration: 3000, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(float2, { toValue: -10, duration: 4250, useNativeDriver: true }),
      Animated.timing(float2, { toValue: 0,   duration: 4250, useNativeDriver: true }),
    ])).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SafeAreaView style={s.root}>
      <Animated.View style={[s.hexAccent1, { transform: [{ translateY: float1 }] }]}>
        <HexMark size={64} color="#D93518" fadedOpacity={0.22} />
      </Animated.View>
      <Animated.View style={[s.hexAccent2, { transform: [{ translateY: float2 }] }]}>
        <HexMark size={44} color="#D93518" fadedOpacity={0.18} />
      </Animated.View>

      <View style={s.navbar}>
        <View style={s.logoRow}>
          <HexMark size={28} color="#0A0A0A" fadedOpacity={0.3} />
          <Text style={s.logoText}>run<Text style={s.logoRed}>ivo</Text></Text>
        </View>
        <Pressable onPress={() => navigation.navigate('Login')}>
          <Text style={s.signInLink}>Sign in</Text>
        </Pressable>
      </View>

      <LandingHero />
      <LandingFeatures />
      <LandingActions
        onSignUp={() => navigation.navigate('SignUp')}
        onSignIn={() => navigation.navigate('Login')}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F6F3' },
  hexAccent1: { position: 'absolute', top: '12%', right: -14, zIndex: 1 },
  hexAccent2: { position: 'absolute', bottom: '22%', left: -10, zIndex: 1 },
  navbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0,
    paddingBottom: 8, zIndex: 2,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoText: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 17, color: '#0A0A0A' },
  logoRed: { color: '#D93518' },
  signInLink: { fontFamily: 'Barlow_400Regular', fontSize: 11, color: '#6B6B6B' },
});
