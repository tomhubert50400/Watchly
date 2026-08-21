import { CurrentUser } from './auth';
import { apiPost } from './client';

export type ExternalAuthProvider = 'discord';
export type OAuthTicketProvider = ExternalAuthProvider | 'microsoft';

export function startExternalOAuth(provider: ExternalAuthProvider, firebaseIdToken?: string) {
  return apiPost<{ authorizationUrl: string; redirectUri: string }>(
    `/auth/oauth/${provider}/start`,
    {},
    { token: firebaseIdToken },
  );
}

export function exchangeExternalOAuth(ticket: string) {
  return apiPost<{ firebaseCustomToken: string }>('/auth/oauth/exchange', { ticket });
}

export function createMicrosoftOAuthTicket(
  idToken: string,
  firebaseIdToken?: string,
) {
  return apiPost<{ ticket: string }>(
    '/auth/oauth/microsoft/token',
    { idToken },
    { token: firebaseIdToken },
  );
}

export function linkExternalOAuth(ticket: string, firebaseIdToken: string) {
  return apiPost<CurrentUser>('/auth/oauth/link', { ticket }, { token: firebaseIdToken });
}
