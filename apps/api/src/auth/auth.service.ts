import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { AuthenticatedIdentity } from './auth.types';
import { PrismaService } from '../database/prisma.service';
import { isAccountSuspended } from '../moderation/account-suspension';

@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async assertActiveIdentity(identity: AuthenticatedIdentity) {
    const user = await this.prisma.withConnectionRetry(() =>
      this.prisma.user.findUnique({
        select: {
          suspendedAt: true,
          suspendedUntil: true,
        },
        where: { firebaseUid: identity.firebaseUid },
      }),
    );

    if (user && isAccountSuspended(user)) {
      const suspendedUntil = user.suspendedUntil?.toISOString() ?? null;

      throw new ForbiddenException({
        code: 'ACCOUNT_SUSPENDED',
        message: suspendedUntil
          ? `This account is suspended until ${suspendedUntil}.`
          : 'This account is permanently suspended. Contact Watchly support if you believe this is a mistake.',
        supportUrl: 'https://trywatchly.com/support',
        suspendedUntil,
      });
    }
  }

  async getOrCreateUser(identity: AuthenticatedIdentity) {
    const emailNormalized = normalizeProviderEmail(identity.email);

    return this.prisma.withConnectionRetry(() =>
      this.prisma.$transaction(async (transaction) => {
        const providerCollision = await transaction.authIdentity.findUnique({
          select: {
            user: {
              select: {
                authIdentities: { select: { provider: true } },
                firebaseUid: true,
              },
            },
          },
          where: {
            provider_providerUserId: {
              provider: identity.provider,
              providerUserId: identity.providerUserId,
            },
          },
        });

        if (providerCollision && providerCollision.user.firebaseUid !== identity.firebaseUid) {
          throwAccountLinkRequired(providerCollision.user.authIdentities);
        }

        if (emailNormalized && identity.emailVerified) {
          const emailCollision = await transaction.authIdentity.findFirst({
            select: {
              user: {
                select: {
                  authIdentities: { select: { provider: true } },
                },
              },
            },
            where: {
              emailNormalized,
              user: { firebaseUid: { not: identity.firebaseUid } },
            },
          });

          if (emailCollision) {
            throwAccountLinkRequired(emailCollision.user.authIdentities);
          }
        }

        const user = await transaction.user.upsert({
          create: {
            displayName: identity.displayName,
            firebaseUid: identity.firebaseUid,
            privacySettings: { create: {} },
          },
          select: {
            displayName: true,
            handle: true,
            id: true,
            onboardingCompleted: true,
          },
          update: {},
          where: { firebaseUid: identity.firebaseUid },
        });
        const emailUpdate = identity.email
          ? { email: identity.email, emailNormalized }
          : {};

        await transaction.authIdentity.upsert({
          create: {
            email: identity.email,
            emailNormalized,
            provider: identity.provider,
            providerUserId: identity.providerUserId,
            userId: user.id,
          },
          update: {
            ...emailUpdate,
            providerUserId: identity.providerUserId,
          },
          where: {
            userId_provider: {
              provider: identity.provider,
              userId: user.id,
            },
          },
        });

        const providers = await transaction.authIdentity.findMany({
          orderBy: { provider: 'asc' },
          select: { provider: true },
          where: { userId: user.id },
        });

        return {
          ...user,
          photoUrl: identity.photoUrl ?? null,
          provider: identity.provider,
          providers: providers.map(({ provider }) => provider).sort(),
        };
      }),
    );
  }
}

function normalizeProviderEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase();

  return normalized || null;
}

function throwAccountLinkRequired(identities: Array<{ provider: string }>): never {
  const existingProviders = [...new Set(identities.map(({ provider }) => provider))].sort();

  throw new ConflictException({
    code: 'ACCOUNT_LINK_REQUIRED',
    existingProviders,
    message: 'A Watchly account already uses this provider email. Sign in with an existing provider to link this one.',
  });
}
