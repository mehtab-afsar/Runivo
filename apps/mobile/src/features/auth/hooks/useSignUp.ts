import { useState } from 'react';
import { signUp } from '../services/authService';

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

export interface SignUpState {
  username: string;
  email: string;
  pwd: string;
  showPwd: boolean;
  loading: boolean;
  error: string;
  valid: boolean;
  pwStrength: number;
  pwColor: string;
  setUsername: (v: string) => void;
  setEmail: (v: string) => void;
  setPwd: (v: string) => void;
  setShowPwd: (v: boolean) => void;
  handleSignUp: () => Promise<void>;
}

export function useSignUp(): SignUpState {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pwStrength = pwd.length === 0 ? 0 : pwd.length < 6 ? 1 : pwd.length < 10 ? 2 : 3;
  const pwColor = pwStrength === 1 ? '#D93518' : pwStrength === 2 ? '#D4870A' : '#1A6B40';
  const valid = username.trim().length >= 3 && emailOk(email) && pwd.length >= 8;

  const handleSignUp = async () => {
    if (!valid || loading) return;
    setLoading(true); setError('');
    try {
      await signUp(email.trim(), pwd, username.trim());
      // App.tsx detects new user (no player record) → shows Onboarding automatically
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sign up failed.');
    } finally {
      setLoading(false);
    }
  };

  return {
    username, email, pwd, showPwd, loading, error, valid, pwStrength, pwColor,
    setUsername, setEmail, setPwd, setShowPwd, handleSignUp,
  };
}
