import { Inject, Injectable } from '@nestjs/common';
import { AuthenticatedIdentity } from './auth.types';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getOrCreateUser(identity: AuthenticatedIdentity) {
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
      provider: identity.provider,
    };
  }
}
