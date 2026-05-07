import React from 'react';
import { View, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
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
    <View style={s.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <SignUpForm
          {...signUp}
          emailExists={signUp.emailExists}
          rateLimitSeconds={signUp.rateLimitSeconds}
          onGoBack={() => navigation.goBack()}
          onGoLogin={() => navigation.navigate('Login')}
        />
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F5F2' },
});
