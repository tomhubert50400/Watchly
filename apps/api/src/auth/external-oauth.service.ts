import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getAuth } from 'firebase-admin/auth';
import { randomBytes } from 'node:crypto';
import { AuthenticatedIdentity } from './auth.types';
import { AuthService } from './auth.service';
import { initializeFirebaseAdmin } from './firebase-admin-app';
import { PrismaService } from '../database/prisma.service';
import { AuthProvider } from '../generated/prisma/enums';
import {
  buildExternalAuthorizationUrl,
  exchangeExternalAuthorizationCode,
  ExternalOAuthProvider,
  ExternalProviderIdentity,
  getExternalFirebaseUid,
  getDiscordMobileRedirectUri,
  getExternalProviderSettings,
  hashOAuthSecret,
  OAuthTicketProvider,
  toAuthProvider,
} from './external-oauth.provider';
import {
  getLegacyMicrosoftProviderUserId,
  verifyMicrosoftIdentity,
} from './microsoft-id-token';

const ATTEMPT_LIFETIME_MS = 10 * 60 * 1000;

@Injectable()
export class ExternalOAuthService {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {
    initializeFirebaseAdmin(
      config.getOrThrow<string>('FIREBASE_PROJECT_ID'),
      config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON'),
    );
  }

  async start(provider: ExternalOAuthProvider, initiatedByFirebaseUid?: string) {
    const runtime = this.getRuntimeConfig(provider);
    const state = createOpaqueSecret();
    const expiresAt = new Date(Date.now() + ATTEMPT_LIFETIME_MS);

    await this.prisma.withConnectionRetry(async () => {
      await this.prisma.oAuthAttempt.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      await this.prisma.oAuthAttempt.create({
        data: {
          appRedirectUri: runtime.appRedirectUri,
          expiresAt,
          initiatedByFirebaseUid,
          provider: toAuthProvider(provider),
          stateHash: hashOAuthSecret(state),
        },
      });
    });

    return {
      authorizationUrl: buildExternalAuthorizationUrl(runtime.providerSettings, runtime.callbackUrl, state),
      redirectUri: runtime.appRedirectUri,
    };
  }

  async completeAuthorization(
    provider: ExternalOAuthProvider,
    state: string | undefined,
    code: string | undefined,
    providerError: string | undefined,
  ) {
    const runtime = this.getRuntimeConfig(provider);

    if (!state) return addRedirectError(runtime.appRedirectUri, 'invalid_state');

    const attempt = await this.prisma.withConnectionRetry(() =>
      this.prisma.oAuthAttempt.findUnique({ where: { stateHash: hashOAuthSecret(state) } }),
    );

    if (
      !attempt
      || attempt.provider !== toAuthProvider(provider)
      || attempt.completedAt
      || attempt.consumedAt
      || attempt.expiresAt <= new Date()
    ) {
      return addRedirectError(runtime.appRedirectUri, 'invalid_state');
    }

    if (providerError || !code) {
      return addRedirectError(attempt.appRedirectUri, providerError ? 'access_denied' : 'missing_code');
    }

    let identity: ExternalProviderIdentity;

    try {
      identity = await exchangeExternalAuthorizationCode(
        this.config,
        provider,
        code,
        runtime.callbackUrl,
      );
    } catch {
      return addRedirectError(attempt.appRedirectUri, 'provider_unavailable');
    }
    const ticket = createOpaqueSecret();
    const completed = await this.prisma.withConnectionRetry(() =>
      this.prisma.oAuthAttempt.updateMany({
        data: {
          completionHash: hashOAuthSecret(ticket),
          completedAt: new Date(),
          displayName: identity.displayName,
          email: identity.email,
          emailVerified: identity.emailVerified,
          photoUrl: identity.photoUrl,
          providerUserId: identity.providerUserId,
        },
        where: {
          completedAt: null,
          consumedAt: null,
          expiresAt: { gt: new Date() },
          id: attempt.id,
        },
      }),
    );

    return completed.count === 1
      ? addRedirectTicket(attempt.appRedirectUri, ticket)
      : addRedirectError(attempt.appRedirectUri, 'invalid_state');
  }

  async completeMicrosoftToken(idToken: string, initiatedByFirebaseUid?: string) {
    const identity = await verifyMicrosoftIdentity(this.config, idToken);
    const ticket = createOpaqueSecret();
    const now = new Date();

    await this.prisma.withConnectionRetry(async () => {
      await this.prisma.oAuthAttempt.deleteMany({ where: { expiresAt: { lt: now } } });
      await this.prisma.oAuthAttempt.create({
        data: {
          appRedirectUri: 'microsoft-token://watchly',
          completedAt: now,
          completionHash: hashOAuthSecret(ticket),
          displayName: identity.displayName,
          email: identity.email,
          emailVerified: identity.emailVerified,
          expiresAt: new Date(now.getTime() + ATTEMPT_LIFETIME_MS),
          initiatedByFirebaseUid,
          photoUrl: identity.photoUrl,
          provider: identity.provider,
          providerUserId: identity.providerUserId,
          stateHash: hashOAuthSecret(createOpaqueSecret()),
        },
      });
    });

    return { ticket };
  }

  async completeDiscordMobileAuthorization(
    code: string,
    redirectUri: string,
    codeVerifier: string,
    initiatedByFirebaseUid?: string,
  ) {
    const settings = getExternalProviderSettings(this.config, 'discord');
    if (redirectUri !== getDiscordMobileRedirectUri(settings.clientId)) {
      throw new BadRequestException('The Discord mobile redirect URI is invalid.');
    }

    const identity = await exchangeExternalAuthorizationCode(
      this.config,
      'discord',
      code,
      redirectUri,
      codeVerifier,
    );
    const ticket = createOpaqueSecret();
    const now = new Date();

    await this.prisma.withConnectionRetry(async () => {
      await this.prisma.oAuthAttempt.deleteMany({ where: { expiresAt: { lt: now } } });
      await this.prisma.oAuthAttempt.create({
        data: {
          appRedirectUri: redirectUri,
          completedAt: now,
          completionHash: hashOAuthSecret(ticket),
          displayName: identity.displayName,
          email: identity.email,
          emailVerified: identity.emailVerified,
          expiresAt: new Date(now.getTime() + ATTEMPT_LIFETIME_MS),
          initiatedByFirebaseUid,
          photoUrl: identity.photoUrl,
          provider: identity.provider,
          providerUserId: identity.providerUserId,
          stateHash: hashOAuthSecret(`discord-mobile:${ticket}`),
        },
      });
    });

    return { ticket };
  }

  async exchange(ticket: string) {
    const attempt = await this.getCompletedAttempt(ticket);

    if (attempt.initiatedByFirebaseUid) {
      throw new BadRequestException('This OAuth ticket was created for account linking.');
    }

    const identity = toAuthenticatedIdentity(attempt, getExternalFirebaseUid(
      toExternalProvider(attempt.provider),
      attempt.providerUserId,
    ));
    const existingIdentity = await this.prisma.withConnectionRetry(async () => {
      const exactIdentity = await this.prisma.authIdentity.findUnique({
        select: { user: { select: { firebaseUid: true } } },
        where: {
          provider_providerUserId: {
            provider: attempt.provider,
            providerUserId: attempt.providerUserId,
          },
        },
      });
      const legacyProviderUserId = attempt.provider === AuthProvider.MICROSOFT
        ? getLegacyMicrosoftProviderUserId(attempt.providerUserId)
        : null;

      return exactIdentity ?? (legacyProviderUserId
        ? this.prisma.authIdentity.findUnique({
            select: { user: { select: { firebaseUid: true } } },
            where: {
              provider_providerUserId: {
                provider: attempt.provider,
                providerUserId: legacyProviderUserId,
              },
            },
          })
        : null);
    });
    const firebaseUid = existingIdentity?.user.firebaseUid ?? identity.firebaseUid;

    await this.authService.getOrCreateUser({ ...identity, firebaseUid });

    const customToken = await getAuth().createCustomToken(
      firebaseUid,
      getCustomTokenClaims(identity),
    );
    await this.consumeAttempt(attempt.id);

    return { firebaseCustomToken: customToken };
  }

  async link(identity: AuthenticatedIdentity, ticket: string) {
    const attempt = await this.getCompletedAttempt(ticket);
    const legacyProviderUserId = attempt.provider === AuthProvider.MICROSOFT
      ? getLegacyMicrosoftProviderUserId(attempt.providerUserId)
      : null;

    if (
      attempt.initiatedByFirebaseUid
      && attempt.initiatedByFirebaseUid !== identity.firebaseUid
    ) {
      throw new BadRequestException('This OAuth ticket belongs to another sign-in session.');
    }

    await this.prisma.withConnectionRetry(() =>
      this.prisma.$transaction(async (transaction) => {
        const user = await transaction.user.findUnique({
          select: { id: true },
          where: { firebaseUid: identity.firebaseUid },
        });
        if (!user) throw new BadRequestException('The Watchly account no longer exists.');

        const exactProviderCollision = await transaction.authIdentity.findUnique({
          select: { userId: true },
          where: {
            provider_providerUserId: {
              provider: attempt.provider,
              providerUserId: attempt.providerUserId,
            },
          },
        });
        const providerCollision = exactProviderCollision ?? (legacyProviderUserId
          ? await transaction.authIdentity.findUnique({
              select: { userId: true },
              where: {
                provider_providerUserId: {
                  provider: attempt.provider,
                  providerUserId: legacyProviderUserId,
                },
              },
            })
          : null);
        if (providerCollision && providerCollision.userId !== user.id) {
          throw new ConflictException({
            code: 'PROVIDER_ALREADY_LINKED',
            message: 'This provider account is already linked to another Watchly account.',
          });
        }

        const linkedProvider = await transaction.authIdentity.findUnique({
          select: { providerUserId: true },
          where: {
            userId_provider: { provider: attempt.provider, userId: user.id },
          },
        });
        if (
          linkedProvider
          && linkedProvider.providerUserId !== attempt.providerUserId
          && linkedProvider.providerUserId !== legacyProviderUserId
        ) {
          throw new ConflictException({
            code: 'PROVIDER_ALREADY_LINKED',
            message: 'Another account from this provider is already linked to Watchly.',
          });
        }

        const emailNormalized = normalizeEmail(attempt.email);
        await transaction.authIdentity.upsert({
          create: {
            email: attempt.email,
            emailNormalized,
            provider: attempt.provider,
            providerUserId: attempt.providerUserId,
            userId: user.id,
          },
          update: {
            ...(attempt.email ? { email: attempt.email, emailNormalized } : {}),
            providerUserId: attempt.providerUserId,
          },
          where: {
            userId_provider: { provider: attempt.provider, userId: user.id },
          },
        });
        const consumed = await transaction.oAuthAttempt.updateMany({
          data: { consumedAt: new Date() },
          where: { consumedAt: null, expiresAt: { gt: new Date() }, id: attempt.id },
        });
        if (consumed.count !== 1) throw invalidTicket();
      }),
    );

    return { provider: attempt.provider };
  }

  private async consumeAttempt(id: string) {
    const consumed = await this.prisma.withConnectionRetry(() =>
      this.prisma.oAuthAttempt.updateMany({
        data: { consumedAt: new Date() },
        where: { consumedAt: null, expiresAt: { gt: new Date() }, id },
      }),
    );

    if (consumed.count !== 1) throw invalidTicket();
  }

  private async getCompletedAttempt(ticket: string) {
    if (!ticket || ticket.length > 256) throw invalidTicket();

    const attempt = await this.prisma.withConnectionRetry(() =>
      this.prisma.oAuthAttempt.findUnique({
        where: { completionHash: hashOAuthSecret(ticket) },
      }),
    );

    if (
      !attempt
      || !attempt.completedAt
      || attempt.consumedAt
      || attempt.expiresAt <= new Date()
      || !attempt.providerUserId
    ) {
      throw invalidTicket();
    }

    return { ...attempt, providerUserId: attempt.providerUserId };
  }

  private getRuntimeConfig(provider: ExternalOAuthProvider) {
    const appRedirectUri = this.config.get<string>('AUTH_APP_REDIRECT_URI')?.trim();
    const callbackBaseUrl = this.config.get<string>('AUTH_OAUTH_CALLBACK_BASE_URL')?.trim();

    if (!appRedirectUri || !callbackBaseUrl) {
      throw new ServiceUnavailableException('External sign-in is not configured yet.');
    }

    let appRedirect: URL;
    let callbackBase: URL;

    try {
      appRedirect = new URL(appRedirectUri);
      callbackBase = new URL(callbackBaseUrl);
    } catch {
      throw new ServiceUnavailableException('External sign-in is not configured correctly.');
    }

    if (appRedirect.protocol === 'http:' || appRedirect.protocol === 'https:') {
      throw new ServiceUnavailableException('External sign-in is not configured correctly.');
    }

    const environment = this.config.get<string>('APP_ENV')?.trim() || 'development';
    if (environment !== 'development' && callbackBase.protocol !== 'https:') {
      throw new ServiceUnavailableException('External sign-in is not configured correctly.');
    }

    const callbackUrl = new URL(`/auth/oauth/${provider}/callback`, callbackBase);

    return {
      appRedirectUri: appRedirect.toString(),
      callbackUrl: callbackUrl.toString(),
      providerSettings: getExternalProviderSettings(this.config, provider),
    };
  }
}

function toAuthenticatedIdentity(
  attempt: {
    displayName: string | null;
    email: string | null;
    emailVerified: boolean | null;
    photoUrl: string | null;
    provider: AuthProvider;
    providerUserId: string;
  },
  firebaseUid: string,
): AuthenticatedIdentity {
  return {
    displayName: attempt.displayName,
    email: attempt.email,
    emailVerified: attempt.emailVerified === true,
    firebaseUid,
    photoUrl: attempt.photoUrl,
    provider: attempt.provider,
    providerUserId: attempt.providerUserId,
  };
}

function getCustomTokenClaims(identity: AuthenticatedIdentity) {
  return {
    ...(identity.displayName ? { watchlyDisplayName: identity.displayName } : {}),
    ...(identity.email ? { watchlyEmail: identity.email } : {}),
    watchlyEmailVerified: identity.emailVerified,
    ...(identity.photoUrl ? { watchlyPhotoUrl: identity.photoUrl } : {}),
    watchlyProvider: identity.provider,
    watchlyProviderUserId: identity.providerUserId,
  };
}

function toExternalProvider(provider: AuthProvider): OAuthTicketProvider {
  if (provider === AuthProvider.DISCORD) return 'discord';
  if (provider === AuthProvider.MICROSOFT) return 'microsoft';

  throw invalidTicket();
}

function createOpaqueSecret() {
  return randomBytes(32).toString('base64url');
}

function addRedirectTicket(redirectUri: string, ticket: string) {
  const url = new URL(redirectUri);
  url.searchParams.set('ticket', ticket);
  return url.toString();
}

function addRedirectError(redirectUri: string, error: string) {
  const url = new URL(redirectUri);
  url.searchParams.set('error', error);
  return url.toString();
}

function normalizeEmail(email: string | null) {
  return email?.trim().toLowerCase() || null;
}

function invalidTicket() {
  return new BadRequestException('This OAuth ticket is invalid or expired.');
}
