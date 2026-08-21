import * as WebBrowser from 'expo-web-browser';
import {
  createDiscordMobileOAuthTicket,
  ExternalAuthProvider,
  startExternalOAuth,
} from '../api/externalAuth';
import {
  requestNativeDiscordAuthorization,
  shouldUseNativeDiscordAuthorization,
} from './discordNativeAuth';

export async function requestExternalOAuthTicket(
  provider: ExternalAuthProvider,
  firebaseIdToken?: string,
) {
  if (provider === 'discord' && shouldUseNativeDiscordAuthorization()) {
    const authorization = await requestNativeDiscordAuthorization();
    const { ticket } = await createDiscordMobileOAuthTicket(authorization, firebaseIdToken);
    return ticket;
  }

  const flow = await startExternalOAuth(provider, firebaseIdToken);
  const result = await WebBrowser.openAuthSessionAsync(flow.authorizationUrl, flow.redirectUri);

  if (result.type === 'cancel' || result.type === 'dismiss') return null;
  if (result.type !== 'success') throw new Error(`${providerName(provider)} sign-in was interrupted.`);

  const callback = new URL(result.url);
  const providerError = callback.searchParams.get('error');
  if (providerError) {
    throw new Error(
      providerError === 'access_denied'
        ? `${providerName(provider)} sign-in was cancelled.`
        : `${providerName(provider)} sign-in could not be completed.`,
    );
  }

  const ticket = callback.searchParams.get('ticket');
  if (!ticket) throw new Error(`${providerName(provider)} did not return a Watchly ticket.`);

  return ticket;
}

export function providerName(provider: ExternalAuthProvider) {
  switch (provider) {
    case 'discord':
      return 'Discord';
  }
}
