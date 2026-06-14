import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { AuthProvider } from '../generated/prisma/enums';
import { ProfileService } from '../profile/profile.service';

async function main() {
  const identity = createIdentity(`__onboarding_smoke_${Date.now()}`);
  const config = new ConfigService(process.env);
  const prisma = new PrismaService(config);
  const auth = new AuthService(prisma);
  const profile = new ProfileService(auth, config, prisma);
  let userId: string | null = null;

  try {
    const created = await auth.getOrCreateUser(identity);
    userId = created.id;

    assert(created.onboardingCompleted === false, 'New users should start onboarding incomplete.');

    const completed = await profile.completeOnboarding(identity);

    assert(completed.onboardingCompleted === true, 'Completion route should mark onboarding complete.');

    const reloaded = await auth.getOrCreateUser(identity);

    assert(reloaded.onboardingCompleted === true, 'Auth user should expose completed onboarding.');

    console.log('Onboarding smoke passed.');
  } finally {
    await cleanup(prisma, userId);
    await prisma.$disconnect();
  }
}

function createIdentity(providerUserId: string): AuthenticatedIdentity {
  return {
    displayName: 'Onboarding smoke user',
    provider: AuthProvider.GOOGLE,
    providerUserId,
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function cleanup(prisma: PrismaService, userId: string | null) {
  if (!userId) {
    return;
  }

  await prisma.auditLog.deleteMany({
    where: {
      actorUserId: userId,
    },
  });

  await prisma.user.delete({
    where: {
      id: userId,
    },
  });
}

void main();
