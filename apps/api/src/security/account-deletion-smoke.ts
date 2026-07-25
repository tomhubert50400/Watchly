import 'dotenv/config';
import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../database/prisma.service';
import { AuthProvider } from '../generated/prisma/enums';
import { ProfileService } from '../profile/profile.service';

async function main() {
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';

  const config = new ConfigService(process.env);
  const prisma = new PrismaService(config);
  const auth = new AuthService(prisma);
  const profile = new ProfileService(auth, config, prisma);
  const uid = `account-deletion-smoke-${Date.now()}`;
  const identity = {
    displayName: 'Deletion smoke user',
    provider: AuthProvider.GOOGLE,
    providerUserId: uid,
  };

  if (getApps().length === 0) {
    initializeApp({ projectId: config.getOrThrow<string>('FIREBASE_PROJECT_ID') });
  }

  try {
    await getAuth().createUser({ displayName: identity.displayName, uid });
    const user = await auth.getOrCreateUser(identity);
    await prisma.auditLog.create({
      data: {
        action: 'PRIVACY_UPDATED',
        actorUserId: user.id,
      },
    });

    await profile.deleteAccount(identity);

    assert.equal(
      await prisma.authIdentity.findUnique({
        where: {
          provider_providerUserId: {
            provider: identity.provider,
            providerUserId: identity.providerUserId,
          },
        },
      }),
      null,
      'account deletion should remove the database identity',
    );
    assert.equal(
      await prisma.auditLog.count({ where: { actorUserId: user.id } }),
      0,
      'account deletion should remove account-linked audit records',
    );

    const firebaseLookup = await getAuth().getUser(uid).then(
      () => 'found',
      (error: unknown) => (
        typeof error === 'object' && error !== null && 'code' in error ? error.code : 'error'
      ),
    );
    assert.equal(
      firebaseLookup,
      'auth/user-not-found',
      'account deletion should remove the Firebase sign-in identity',
    );

    console.log('Account deletion smoke passed.');
  } finally {
    const remainingIdentity = await prisma.authIdentity.findUnique({
      select: { userId: true },
      where: {
        provider_providerUserId: {
          provider: identity.provider,
          providerUserId: identity.providerUserId,
        },
      },
    });

    if (remainingIdentity) {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { actorUserId: remainingIdentity.userId },
            { targetUserId: remainingIdentity.userId },
          ],
        },
      });
      await prisma.user.delete({ where: { id: remainingIdentity.userId } });
    }

    await getAuth().deleteUser(uid).catch(() => undefined);
    await prisma.$disconnect();
  }
}

void main();
