import React from 'react';
import AuthScreen from './AuthScreen';
// Installs the magic-link handler at app launch (the navigator imports this
// screen up front), so a sign-in link that cold-starts the app still works.
import '../services/magicLink';

/** "I already have an account" → the passwordless sign-in flow. */
export default function LoginScreen() {
  return <AuthScreen mode="login" />;
}
