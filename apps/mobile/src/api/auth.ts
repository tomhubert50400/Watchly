import { apiGet } from './client';

export type CurrentUser = {
  displayName: string | null;
  handle: string | null;
  id: string;
  onboardingCompleted: boolean;
  photoUrl: string | null;
  provider: AuthProvider;
  providers: AuthProvider[];
};

export type AuthProvider = 'APPLE' | 'DISCORD' | 'GOOGLE' | 'MICROSOFT';

export function getCurrentUser(firebaseIdToken: string): Promise<CurrentUser> {
  return apiGet<CurrentUser>('/auth/me', { token: firebaseIdToken });
}
