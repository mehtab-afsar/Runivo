import { signIn as sharedSignIn, signUp as sharedSignUp, resetPassword as sharedResetPassword } from '@shared/services/auth';

export async function signIn(email: string, password: string): Promise<void> {
  await sharedSignIn(email, password);
}

export async function signUp(email: string, password: string, username: string): Promise<void> {
  await sharedSignUp(email, password, username);
}

export async function resetPassword(email: string): Promise<void> {
  await sharedResetPassword(email);
}
