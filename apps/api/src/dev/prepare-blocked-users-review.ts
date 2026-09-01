import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { AuthProvider, PrivacyVisibility } from '../generated/prisma/enums';

const BLOCKED_FIXTURE_COUNT = 21;
const FIXTURE_IDENTITY_PREFIX = '__blocked_users_review_';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  if (process.env.APP_ENV !== 'staging') {
    throw new Error('Blocked-users review fixtures can only run with APP_ENV=staging.');
  }

  if (process.argv.includes('--list-users')) {
    console.log(JSON.stringify(await listCandidateUsers(), null, 2));
    return;
  }

  if (process.argv.includes('--cleanup')) {
    const fixtureIdentities = await prisma.authIdentity.findMany({
      select: { userId: true },
      where: { providerUserId: { startsWith: FIXTURE_IDENTITY_PREFIX } },
    });
    const result = await prisma.user.deleteMany({
      where: { id: { in: fixtureIdentities.map((identity) => identity.userId) } },
    });

    console.log(JSON.stringify({ deletedFixtureUsers: result.count }, null, 2));
    return;
  }

  const target = await getTargetUser();
  const blockCandidate = await ensureFixtureUser({
    displayName: 'Block candidate',
    handle: 'block_candidate',
    identitySuffix: 'candidate',
  });

  await clearRelationships(target.id, blockCandidate.id);

  const blockedUsers = [];
  for (let index = 1; index <= BLOCKED_FIXTURE_COUNT; index += 1) {
    const paddedIndex = String(index).padStart(2, '0');
    const fixture = await ensureFixtureUser({
      displayName: `Blocked tester ${paddedIndex}`,
      handle: `blocked_test_${paddedIndex}`,
      identitySuffix: `blocked_${paddedIndex}`,
    });

    await clearRelationships(target.id, fixture.id);
    await prisma.userBlock.create({
      data: {
        blockedUserId: fixture.id,
        blockerId: target.id,
      },
    });
    blockedUsers.push(fixture);
  }

  console.log(JSON.stringify({
    blockCandidate: {
      displayName: blockCandidate.displayName,
      handle: blockCandidate.handle,
      userId: blockCandidate.id,
    },
    blockedFixtureCount: blockedUsers.length,
    target: {
      displayName: target.displayName,
      handle: target.handle,
      userId: target.id,
    },
  }, null, 2));
}

async function getTargetUser() {
  const explicitUserId = process.env.BLOCKED_USERS_REVIEW_USER_ID?.trim();
  if (explicitUserId) {
    const user = await prisma.user.findUnique({
      select: { displayName: true, handle: true, id: true },
      where: { id: explicitUserId },
    });

    if (!user) throw new Error('BLOCKED_USERS_REVIEW_USER_ID does not match a staging user.');
    return user;
  }

  const users = await listCandidateUsers();
  if (users.length !== 1) {
    throw new Error(
      `Found ${users.length} candidate staging users. Set BLOCKED_USERS_REVIEW_USER_ID explicitly.`,
    );
  }

  return users[0]!;
}

function listCandidateUsers() {
  return prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: { displayName: true, handle: true, id: true },
    where: {
      authIdentities: {
        none: { providerUserId: { startsWith: FIXTURE_IDENTITY_PREFIX } },
      },
    },
  });
}

async function ensureFixtureUser({
  displayName,
  handle,
  identitySuffix,
}: {
  displayName: string;
  handle: string;
  identitySuffix: string;
}) {
  const providerUserId = `${FIXTURE_IDENTITY_PREFIX}${identitySuffix}__`;
  const existingIdentity = await prisma.authIdentity.findUnique({
    where: {
      provider_providerUserId: {
        provider: AuthProvider.GOOGLE,
        providerUserId,
      },
    },
  });
  const profileData = {
    displayName,
    handle,
    onboardingCompleted: true,
  };

  if (existingIdentity) {
    return prisma.user.update({
      data: {
        ...profileData,
        privacySettings: {
          upsert: {
            create: {
              profileVisibility: PrivacyVisibility.PUBLIC,
              reviewsVisibility: PrivacyVisibility.PUBLIC,
            },
            update: {
              profileVisibility: PrivacyVisibility.PUBLIC,
              reviewsVisibility: PrivacyVisibility.PUBLIC,
            },
          },
        },
      },
      where: { id: existingIdentity.userId },
    });
  }

  return prisma.user.create({
    data: {
      ...profileData,
      authIdentities: {
        create: {
          provider: AuthProvider.GOOGLE,
          providerUserId,
        },
      },
      firebaseUid: providerUserId,
      privacySettings: {
        create: {
          profileVisibility: PrivacyVisibility.PUBLIC,
          reviewsVisibility: PrivacyVisibility.PUBLIC,
        },
      },
    },
  });
}

async function clearRelationships(targetUserId: string, fixtureUserId: string) {
  await prisma.$transaction([
    prisma.userBlock.deleteMany({
      where: {
        OR: [
          { blockedUserId: fixtureUserId, blockerId: targetUserId },
          { blockedUserId: targetUserId, blockerId: fixtureUserId },
        ],
      },
    }),
    prisma.userFollow.deleteMany({
      where: {
        OR: [
          { followedUserId: fixtureUserId, followerId: targetUserId },
          { followedUserId: targetUserId, followerId: fixtureUserId },
        ],
      },
    }),
  ]);
}

void main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
