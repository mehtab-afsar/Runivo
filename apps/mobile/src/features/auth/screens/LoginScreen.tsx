import React from 'react';
import { View, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useLogin } from '../hooks/useLogin';
import LoginForm from '../components/LoginForm';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function LoginScreen() {
  const navigation = useNavigation<Nav>();
  const login = useLogin();

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F5F2' }}>
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
