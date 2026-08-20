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

  const allowPasswordProvider = options.allowPasswordProvider === true;
  const provider = resolveFirebaseProvider(decodedToken, allowPasswordProvider);

  if (!provider) {
    throw new UnauthorizedException('Auth provider is not allowed.');
  }

  const providerUserId = getProviderUserId(decodedToken, provider);
  const customProvider = decodedToken.firebase.sign_in_provider === 'custom';

  return {
    displayName: getStringClaim(decodedToken, customProvider ? 'watchlyDisplayName' : 'name'),
    email: getStringClaim(decodedToken, customProvider ? 'watchlyEmail' : 'email'),
    emailVerified: customProvider
      ? decodedToken.watchlyEmailVerified === true
      : decodedToken.email_verified === true,
    firebaseUid: decodedToken.uid,
    linkedProviders: getLinkedProviderIdentities(
      decodedToken,
      allowPasswordProvider,
      provider,
      providerUserId,
    ),
    photoUrl: getStringClaim(decodedToken, customProvider ? 'watchlyPhotoUrl' : 'picture'),
    provider,
    providerUserId,
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

function getProviderUserId(decodedToken: DecodedIdToken, provider?: AuthProvider) {
  if (
    decodedToken.firebase.sign_in_provider === 'custom'
    && provider
    && typeof decodedToken.watchlyProviderUserId === 'string'
    && decodedToken.watchlyProviderUserId.length > 0
  ) {
    return decodedToken.watchlyProviderUserId;
  }

  const signInProvider = decodedToken.firebase.sign_in_provider;
  const providerIdentities = decodedToken.firebase.identities?.[signInProvider];
  const providerUserId = Array.isArray(providerIdentities) ? providerIdentities[0] : undefined;

  return typeof providerUserId === 'string' && providerUserId.length > 0
    ? providerUserId
    : decodedToken.uid;
}

function getLinkedProviderIdentities(
  decodedToken: DecodedIdToken,
  allowPasswordProvider: boolean,
  activeProvider: AuthProvider,
  activeProviderUserId: string,
) {
  const identities = new Map<AuthProvider, string>();

  for (const [firebaseProvider, providerUserIds] of Object.entries(
    decodedToken.firebase.identities ?? {},
  )) {
    const provider = mapFirebaseProvider(firebaseProvider, allowPasswordProvider);
    const providerUserId = Array.isArray(providerUserIds) ? providerUserIds[0] : undefined;

    if (provider && typeof providerUserId === 'string' && providerUserId.length > 0) {
      identities.set(provider, providerUserId);
    }
  }

  identities.set(activeProvider, activeProviderUserId);

  return [...identities].map(([provider, providerUserId]) => ({ provider, providerUserId }));
}

function resolveFirebaseProvider(
  decodedToken: DecodedIdToken,
  allowPasswordProvider: boolean,
) {
  const firebaseProvider = mapFirebaseProvider(
    decodedToken.firebase.sign_in_provider,
    allowPasswordProvider,
  );

  if (firebaseProvider) return firebaseProvider;
  if (decodedToken.firebase.sign_in_provider !== 'custom') return null;

  return decodedToken.watchlyProvider === AuthProvider.DISCORD
    ? AuthProvider.DISCORD
    : null;
}

function getStringClaim(decodedToken: DecodedIdToken, key: string) {
  const value = decodedToken[key];

  return typeof value === 'string' ? value : null;
}
