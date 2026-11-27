'use client';

/**
 * Completes the Supabase password-recovery flow. supabase.auth.resetPasswordForEmail
 * sends the user here with recovery tokens in the URL; supabase-js's default
 * detectSessionInUrl picks those up automatically on page load and fires a
 * PASSWORD_RECOVERY auth event, after which supabase.auth.updateUser() can set a
 * new password. Previously nothing in the app (native or web) could complete this
 * flow at all — the email either had no working link (native) or nowhere to land.
 */

import { useState, useEffect } from 'react';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { supabase } from '@/lib/supabase';

type Status = 'checking' | 'ready' | 'invalid' | 'success';

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>('checking');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setStatus('ready');
    });
    // The recovery event can fire before this listener is attached — check for an
    // already-established session (detectSessionInUrl runs on client init).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setStatus('ready');
      else setStatus((s) => (s === 'checking' ? 'invalid' : s));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async () => {
    setError(null);
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords don’t match.'); return; }
    setSaving(true);
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateErr) { setError(updateErr.message); return; }
    setStatus('success');
  };

  return (
    <>
      <Nav />
      <main id="main" style={{ padding: '120px 24px 80px', minHeight: '60vh' }}>
        <div style={{ maxWidth: 420, margin: '0 auto' }}>
          <p style={{
            fontSize: 14, color: 'var(--accent)', fontFamily: 'var(--font-body)', fontWeight: 500, marginBottom: 14,
          }}>
            Account
          </p>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 40px)', color: 'var(--t1)',
            marginBottom: 32, letterSpacing: '-0.02em',
          }}>
            Reset your password
          </h1>

          {status === 'checking' && (
            <p style={{ color: 'var(--t2)', fontFamily: 'var(--font-body)' }}>Verifying your link…</p>
          )}

          {status === 'invalid' && (
            <p style={{ color: 'var(--t2)', fontFamily: 'var(--font-body)', lineHeight: 1.6 }}>
              This reset link is invalid or has expired. Request a new one from the app
              (Settings → Change Password) and open the new link from your email.
            </p>
          )}

          {status === 'success' && (
            <p style={{ color: 'var(--t2)', fontFamily: 'var(--font-body)', lineHeight: 1.6 }}>
              Your password has been updated. You can now sign in with your new password
              in the Runivo app.
            </p>
          )}

          {status === 'ready' && (
            <form
              onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <div>
                <label className="field-label" htmlFor="new-password">New password</label>
                <input
                  id="new-password" className="field" type="password" autoComplete="new-password" required
                  value={password} onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="confirm-password">Confirm new password</label>
                <input
                  id="confirm-password" className="field" type="password" autoComplete="new-password" required
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              {error && <p role="alert" className="form-error">{error}</p>}
              <button
                type="submit" className="btn btn-dark"
                disabled={saving || !password || !confirmPassword}
              >
                {saving ? 'Saving…' : 'Set new password'}
              </button>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
