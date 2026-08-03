import { signIn as sharedSignIn, signUp as sharedSignUp, resetPassword as sharedResetPassword } from '@shared/services/auth';

export async function signIn(email: string, password: string, captchaToken?: string): Promise<void> {
  await sharedSignIn(email, password, captchaToken);
}

// Returns whether the account needs email confirmation before it can sign in
// (Supabase returns session: null in that case — App.tsx's auth listener never
// fires and the screen would otherwise sit there with a stopped spinner and no
// explanation).
export async function signUp(email: string, password: string, username: string): Promise<{ needsEmailConfirmation: boolean }> {
  const data = await sharedSignUp(email, password, username);
  return { needsEmailConfirmation: data.session === null };
}

export async function resetPassword(email: string): Promise<void> {
  await sharedResetPassword(email);
}
