import React from 'react';
import { SafeAreaView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useSignUp } from '../hooks/useSignUp';
import SignUpForm from '../components/SignUpForm';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SignUpScreen() {
  const navigation = useNavigation<Nav>();
  const signUp = useSignUp();

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <SignUpForm
          {...signUp}
          onGoBack={() => navigation.goBack()}
          onGoLogin={() => navigation.navigate('Login')}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F6F3' },
});
