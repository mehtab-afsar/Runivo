import { useState, useEffect, useRef } from 'react';
import { signIn, resetPassword } from '../services/authService';

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

// Sign-in had no attempt counter, lockout, backoff or captcha — the button was
// re-enabled immediately on failure, so the only brake was Supabase's per-IP default.
// That does nothing against distributed credential stuffing on one account.
//
// This is a UX-level brake only: a patched client can skip it. The authoritative
// controls are captcha + per-account rate limiting in the Supabase dashboard (see
// the captchaToken parameter on signIn). Kept here because it costs nothing and
// stops casual online guessing.
const FREE_ATTEMPTS  = 3;
const BACKOFF_BASE_S = 5;   // 5s, 10s, 20s, 40s … capped
const BACKOFF_MAX_S  = 300;

// Password reset was likewise unthrottled — repeated presses fired
// resetPasswordForEmail back to back, an email-bomb vector against any known address.
const RESET_COOLDOWN_S = 60;

export interface LoginState {
  email: string;
  password: string;
  showPwd: boolean;
  loading: boolean;
  error: string;
  resetSent: boolean;
  valid: boolean;
  /** Seconds until another sign-in attempt is allowed; 0 when not throttled. */
  lockoutSeconds: number;
  /** Seconds until another reset email may be requested; 0 when not throttled. */
  resetCooldownSeconds: number;
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
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [resetCooldownSeconds, setResetCooldownSeconds] = useState(0);
  const failedAttempts = useRef(0);

  // One ticker drives both counters down to zero.
  useEffect(() => {
    if (lockoutSeconds === 0 && resetCooldownSeconds === 0) return;
    const t = setInterval(() => {
      setLockoutSeconds(s => (s > 0 ? s - 1 : 0));
      setResetCooldownSeconds(s => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [lockoutSeconds, resetCooldownSeconds]);

  const valid = emailOk(email) && password.length >= 6;

  const handleSignIn = async () => {
    if (!valid || loading || lockoutSeconds > 0) return;
    setLoading(true); setError(''); setResetSent(false);
    try {
      await signIn(email.trim(), password);
      failedAttempts.current = 0;
    } catch (e: unknown) {
      failedAttempts.current += 1;
      if (failedAttempts.current > FREE_ATTEMPTS) {
        const n = failedAttempts.current - FREE_ATTEMPTS - 1;
        setLockoutSeconds(Math.min(BACKOFF_BASE_S * 2 ** n, BACKOFF_MAX_S));
      }
      setError(e instanceof Error ? e.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (loading || resetCooldownSeconds > 0) return;
    if (!emailOk(email)) {
      setError('Enter your email address first.');
      return;
    }
    setLoading(true); setError(''); setResetSent(false);
    try {
      await resetPassword(email.trim());
      setResetSent(true);
      setResetCooldownSeconds(RESET_COOLDOWN_S);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return {
    email, password, showPwd, loading, error, resetSent, valid,
    lockoutSeconds, resetCooldownSeconds,
    setEmail, setPassword, setShowPwd, handleSignIn, handleForgotPassword,
  };
}
