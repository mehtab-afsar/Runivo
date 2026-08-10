import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, SafeAreaView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import LandingHero from '../components/LandingHero';
import LandingActions from '../components/LandingActions';
import { useTheme, Fonts, type AppColors } from '@theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function LandingScreen() {
  const navigation = useNavigation<Nav>();
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);

  return (
    <SafeAreaView style={s.root}>
      {/* Navbar */}
      <View style={s.navbar}>
        <Text style={s.logo}>runivo</Text>
        <View style={s.navRight}>
          <Pressable onPress={() => navigation.navigate('Login')} style={s.signInBtn}>
            <Text style={s.signInText}>SIGN IN</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('SignUp')} style={s.getStartedBtn}>
            <Text style={s.getStartedText}>GET STARTED</Text>
          </Pressable>
        </View>
      </View>

      {/* Hero — vertically centred */}
      <View style={s.content}>
        <LandingHero />
      </View>

      {/* CTAs pinned to bottom */}
      <LandingActions
        onSignUp={() => navigation.navigate('SignUp')}
        onSignIn={() => navigation.navigate('Login')}
      />
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:    { flex: 1, backgroundColor: C.bg },
    navbar:  {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'android' ? 12 : 4,
      paddingBottom: 10,
    },
    logo: {
      fontFamily: Fonts.display,
      fontSize: 16, color: C.t1,
    },
    navRight:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
    signInBtn:    { paddingHorizontal: 4, paddingVertical: 4 },
    signInText:   {
      fontFamily: Fonts.regular, fontSize: 10,
      color: C.t2, letterSpacing: 0.8,
    },
    getStartedBtn: {
      backgroundColor: C.alwaysDark, borderRadius: 4,
      paddingHorizontal: 14, paddingVertical: 7,
    },
    getStartedText: {
      fontFamily: Fonts.medium, fontSize: 10,
      color: C.alwaysLight, letterSpacing: 0.8,
    },
    content: { flex: 1, justifyContent: 'center' },
  });
}
