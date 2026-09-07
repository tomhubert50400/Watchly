import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getAuth } from 'firebase-admin/auth';
import { AuthProvider } from '../generated/prisma/enums';
import { AuthService } from './auth.service';
import { DEMO_FIREBASE_UID, verifyDemoPassword } from './demo-credentials';

@Injectable()
export class DemoAuthService {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  async signIn(body: Record<string, unknown>) {
    const username = this.config.get<string>('DEMO_AUTH_USERNAME');
    const passwordHash = this.config.get<string>('DEMO_AUTH_PASSWORD_HASH');
    const invalid = () => new UnauthorizedException('Demo access is unavailable or the credentials are incorrect.');
    if (!username || !passwordHash || typeof body?.username !== 'string'
      || typeof body?.password !== 'string' || body.username.length > 128
      || body.password.length > 256 || !body.password.length) throw invalid();

    const validPassword = await verifyDemoPassword(body.password, passwordHash);
    if (!validPassword || body.username.trim() !== username) throw invalid();

    const account = await getAuth().getUser(DEMO_FIREBASE_UID).catch((error: unknown) => {
      if ((error as { code?: string }).code === 'auth/user-not-found') throw invalid();
      throw error;
    });
    if (account.disabled || account.customClaims?.watchlyDemo !== true
      || account.customClaims?.admin === true) throw invalid();

    const identity = {
      displayName: account.displayName ?? 'Watchly Review',
      emailVerified: false,
      firebaseUid: DEMO_FIREBASE_UID,
      provider: AuthProvider.DEMO,
      providerUserId: DEMO_FIREBASE_UID,
    };
    await this.authService.assertActiveIdentity(identity);
    await this.authService.getOrCreateUser(identity);
    const firebaseCustomToken = await getAuth().createCustomToken(DEMO_FIREBASE_UID, {
      watchlyDemo: true,
      watchlyDisplayName: identity.displayName,
      watchlyEmailVerified: false,
      watchlyProvider: AuthProvider.DEMO,
      watchlyProviderUserId: DEMO_FIREBASE_UID,
    });
    return { firebaseCustomToken };
  }
}
