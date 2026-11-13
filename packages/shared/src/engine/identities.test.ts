import { describe, it, expect } from 'vitest';
import {
  linkedMethods, linkableMethods, unlinkBlockReason, maskEmail, maskPhone, methodLabel, linkErrorMessage,
  type IdentityLike,
} from './identities';

const google: IdentityLike = { identity_id: 'g1', provider: 'google', identity_data: { email: 'asha.k@gmail.com' } };
const apple: IdentityLike = { identity_id: 'a1', provider: 'apple', identity_data: { email: 'xyz@privaterelay.appleid.com' } };
const email: IdentityLike = { identity_id: 'e1', provider: 'email', identity_data: { email: 'asha@runivo.app' } };
const phone: IdentityLike = { identity_id: 'p1', provider: 'phone', identity_data: { phone: '919876543210' } };

describe('masking', () => {
  it('masks emails', () => {
    expect(maskEmail('asha@runivo.app')).toBe('as•••@runivo.app');
    expect(maskEmail('a@b.co')).toBe('a•••@b.co');
    expect(maskEmail('nope')).toBeNull();
    expect(maskEmail(null)).toBeNull();
  });

  it('masks phone numbers, keeping country code and the tail', () => {
    expect(maskPhone('+919876543210')).toBe('+91 ••••• 43210');
    // Supabase stores identity phones without the '+': no country code shown then.
    expect(maskPhone('919876543210')).toBe('••••• 43210');
    expect(maskPhone('+14155550123')).toBe('+1 ••••• 50123');
    expect(maskPhone('123')).toBeNull();
  });

  it('labels methods', () => {
    expect(methodLabel('apple')).toBe('Apple');
    expect(methodLabel('phone')).toBe('Phone number');
  });
});

describe('linkedMethods', () => {
  it('lists each method once, in a stable order, with masked details', () => {
    const rows = linkedMethods([email, google, apple], { email: 'asha@runivo.app' });
    expect(rows.map(r => r.method)).toEqual(['apple', 'google', 'email']);
    expect(rows[1].detail).toBe('as•••@gmail.com');
  });

  it('a single method can never be unlinked', () => {
    const rows = linkedMethods([google], { email: 'asha.k@gmail.com' });
    expect(rows).toHaveLength(1);
    expect(rows[0].canUnlink).toBe(false);
    expect(unlinkBlockReason(rows[0], rows)).toMatch(/only way/);
  });

  it('two or more methods with identities can each be unlinked', () => {
    const rows = linkedMethods([google, phone], { phone: '919876543210' });
    expect(rows.map(r => [r.method, r.canUnlink])).toEqual([['google', true], ['phone', true]]);
    expect(rows.every(r => unlinkBlockReason(r, rows) === null)).toBe(true);
  });

  it('a phone added to the user without its own identity counts as a way in but cannot be removed here', () => {
    const rows = linkedMethods([google], { email: 'asha.k@gmail.com', phone: '+919876543210' });
    expect(rows.map(r => r.method)).toEqual(['google', 'phone']);
    const phoneRow = rows.find(r => r.method === 'phone')!;
    expect(phoneRow.identity).toBeNull();
    expect(phoneRow.canUnlink).toBe(false);
    expect(unlinkBlockReason(phoneRow, rows)).toMatch(/stays/);
    // Google can go, because the phone still signs them in.
    expect(rows[0].canUnlink).toBe(true);
  });

  it('ignores unknown providers and duplicates', () => {
    const rows = linkedMethods([google, { identity_id: 'g2', provider: 'google' }, { provider: 'github' }], {});
    expect(rows.map(r => r.method)).toEqual(['google']);
  });

  it('an email-only legacy account with no identities still shows its email', () => {
    const rows = linkedMethods([], { email: 'old@runivo.app' });
    expect(rows.map(r => r.method)).toEqual(['email']);
    expect(rows[0].canUnlink).toBe(false);
  });
});

describe('linkableMethods', () => {
  it('offers what is missing; Apple only on iOS', () => {
    const rows = linkedMethods([email], { email: 'asha@runivo.app' });
    expect(linkableMethods(rows, 'ios')).toEqual(['apple', 'google', 'phone']);
    expect(linkableMethods(rows, 'android')).toEqual(['google', 'phone']);
  });

  it('offers nothing once everything is linked', () => {
    const rows = linkedMethods([apple, google, phone], { phone: '919876543210' });
    expect(linkableMethods(rows, 'ios')).toEqual([]);
  });
});

describe('linkErrorMessage', () => {
  it.each([
    ['Manual linking is disabled', /isn’t switched on/],
    ['Identity is already linked to another user', /another Runivo profile/],
    ['User must have at least 2 identities to unlink', /at least one way/],
    ['For security purposes, rate limit exceeded', /Too many/],
    ['Token has expired or is invalid', /didn’t work/],
    ['boom', /Something went wrong/],
  ])('%s', (msg, re) => {
    expect(linkErrorMessage(msg)).toMatch(re);
  });
});
