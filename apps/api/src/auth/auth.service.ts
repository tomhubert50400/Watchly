import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { AuthenticatedIdentity } from './auth.types';
import { PrismaService } from '../database/prisma.service';

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

    if (authIdentity?.user.suspendedAt) {
      throw new ForbiddenException('This account is suspended.');
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
