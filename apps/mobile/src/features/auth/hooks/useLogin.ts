import { useState } from 'react';
import { signIn, resetPassword } from '../services/authService';

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

export interface LoginState {
  email: string;
  password: string;
  showPwd: boolean;
  loading: boolean;
  error: string;
  resetSent: boolean;
  valid: boolean;
  setEmail: (v: string) => void;
  setPassword: (v: string) => void;
  setShowPwd: (v: boolean) => void;
  handleSignIn: () => Promise<void>;
  handleForgotPassword: () => Promise<void>;
}

export function useLogin(): LoginState {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const valid = emailOk(email) && password.length >= 6;

  const handleSignIn = async () => {
    if (!valid || loading) return;
    setLoading(true); setError(''); setResetSent(false);
    try {
      await signIn(email.trim(), password);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (loading) return;
    if (!emailOk(email)) {
      setError('Enter your email address first.');
      return;
    }
    setLoading(true); setError(''); setResetSent(false);
    try {
      await resetPassword(email.trim());
      setResetSent(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return { email, password, showPwd, loading, error, resetSent, valid, setEmail, setPassword, setShowPwd, handleSignIn, handleForgotPassword };
}
