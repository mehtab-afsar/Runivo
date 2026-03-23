import { signIn as sharedSignIn, signUp as sharedSignUp } from '@shared/services/auth';

export async function signIn(email: string, password: string): Promise<void> {
  await sharedSignIn(email, password);
}

export async function signUp(email: string, password: string, username: string): Promise<void> {
  await sharedSignUp(email, password, username);
}
