import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { haptic } from '@shared/lib/haptics';
import { signIn } from '@shared/services/auth';
import { T, F, FD, HexMark, Field, OrDivider, FullBtn, AuthShell } from '../components/shared';

interface LoginPageProps {
  onComplete: () => void;
  onBack: () => void;
  onSignUp: () => void;
}

export function LoginPage({ onComplete, onBack, onSignUp }: LoginPageProps) {
  const [email,   setEmail]   = useState('');
  const [pwd,     setPwd]     = useState('');
  const [err,     setErr]     = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const handleSignIn = async () => {
    if (!email || !pwd) return;
    setLoading(true); setErr('');
    try {
      await signIn(email.trim(), pwd);
      localStorage.setItem('runivo-onboarding-complete', 'true');
      haptic('success');
      onComplete();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Sign in failed.');
    } finally { setLoading(false); }
  };

  return (
    <AuthShell>
      {/* 220px ghost watermark — black/gray */}
      <div style={{ position: 'absolute', bottom: -32, right: -32, opacity: 0.06, pointerEvents: 'none' }}>
        <HexMark size={220} darkColor={T.red} lightColor="rgba(217,53,24,0.20)" strokeWidth={2} />
      </div>

      <div style={{ position: 'relative', zIndex: 2 }}>
        {/* Back */}
        <button onClick={() => { haptic('light'); onBack(); }} style={{ background: 'none', border: 'none', fontFamily: F, fontSize: 11, color: T.t3, cursor: 'pointer', padding: 0, marginBottom: 28 }}>
          ← Back
        </button>

        {/* Logo — black/gray */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <HexMark size={26} darkColor={T.black} lightColor={T.hexMuted} strokeWidth={1.8} />
          <span style={{ fontFamily: F, fontWeight: 300, fontSize: 15, color: T.black, letterSpacing: '-0.01em' }}>runivo</span>
        </div>

        {/* Title */}
        <div style={{ fontFamily: FD, fontStyle: 'italic', fontSize: 28, color: T.black, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 6 }}>
          Welcome back.
        </div>
        <div style={{ fontSize: 12, fontFamily: F, fontWeight: 300, color: T.t3, lineHeight: 1.6, marginBottom: 28 }}>
          Sign in to continue your conquest.
        </div>

        {/* Fields */}
        <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="you@example.com" autoFocus />
        <Field
          label="Password" value={pwd} onChange={setPwd}
          type={showPwd ? 'text' : 'password'} placeholder="••••••••"
          rightEl={
            <button onClick={() => setShowPwd(p => !p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.t3, display: 'flex', padding: 0 }}>
              {showPwd ? <EyeOff size={13} strokeWidth={1.5} /> : <Eye size={13} strokeWidth={1.5} />}
            </button>
          }
        />

        <div style={{ textAlign: 'right', margin: '8px 0 24px' }}>
          <span style={{ fontSize: 10, fontFamily: F, fontWeight: 300, color: T.t3, textDecoration: 'underline', cursor: 'pointer' }}>Forgot password?</span>
        </div>

        {err && <div style={{ fontSize: 9, color: T.red, fontFamily: F, marginBottom: 10 }}>{err}</div>}

        <FullBtn label={loading ? 'Signing in…' : 'Sign in →'} onClick={handleSignIn} bg={T.black} loading={loading} />

        <OrDivider />

        <button className="lp-ghost-btn" style={{ fontFamily: F }}>Continue with Google</button>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 11, fontFamily: F, fontWeight: 300, color: T.t3 }}>
          New here?{' '}
          <span onClick={() => { haptic('light'); onSignUp(); }} style={{ color: T.black, textDecoration: 'underline', cursor: 'pointer', fontWeight: 400 }}>
            Create an account
          </span>
        </div>
      </div>
    </AuthShell>
  );
}
