import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { haptic } from '@shared/lib/haptics';
import { signUp } from '@shared/services/auth';
import { T, F, FD, HexMark, Field, OrDivider, FullBtn, AuthShell } from '../components/shared';

interface SignUpPageProps {
  onComplete: () => void;
  onBack: () => void;
  onSignIn: () => void;
}

export function SignUpPage({ onComplete, onBack, onSignIn }: SignUpPageProps) {
  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [pwd,     setPwd]     = useState('');
  const [err,     setErr]     = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
  const valid    = name.trim().length >= 3 && emailOk(email) && pwd.length >= 8;

  const pwStrength = pwd.length === 0 ? 0 : pwd.length < 6 ? 1 : pwd.length < 10 ? 2 : 3;
  const pwColor    = pwStrength === 1 ? T.red : pwStrength === 2 ? '#D4870A' : '#1A6B40';

  const handleSignUp = async () => {
    if (!valid) return;
    setLoading(true); setErr('');
    try {
      await signUp(email.trim(), pwd, name.trim());
      haptic('success');
      onComplete();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Sign up failed.');
    } finally { setLoading(false); }
  };

  return (
    <AuthShell>
      {/* 220px ghost watermark — red/pink on white */}
      <div style={{ position: 'absolute', bottom: -32, right: -32, opacity: 0.04, pointerEvents: 'none' }}>
        <HexMark size={220} darkColor={T.red} lightColor="rgba(217,53,24,0.20)" strokeWidth={2} />
      </div>

      <div style={{ position: 'relative', zIndex: 2 }}>
        {/* Back */}
        <button onClick={() => { haptic('light'); onBack(); }} style={{ background: 'none', border: 'none', fontFamily: F, fontSize: 11, color: T.t3, cursor: 'pointer', padding: 0, marginBottom: 28 }}>
          ← Back
        </button>

        {/* Logo — red/pink (energy colorway) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <HexMark size={26} darkColor={T.red} lightColor={T.redLight} strokeWidth={1.8} />
          <span style={{ fontFamily: F, fontWeight: 300, fontSize: 15, color: T.black, letterSpacing: '-0.01em' }}>runivo</span>
        </div>

        {/* Title */}
        <div style={{ fontFamily: FD, fontStyle: 'italic', fontSize: 28, color: T.black, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 6 }}>
          Join the conquest.
        </div>
        <div style={{ fontSize: 12, fontFamily: F, fontWeight: 300, color: T.t3, lineHeight: 1.6, marginBottom: 28 }}>
          Create your account and claim your city.
        </div>

        {/* Fields */}
        <Field
          label="Username" value={name} onChange={setName}
          placeholder="e.g. marcus_runs" maxLen={20} autoFocus
          rightEl={<span style={{ fontSize: 9, fontFamily: F, fontWeight: 300, color: T.t3 }}>{name.length}/20</span>}
        />
        <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="you@example.com" />
        <Field
          label="Password" value={pwd} onChange={setPwd}
          type={showPwd ? 'text' : 'password'} placeholder="Min. 8 characters"
          rightEl={
            <button onClick={() => setShowPwd(p => !p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.t3, display: 'flex', padding: 0 }}>
              {showPwd ? <EyeOff size={13} strokeWidth={1.5} /> : <Eye size={13} strokeWidth={1.5} />}
            </button>
          }
        />

        {/* Password strength */}
        {pwd.length > 0 && (
          <div style={{ display: 'flex', gap: 4, marginTop: 6, marginBottom: 4 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ flex: 1, height: 2, borderRadius: 1, background: i <= pwStrength ? pwColor : '#E8E4DF', transition: 'background 0.2s' }} />
            ))}
          </div>
        )}

        {err && <div style={{ fontSize: 9, color: T.red, fontFamily: F, marginTop: 8, marginBottom: 4 }}>{err}</div>}

        <div style={{ marginTop: 20 }}>
          <FullBtn label={loading ? 'Creating…' : 'Create account →'} onClick={handleSignUp} bg={T.red} disabled={!valid} loading={loading} />
        </div>

        <OrDivider />

        <button className="lp-ghost-btn" style={{ fontFamily: F }}>Continue with Google</button>

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 9, fontFamily: F, fontWeight: 300, color: T.t3, lineHeight: 1.5 }}>
          By creating an account you agree to our Terms & Privacy Policy
        </div>

        <div style={{ marginTop: 14, textAlign: 'center', fontSize: 11, fontFamily: F, fontWeight: 300, color: T.t3 }}>
          Already a runner?{' '}
          <span onClick={() => { haptic('light'); onSignIn(); }} style={{ color: T.black, textDecoration: 'underline', cursor: 'pointer', fontWeight: 400 }}>
            Sign in
          </span>
        </div>
      </div>
    </AuthShell>
  );
}
