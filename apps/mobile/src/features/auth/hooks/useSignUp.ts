import { useState, useEffect, useRef } from 'react';
import { signUp } from '../services/authService';
import { track } from '@shared/services/analytics';
import { useTheme } from '@theme';

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

export interface SignUpState {
  username: string;
  email: string;
  pwd: string;
  showPwd: boolean;
  loading: boolean;
  error: string;
  emailExists: boolean;
  needsEmailConfirmation: boolean;
  rateLimitSeconds: number;
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
  const C = useTheme();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailExists, setEmailExists] = useState(false);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer for rate limit
  useEffect(() => {
    if (rateLimitSeconds <= 0) return;
    timerRef.current = setInterval(() => {
      setRateLimitSeconds(s => {
        if (s <= 1) { clearInterval(timerRef.current!); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [rateLimitSeconds]);

  const pwStrength = pwd.length === 0 ? 0 : pwd.length < 6 ? 1 : pwd.length < 10 ? 2 : 3;
  const pwColor = pwStrength === 1 ? C.red : pwStrength === 2 ? C.amber : C.green;
  const valid = username.trim().length >= 3 && emailOk(email) && pwd.length >= 8;

  const handleSignUp = async () => {
    if (!valid || loading || rateLimitSeconds > 0) return;
    setLoading(true); setError(''); setEmailExists(false); setNeedsEmailConfirmation(false);
    try {
      const { needsEmailConfirmation: pending } = await signUp(email.trim(), pwd, username.trim());
      track('signup');
      if (pending) {
        // "Confirm email" is enabled server-side — no session yet, so App.tsx's
        // auth listener never fires and nothing navigates. Without this, the
        // screen just sat there with a stopped spinner and no explanation.
        setNeedsEmailConfirmation(true);
      }
      // Otherwise App.tsx detects new user (no player record) → shows Onboarding
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Sign up failed.';
      const lower = msg.toLowerCase();
      if (lower.includes('already registered') || lower.includes('already been registered') || lower.includes('user already exists')) {
        setEmailExists(true);
        setError('');
      } else if (lower.includes('rate limit') || lower.includes('too many') || lower.includes('for security')) {
        // Extract seconds if present, default to 60
        const match = lower.match(/(\d+)\s*second/);
        setRateLimitSeconds(match ? parseInt(match[1], 10) : 60);
        setError('');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return {
    username, email, pwd, showPwd, loading, error, emailExists, needsEmailConfirmation, rateLimitSeconds,
    valid, pwStrength, pwColor,
    setUsername, setEmail, setPwd, setShowPwd, handleSignUp,
  };
}
