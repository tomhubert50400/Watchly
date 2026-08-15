import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DecodedIdToken, getAuth } from 'firebase-admin/auth';
import { AuthProvider } from '../generated/prisma/enums';
import { AuthenticatedAdmin, AuthenticatedIdentity } from './auth.types';
import { initializeFirebaseAdmin } from './firebase-admin-app';

@Injectable()
export class FirebaseTokenVerifier {
  private readonly allowEmulatorPasswordProvider: boolean;
  private readonly checkRevokedTokens: boolean;
  private readonly isAuthEmulator: boolean;

  constructor(@Inject(ConfigService) config: ConfigService) {
    const authEmulatorHost = config.get<string>('FIREBASE_AUTH_EMULATOR_HOST');

    this.isAuthEmulator = Boolean(authEmulatorHost);
    this.allowEmulatorPasswordProvider =
      config.get<string>('NODE_ENV') !== 'production' &&
      this.isAuthEmulator;
    this.checkRevokedTokens = shouldCheckFirebaseTokenRevocation(
      config.get<string>('NODE_ENV'),
      authEmulatorHost,
      config.get<string>('GOOGLE_APPLICATION_CREDENTIALS') ||
        config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON'),
    );

    initializeFirebaseAdmin(
      config.getOrThrow<string>('FIREBASE_PROJECT_ID'),
      config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON'),
    );
  }

  async verifyBearerToken(token: string): Promise<AuthenticatedIdentity> {
    return verifyBearerTokenWithAuth(getAuth(), token, {
      allowPasswordProvider: this.allowEmulatorPasswordProvider,
      checkRevoked: this.checkRevokedTokens,
    });
  }

  async verifyAdminBearerToken(token: string): Promise<AuthenticatedAdmin> {
    return verifyAdminBearerTokenWithAuth(getAuth(), token, !this.isAuthEmulator);
  }
}

type FirebaseAuthVerifier = Pick<ReturnType<typeof getAuth>, 'verifyIdToken'>;

export async function verifyBearerTokenWithAuth(
  auth: FirebaseAuthVerifier,
  token: string,
  options: { allowPasswordProvider?: boolean; checkRevoked?: boolean } = {},
): Promise<AuthenticatedIdentity> {
  let decodedToken: DecodedIdToken;

  try {
    decodedToken = await verifyFirebaseIdToken(auth, token, options.checkRevoked !== false);
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
    email: typeof decodedToken.email === 'string' ? decodedToken.email : null,
    photoUrl: typeof decodedToken.picture === 'string' ? decodedToken.picture : null,
    provider,
    providerUserId: decodedToken.uid,
  };
}

export async function verifyAdminBearerTokenWithAuth(
  auth: FirebaseAuthVerifier,
  token: string,
  checkRevoked = true,
): Promise<AuthenticatedAdmin> {
  let decodedToken: DecodedIdToken;

  try {
    decodedToken = await verifyFirebaseIdToken(auth, token, checkRevoked);
  } catch {
    throw new UnauthorizedException('Invalid auth token.');
  }

  if (decodedToken.admin !== true) {
    throw new ForbiddenException('Admin access is required.');
  }

  if (!decodedToken.email || decodedToken.email_verified !== true) {
    throw new ForbiddenException('A verified admin email is required.');
  }

  const secondFactor = decodedToken.firebase.sign_in_second_factor;

  if (!secondFactor) {
    throw new ForbiddenException('Multi-factor authentication is required.');
  }

  return {
    email: decodedToken.email,
    firebaseUid: decodedToken.uid,
    secondFactor,
  };
}

export function shouldCheckFirebaseTokenRevocation(
  nodeEnv: string | undefined,
  authEmulatorHost: string | undefined,
  adminCredentialSource: string | undefined,
) {
  if (authEmulatorHost) return false;

  return nodeEnv === 'production' || Boolean(adminCredentialSource);
}

export function verifyFirebaseIdToken(
  auth: FirebaseAuthVerifier,
  token: string,
  checkRevoked: boolean,
) {
  return auth.verifyIdToken(token, checkRevoked);
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
