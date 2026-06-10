import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getApps, initializeApp } from 'firebase-admin/app';
import { DecodedIdToken, getAuth } from 'firebase-admin/auth';
import { AuthProvider } from '../generated/prisma/enums';
import { AuthenticatedIdentity } from './auth.types';

@Injectable()
export class FirebaseTokenVerifier {
  constructor(@Inject(ConfigService) config: ConfigService) {
    if (getApps().length === 0) {
      initializeApp({
        projectId: config.getOrThrow<string>('FIREBASE_PROJECT_ID'),
      });
    }
  }

  async verifyBearerToken(token: string): Promise<AuthenticatedIdentity> {
    let decodedToken: DecodedIdToken;

    try {
      decodedToken = await getAuth().verifyIdToken(token);
    } catch {
      throw new UnauthorizedException('Invalid auth token.');
    }

    const provider = mapFirebaseProvider(decodedToken.firebase.sign_in_provider);

    if (!provider) {
      throw new UnauthorizedException('Auth provider is not allowed.');
    }

    return {
      displayName: typeof decodedToken.name === 'string' ? decodedToken.name : null,
      provider,
      providerUserId: decodedToken.uid,
    };
  }
}

function mapFirebaseProvider(signInProvider: string): AuthProvider | null {
  switch (signInProvider) {
    case 'google.com':
      return AuthProvider.GOOGLE;
    case 'apple.com':
      return AuthProvider.APPLE;
    case 'microsoft.com':
      return AuthProvider.MICROSOFT;
    default:
      return null;
  }
}
