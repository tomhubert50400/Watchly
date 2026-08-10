import { apiGet } from './client';

export type CurrentUser = {
  displayName: string | null;
  handle: string | null;
  id: string;
  onboardingCompleted: boolean;
  provider: 'GOOGLE' | 'APPLE' | 'MICROSOFT';
};

export function getCurrentUser(firebaseIdToken: string): Promise<CurrentUser> {
  return apiGet<CurrentUser>('/auth/me', { token: firebaseIdToken });
}
