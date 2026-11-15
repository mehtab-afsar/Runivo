import { describe, expect, it } from 'vitest';
import { decryptSession, encryptSession, isEncrypted } from './sessionCrypto';

const key = (n: number) => new Uint8Array(32).fill(n);
const ctr = (n: number) => new Uint8Array(16).fill(n);
const session = JSON.stringify({ access_token: 'a'.repeat(1500), refresh_token: 'r-token', user: { id: 'u1', email: 'é@x.com' } });

describe('session encryption', () => {
  it('round-trips a session larger than SecureStore allows, including non-ASCII', () => {
    const stored = encryptSession(key(7), ctr(1), session);
    expect(stored.length).toBeGreaterThan(2048);
    expect(decryptSession(key(7), stored)).toBe(session);
  });

  it('never leaves the tokens readable in what is stored', () => {
    const stored = encryptSession(key(7), ctr(1), session);
    expect(isEncrypted(stored)).toBe(true);
    expect(stored).not.toContain('r-token');
    expect(stored).not.toContain('access_token');
  });

  it('uses the counter, so the same session encrypts differently each time', () => {
    expect(encryptSession(key(7), ctr(1), session)).not.toBe(encryptSession(key(7), ctr(2), session));
  });

  it('refuses a wrong key instead of returning garbage', () => {
    const stored = encryptSession(key(7), ctr(1), session);
    expect(() => decryptSession(key(8), stored)).toThrow();
  });

  it('refuses plaintext and damaged values', () => {
    expect(() => decryptSession(key(7), session)).toThrow();
    expect(() => decryptSession(key(7), 'enc1:zz')).toThrow();
    expect(() => decryptSession(key(7), 'enc1:' + '0'.repeat(33))).toThrow();
    expect(isEncrypted(session)).toBe(false);
  });
});
