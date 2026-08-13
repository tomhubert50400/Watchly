import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { AuthenticatedIdentity } from './auth.types';
import { PrismaService } from '../database/prisma.service';
import { isAccountSuspended } from '../moderation/account-suspension';

@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async assertActiveIdentity(identity: AuthenticatedIdentity) {
    const authIdentity = await this.prisma.withConnectionRetry(() =>
      this.prisma.authIdentity.findUnique({
        select: {
          user: {
            select: {
              suspendedAt: true,
              suspendedUntil: true,
            },
          },
        },
        where: {
          provider_providerUserId: {
            provider: identity.provider,
            providerUserId: identity.providerUserId,
          },
        },
      }),
    );

    if (authIdentity && isAccountSuspended(authIdentity.user)) {
      const suspendedUntil = authIdentity.user.suspendedUntil?.toISOString() ?? null;

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
    return this.prisma.withConnectionRetry(async () => {
      const existingIdentity = await this.prisma.authIdentity.findUnique({
        include: {
          user: true,
        },
        where: {
          provider_providerUserId: {
            provider: identity.provider,
            providerUserId: identity.providerUserId,
          },
        },
      });

      if (existingIdentity) {
        if (identity.email && identity.email !== existingIdentity.email) {
          await this.prisma.authIdentity.update({
            data: { email: identity.email },
            where: { id: existingIdentity.id },
          });
        }

        return {
          id: existingIdentity.user.id,
          displayName: existingIdentity.user.displayName,
          handle: existingIdentity.user.handle,
          onboardingCompleted: existingIdentity.user.onboardingCompleted,
          provider: existingIdentity.provider,
        };
      }

      const user = await this.prisma.user.create({
        data: {
          authIdentities: {
            create: {
              provider: identity.provider,
              providerUserId: identity.providerUserId,
              email: identity.email,
            },
          },
          displayName: identity.displayName,
          privacySettings: {
            create: {},
          },
        },
      });

      return {
        id: user.id,
        displayName: user.displayName,
        handle: user.handle,
        onboardingCompleted: user.onboardingCompleted,
        provider: identity.provider,
      };
    });
  }
}
