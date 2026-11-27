import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Linking: { getInitialURL: vi.fn().mockResolvedValue(null), addEventListener: vi.fn() },
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() },
}));
vi.mock('@shared/services/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() }, rpc: vi.fn() },
}));

import { inviteCodeFromUrl } from './inviteLink';

describe('inviteCodeFromUrl', () => {
  it('reads the app link and the web link', () => {
    expect(inviteCodeFromUrl('runivo://invite?code=abcd2345')).toBe('ABCD2345');
    expect(inviteCodeFromUrl('https://runivo.in/invite/?code=ABCD2345')).toBe('ABCD2345');
  });
  it('ignores other links and junk codes', () => {
    expect(inviteCodeFromUrl('runivo://auth/magic?code=ABCD2345')).toBeNull();
    expect(inviteCodeFromUrl('https://evil.example/invite?code=ABCD2345')).toBeNull();
    expect(inviteCodeFromUrl('runivo://invite?code=AB')).toBeNull();
    expect(inviteCodeFromUrl('runivo://invite?code=<script>')).toBeNull();
    expect(inviteCodeFromUrl(null)).toBeNull();
  });
});
