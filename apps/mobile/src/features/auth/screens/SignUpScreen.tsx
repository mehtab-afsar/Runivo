import React from 'react';
import AuthScreen from './AuthScreen';

/**
 * "Get started" → the same flow as sign-in: the first passwordless sign-in
 * creates the account. The older email + password sign-up stays reachable
 * from there ("Use a password instead").
 */
export default function SignUpScreen() {
  return <AuthScreen mode="signup" />;
}
