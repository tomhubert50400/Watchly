import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getApps, initializeApp } from 'firebase-admin/app';
import { DecodedIdToken, getAuth } from 'firebase-admin/auth';
import { AuthProvider } from '../generated/prisma/enums';
import { AuthenticatedIdentity } from './auth.types';

@Injectable()
export class FirebaseTokenVerifier {
  private readonly allowEmulatorPasswordProvider: boolean;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.allowEmulatorPasswordProvider =
      config.get<string>('NODE_ENV') !== 'production' &&
      Boolean(config.get<string>('FIREBASE_AUTH_EMULATOR_HOST'));

    if (getApps().length === 0) {
      initializeApp({
        projectId: config.getOrThrow<string>('FIREBASE_PROJECT_ID'),
      });
    }
  }

  async verifyBearerToken(token: string): Promise<AuthenticatedIdentity> {
    return verifyBearerTokenWithAuth(getAuth(), token, {
      allowPasswordProvider: this.allowEmulatorPasswordProvider,
    });
  }
}

type FirebaseAuthVerifier = Pick<ReturnType<typeof getAuth>, 'verifyIdToken'>;

export async function verifyBearerTokenWithAuth(
  auth: FirebaseAuthVerifier,
  token: string,
  options: { allowPasswordProvider?: boolean } = {},
): Promise<AuthenticatedIdentity> {
  let decodedToken: DecodedIdToken;

  try {
    decodedToken = await verifyFirebaseIdToken(auth, token);
  } catch {
    throw new UnauthorizedException('Invalid auth token.');
  }

  const provider = mapFirebaseProvider(
    decodedToken.firebase.sign_in_provider,
    options.allowPasswordProvider === true,
  );

  if (!provider) {
    throw new UnauthorizedException('Auth provider is not allowed.');
  }

  return {
    displayName: typeof decodedToken.name === 'string' ? decodedToken.name : null,
    provider,
    providerUserId: decodedToken.uid,
  };
}

export function verifyFirebaseIdToken(auth: FirebaseAuthVerifier, token: string) {
  return auth.verifyIdToken(token, true);
}

function mapFirebaseProvider(
  signInProvider: string,
  allowPasswordProvider: boolean,
): AuthProvider | null {
  switch (signInProvider) {
    case 'google.com':
      return AuthProvider.GOOGLE;
    case 'apple.com':
      return AuthProvider.APPLE;
    case 'microsoft.com':
      return AuthProvider.MICROSOFT;
    case 'password':
      return allowPasswordProvider ? AuthProvider.GOOGLE : null;
    default:
      return null;
  }
}
