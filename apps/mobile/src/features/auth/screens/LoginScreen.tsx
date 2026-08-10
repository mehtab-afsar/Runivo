import React from 'react';
import { View, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useLogin } from '../hooks/useLogin';
import LoginForm from '../components/LoginForm';
import { useTheme } from '@theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function LoginScreen() {
  const navigation = useNavigation<Nav>();
  const login = useLogin();
  const C = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <LoginForm
          {...login}
          onGoBack={() => navigation.goBack()}
          onGoSignUp={() => navigation.navigate('SignUp')}
        />
      </KeyboardAvoidingView>
    </View>
  );
}
