import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizePhone, validateEmail, otpSendPolicy, isOtpCode } from '@shared/engine/onboarding';
import { track } from '@shared/services/analytics';
import { sendPhoneCode, verifyPhoneCode, sendEmailLink, verifyEmailCode } from '../services/authService';
import { onMagicLinkResult } from '../services/magicLink';

/**
 * choose   → Apple / Google / phone / email buttons
 * phone    → enter number          → code (sms)
 * email    → enter address         → emailSent → code (email)
 * password → the older email + password form, for existing accounts
 */
export type AuthStage = 'choose' | 'phone' | 'email' | 'emailSent' | 'code' | 'password' | 'passwordSignup';

export interface PasswordlessAuth {
  stage: AuthStage;
  setStage: (s: AuthStage) => void;
  channel: 'sms' | 'email';
  phone: string;
  setPhone: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  code: string;
  setCode: (v: string) => void;
  /** Where the code went, formatted for display. */
  destination: string;
  busy: boolean;
  error: string;
  /** Seconds before another code can be sent; 0 when allowed. */
  resendIn: number;
  resendsLeft: number;
  phoneValid: boolean;
  emailValid: boolean;
  submitPhone: () => Promise<void>;
  submitEmail: () => Promise<void>;
  resend: () => Promise<void>;
  submitCode: (code?: string) => Promise<void>;
  back: () => void;
}

export function usePasswordlessAuth(): PasswordlessAuth {
  // DEV ONLY: open on the email + password form so test accounts (dummy emails that
  // can't receive mail) skip the magic-link / code screens. Release builds start on 'choose'.
  const [stage, setStageRaw] = useState<AuthStage>(__DEV__ ? 'password' : 'choose');
  const [channel, setChannel] = useState<'sms' | 'email'>('sms');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const sends = useRef<Record<string, number[]>>({});

  // A magic link opened while this screen is up: show any failure here.
  useEffect(() => onMagicLinkResult(r => { if (!r.ok) { setError(r.error); setStageRaw('code'); } }), []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const setStage = useCallback((s: AuthStage) => { setError(''); setStageRaw(s); }, []);

  const phoneCheck = normalizePhone(phone);
  const phoneValid = phoneCheck.ok;
  const emailValid = validateEmail(email);

  const policyFor = (dest: string) => otpSendPolicy(sends.current[dest] ?? [], now);
  const policy = destination ? policyFor(destination) : { allowed: true, waitSeconds: 0, resendsLeft: 3 };

  const send = useCallback(async (kind: 'sms' | 'email', dest: string) => {
    const p = otpSendPolicy(sends.current[dest] ?? [], Date.now());
    if (!p.allowed) {
      setError(p.resendsLeft === 0
        ? `Too many codes. Try again in ${Math.ceil(p.waitSeconds / 60)} min.`
        : `Wait ${p.waitSeconds}s before asking again.`);
      return false;
    }
    setBusy(true); setError('');
    try {
      if (kind === 'sms') await sendPhoneCode(dest); else await sendEmailLink(dest);
      sends.current[dest] = [...(sends.current[dest] ?? []), Date.now()];
      setNow(Date.now());
      track('auth_code_sent', { channel: kind });
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the code.');
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const submitPhone = useCallback(async () => {
    if (!phoneCheck.ok || busy) { if (!phoneCheck.ok) setError(phoneCheck.error); return; }
    const dest = phoneCheck.e164;
    if (await send('sms', dest)) {
      setChannel('sms'); setDestination(dest); setCode(''); setStageRaw('code');
    }
  }, [phoneCheck, busy, send]);

  const submitEmail = useCallback(async () => {
    if (!emailValid || busy) { if (!emailValid) setError('Enter a valid email address.'); return; }
    const dest = email.trim().toLowerCase();
    if (await send('email', dest)) {
      setChannel('email'); setDestination(dest); setCode(''); setStageRaw('emailSent');
    }
  }, [email, emailValid, busy, send]);

  const resend = useCallback(async () => {
    if (!destination) return;
    await send(channel, destination);
  }, [channel, destination, send]);

  const submitCode = useCallback(async (value?: string) => {
    const c = (value ?? code).trim();
    if (!isOtpCode(c) || busy) return;
    setBusy(true); setError('');
    try {
      if (channel === 'sms') await verifyPhoneCode(destination, c);
      else await verifyEmailCode(destination, c);
      track('auth_signed_in', { method: channel === 'sms' ? 'phone' : 'email_code' });
      // App.tsx's auth listener takes it from here (onboarding or home).
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That code didn\'t work.');
      setCode('');
    } finally {
      setBusy(false);
    }
  }, [code, busy, channel, destination]);

  const back = useCallback(() => {
    setError('');
    setStageRaw(s => {
      if (s === 'code') return channel === 'sms' ? 'phone' : 'emailSent';
      if (s === 'emailSent') return 'email';
      if (s === 'passwordSignup') return 'password';
      return 'choose';
    });
  }, [channel]);

  return {
    stage, setStage, channel, phone, setPhone, email, setEmail, code, setCode, destination,
    busy, error, resendIn: policy.allowed ? 0 : policy.waitSeconds, resendsLeft: policy.resendsLeft,
    phoneValid, emailValid, submitPhone, submitEmail, resend, submitCode, back,
  };
}
