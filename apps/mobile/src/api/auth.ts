import { apiGet, apiPost } from './client';

export type CurrentUser = {
  displayName: string | null;
  handle: string | null;
  id: string;
  onboardingCompleted: boolean;
  photoUrl: string | null;
  provider: AuthProvider;
  providers: AuthProvider[];
};

export type AuthProvider = 'APPLE' | 'DEMO' | 'DISCORD' | 'GOOGLE' | 'MICROSOFT';

export function signInDemo(username: string, password: string) {
  return apiPost<{ firebaseCustomToken: string }>('/auth/demo/sign-in', { username, password });
}

export function getCurrentUser(firebaseIdToken: string): Promise<CurrentUser> {
  return apiGet<CurrentUser>('/auth/me', { token: firebaseIdToken });
}
