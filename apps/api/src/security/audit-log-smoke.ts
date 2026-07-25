import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { BlocksService } from '../blocks/blocks.service';
import { PrismaService } from '../database/prisma.service';
import { AuditAction, AuthProvider } from '../generated/prisma/enums';
import { ProfileService } from '../profile/profile.service';

async function main() {
  const runId = Date.now();
  const actorIdentity = createIdentity(`__audit_smoke_actor_${runId}`);
  const targetIdentity = createIdentity(`__audit_smoke_target_${runId}`);
  const config = new ConfigService(process.env);
  const prisma = new PrismaService(config);
  const auth = new AuthService(prisma);
  const profile = new ProfileService(auth, config, prisma);
  const blocks = new BlocksService(auth, prisma);
  let userIds: string[] = [];

  try {
    const actor = await auth.getOrCreateUser(actorIdentity);
    const target = await auth.getOrCreateUser(targetIdentity);
    userIds = [actor.id, target.id];

    await profile.updatePrivacy(actorIdentity, { profileVisibility: 'private' });
    await blocks.blockUser(actorIdentity, target.id);
    await blocks.unblockUser(actorIdentity, target.id);

    const auditLogs = await prisma.auditLog.findMany({
      orderBy: {
        createdAt: 'asc',
      },
      where: {
        actorUserId: actor.id,
      },
    });

    const privacyLog = auditLogs.find((log) => log.action === AuditAction.PRIVACY_UPDATED);
    const blockLog = auditLogs.find((log) => log.action === AuditAction.USER_BLOCKED);
    const unblockLog = auditLogs.find((log) => log.action === AuditAction.USER_UNBLOCKED);
    const changedFields = getChangedFields(privacyLog?.metadata);

    assert(Boolean(privacyLog), 'Privacy update audit log was not created.');
    assert(
      changedFields.includes('profileVisibility') &&
        changedFields.includes('reviewsVisibility') &&
        changedFields.includes('ratingsVisibility') &&
        changedFields.includes('viewingHistoryVisibility') &&
        changedFields.includes('episodeProgressVisibility'),
      'Privacy audit log must include every field controlled by profile visibility.',
    );
    assert(blockLog?.targetUserId === target.id, 'Block audit log must target the blocked user.');
    assert(
      unblockLog?.targetUserId === target.id,
      'Unblock audit log must target the unblocked user.',
    );

    console.log('Audit log smoke passed.');
  } finally {
    await cleanup(prisma, userIds);
    await prisma.$disconnect();
  }
}

function createIdentity(providerUserId: string): AuthenticatedIdentity {
  return {
    displayName: 'Audit smoke user',
    provider: AuthProvider.GOOGLE,
    providerUserId,
  };
}

function getChangedFields(metadata: unknown) {
  if (
    typeof metadata === 'object' &&
    metadata !== null &&
    'changedFields' in metadata &&
    Array.isArray(metadata.changedFields)
  ) {
    return metadata.changedFields;
  }

  return [];
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function cleanup(prisma: PrismaService, userIds: string[]) {
  if (userIds.length === 0) {
    return;
  }

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        {
          actorUserId: {
            in: userIds,
          },
        },
        {
          targetUserId: {
            in: userIds,
          },
        },
      ],
    },
  });

  await prisma.user.deleteMany({
    where: {
      id: {
        in: userIds,
      },
    },
  });
}

void main();
