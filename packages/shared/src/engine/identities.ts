/**
 * Sign-in methods on one Runivo account (PRD: one account per person; link
 * Apple, Google and phone to the same profile).
 *
 * Pure rules for the Settings "Sign-in methods" section. The app feeds in
 * supabase.auth.getUserIdentities() and the current user; nothing here talks
 * to Supabase.
 */

export type SignInMethod = 'email' | 'google' | 'apple' | 'phone';

/** The parts of a Supabase identity we use. */
export interface IdentityLike {
  identity_id?: string;
  id?: string;
  provider: string;
  identity_data?: { email?: string; phone?: string } | null;
}

export interface UserLike {
  email?: string | null;
  phone?: string | null;
}

export interface LinkedMethod {
  method: SignInMethod;
  label: string;
  /** Masked email or number, or null. */
  detail: string | null;
  /** The Supabase identity behind it; unlinking needs one. */
  identity: IdentityLike | null;
  canUnlink: boolean;
}

const ORDER: SignInMethod[] = ['apple', 'google', 'phone', 'email'];

export function methodLabel(method: SignInMethod): string {
  switch (method) {
    case 'apple':  return 'Apple';
    case 'google': return 'Google';
    case 'phone':  return 'Phone number';
    case 'email':  return 'Email';
  }
}

function toMethod(provider: string): SignInMethod | null {
  return provider === 'email' || provider === 'google' || provider === 'apple' || provider === 'phone' ? provider : null;
}

/** "as•••@runivo.app": enough to recognise, not enough to copy. */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email || !email.includes('@')) return null;
  const [local, domain] = email.split('@');
  return `${local.slice(0, Math.min(2, local.length))}•••@${domain}`;
}

/** "+91 ••••• 43210". Keeps the country code and last 4–5 digits. */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.length < 7) return null;
  const tail = digits.slice(-Math.min(5, digits.length - 4));
  const cc = phone.trim().startsWith('+') && digits.length > 10 ? `+${digits.slice(0, digits.length - 10)} ` : '';
  return `${cc}••••• ${tail}`;
}

/**
 * Everything the runner can sign in with, one row per method, in a stable
 * order. A phone or email on the user without its own identity still counts
 * as a way in (Supabase lets you sign in with it), but can't be unlinked here.
 */
export function linkedMethods(identities: IdentityLike[], user: UserLike): LinkedMethod[] {
  const byMethod = new Map<SignInMethod, LinkedMethod>();
  for (const identity of identities) {
    const method = toMethod(identity.provider);
    if (!method || byMethod.has(method)) continue;
    const detail = method === 'phone'
      ? maskPhone(identity.identity_data?.phone ?? user.phone)
      : maskEmail(identity.identity_data?.email ?? (method === 'email' ? user.email : null));
    byMethod.set(method, { method, label: methodLabel(method), detail, identity, canUnlink: false });
  }
  if (user.phone && !byMethod.has('phone')) {
    byMethod.set('phone', { method: 'phone', label: methodLabel('phone'), detail: maskPhone(user.phone), identity: null, canUnlink: false });
  }
  if (user.email && !byMethod.has('email') && byMethod.size === 0) {
    byMethod.set('email', { method: 'email', label: methodLabel('email'), detail: maskEmail(user.email), identity: null, canUnlink: false });
  }

  const rows = ORDER.filter(m => byMethod.has(m)).map(m => byMethod.get(m)!);
  // Never leave an account with no way back in.
  const unlinkable = rows.length >= 2;
  return rows.map(r => ({ ...r, canUnlink: unlinkable && r.identity !== null }));
}

/** Methods the runner can still add. Apple linking needs the native iOS flow. */
export function linkableMethods(linked: LinkedMethod[], platform: 'ios' | 'android' | 'web' | string): SignInMethod[] {
  const have = new Set(linked.map(l => l.method));
  const out: SignInMethod[] = [];
  if (!have.has('apple') && platform === 'ios') out.push('apple');
  if (!have.has('google')) out.push('google');
  if (!have.has('phone')) out.push('phone');
  return out;
}

/** Why an unlink button is disabled, or null when it's allowed. */
export function unlinkBlockReason(row: LinkedMethod, all: LinkedMethod[]): string | null {
  if (all.length < 2) return 'This is your only way to sign in. Add another before removing it.';
  if (!row.identity) return row.method === 'phone'
    ? 'Your phone number stays as a way to sign in.'
    : 'This can’t be removed here.';
  return null;
}

/** Plain-language messages for linking failures from Supabase. */
export function linkErrorMessage(message: string | null | undefined): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('manual linking') || m.includes('linking is disabled')) return 'Linking isn’t switched on yet. Please try again later.';
  if (m.includes('already') && (m.includes('linked') || m.includes('exists') || m.includes('registered'))) {
    return 'That account is already used by another Runivo profile.';
  }
  if (m.includes('single identity') || m.includes('only identity') || m.includes('at least')) return 'Keep at least one way to sign in.';
  if (m.includes('rate') || m.includes('too many')) return 'Too many tries. Wait a minute and try again.';
  if (m.includes('token') && (m.includes('expired') || m.includes('invalid'))) return 'That code didn’t work. Ask for a new one.';
  return 'Something went wrong. Please try again.';
}
