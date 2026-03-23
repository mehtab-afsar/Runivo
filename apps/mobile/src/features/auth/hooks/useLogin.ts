import { useState } from 'react';
import { signIn } from '../services/authService';

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

export interface LoginState {
  email: string;
  password: string;
  showPwd: boolean;
  loading: boolean;
  error: string;
  valid: boolean;
  setEmail: (v: string) => void;
  setPassword: (v: string) => void;
  setShowPwd: (v: boolean) => void;
  handleSignIn: () => Promise<void>;
}

export function useLogin(): LoginState {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const valid = emailOk(email) && password.length >= 6;

  const handleSignIn = async () => {
    if (!valid || loading) return;
    setLoading(true); setError('');
    try {
      await signIn(email.trim(), password);
      // AppNavigator re-renders automatically when auth state changes
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  return { email, password, showPwd, loading, error, valid, setEmail, setPassword, setShowPwd, handleSignIn };
}
