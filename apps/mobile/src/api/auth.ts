import { apiGet } from './client';

export type CurrentUser = {
  displayName: string | null;
  id: string;
  provider: 'GOOGLE' | 'APPLE' | 'MICROSOFT';
};

export function getCurrentUser(firebaseIdToken: string): Promise<CurrentUser> {
  return apiGet<CurrentUser>('/auth/me', { token: firebaseIdToken });
}
