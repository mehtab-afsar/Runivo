import React from 'react';
import { View, Text, Pressable, StyleSheet, SafeAreaView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import LandingHero from '../components/LandingHero';
import LandingActions from '../components/LandingActions';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function LandingScreen() {
  const navigation = useNavigation<Nav>();

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

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#F8F6F3' },
  navbar:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 12 : 4,
    paddingBottom: 10,
  },
  logo: {
    fontFamily: 'PlayfairDisplay_400Regular_Italic',
    fontSize: 16, color: '#0A0A0A',
  },
  navRight:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  signInBtn:    { paddingHorizontal: 4, paddingVertical: 4 },
  signInText:   {
    fontFamily: 'Barlow_400Regular', fontSize: 10,
    color: '#6B6B6B', letterSpacing: 0.8,
  },
  getStartedBtn: {
    backgroundColor: '#0A0A0A', borderRadius: 4,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  getStartedText: {
    fontFamily: 'Barlow_500Medium', fontSize: 10,
    color: '#FFFFFF', letterSpacing: 0.8,
  },
  content: { flex: 1, justifyContent: 'center' },
});
