import assert from 'node:assert/strict';
import { ConflictException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';

type StoredUser = {
  displayName: string | null;
  firebaseUid: string;
  handle: string | null;
  id: string;
  onboardingCompleted: boolean;
};

type StoredIdentity = {
  email: string | null;
  emailNormalized: string | null;
  provider: string;
  providerUserId: string;
  userId: string;
};

async function main() {
  const users: StoredUser[] = [];
  const identities: StoredIdentity[] = [];
  const transaction = createTransaction(users, identities);
  const prisma = {
    $transaction: async (operation: (client: typeof transaction) => Promise<unknown>) =>
      operation(transaction),
    withConnectionRetry: async (operation: () => Promise<unknown>) => operation(),
  };
  const service = new AuthService(prisma as never);
  const googleIdentity = {
    displayName: 'Watchly user',
    email: 'Person@Example.com ',
    emailVerified: true,
    firebaseUid: 'firebase-user-1',
    photoUrl: null,
    provider: 'GOOGLE',
    providerUserId: 'google-subject-1',
  };

  const created = await service.getOrCreateUser(googleIdentity as never);
  const linked = await service.getOrCreateUser({
    ...googleIdentity,
    linkedProviders: [
      { provider: 'GOOGLE', providerUserId: 'google-subject-1' },
      { provider: 'APPLE', providerUserId: 'apple-subject-1' },
    ],
    provider: 'APPLE',
    providerUserId: 'apple-subject-1',
  } as never);

  assert.equal(created.id, linked.id, 'linked providers must resolve to the same Watchly user');
  assert.equal(users.length, 1, 'a linked provider must not create a second Watchly user');
  assert.deepEqual(
    identities.map(({ provider }) => provider).sort(),
    ['APPLE', 'GOOGLE'],
  );
  assert.deepEqual(linked.providers, ['APPLE', 'GOOGLE']);
  assert.equal(identities[0]?.emailNormalized, 'person@example.com');

  const collision = await service.getOrCreateUser({
    ...googleIdentity,
    email: 'person@example.com',
    firebaseUid: 'firebase-user-2',
    provider: 'DISCORD',
    providerUserId: 'discord-subject-2',
  } as never).then(
    () => null,
    (error: unknown) => error,
  );

  assert(collision instanceof ConflictException);
  assert.deepEqual(collision.getResponse(), {
    code: 'ACCOUNT_LINK_REQUIRED',
    existingProviders: ['APPLE', 'GOOGLE'],
    message: 'A Watchly account already uses this provider email. Sign in with an existing provider to link this one.',
  });
  assert.equal(users.length, 1, 'an email collision must not create a second Watchly user');

  console.log('Auth identity QA passed.');
}

function createTransaction(users: StoredUser[], identities: StoredIdentity[]) {
  return {
    authIdentity: {
      findFirst: async ({ where }: { where: { emailNormalized: string; user: { firebaseUid: { not: string } } } }) => {
        const identity = identities.find((candidate) =>
          candidate.emailNormalized === where.emailNormalized &&
          users.find((user) => user.id === candidate.userId)?.firebaseUid !== where.user.firebaseUid.not,
        );

        return identity ? withUser(identity, users, identities) : null;
      },
      findMany: async ({ where }: { where: { userId: string } }) =>
        identities
          .filter((identity) => identity.userId === where.userId)
          .map(({ provider }) => ({ provider })),
      findUnique: async ({ where }: { where: { provider_providerUserId: { provider: string; providerUserId: string } } }) => {
        const key = where.provider_providerUserId;
        const identity = identities.find((candidate) =>
          candidate.provider === key.provider && candidate.providerUserId === key.providerUserId,
        );

        return identity ? withUser(identity, users, identities) : null;
      },
      upsert: async ({ create, update, where }: {
        create: StoredIdentity;
        update: Pick<StoredIdentity, 'email' | 'emailNormalized' | 'providerUserId'>;
        where: { userId_provider: { provider: string; userId: string } };
      }) => {
        const key = where.userId_provider;
        const existing = identities.find((identity) =>
          identity.userId === key.userId && identity.provider === key.provider,
        );

        if (existing) {
          Object.assign(existing, update);
          return existing;
        }

        identities.push(create);
        return create;
      },
    },
    user: {
      upsert: async ({ create, where }: { create: StoredUser; where: { firebaseUid: string } }) => {
        const existing = users.find((user) => user.firebaseUid === where.firebaseUid);

        if (existing) return existing;

        const created = {
          ...create,
          handle: null,
          id: `user-${users.length + 1}`,
          onboardingCompleted: false,
        };
        users.push(created);
        return created;
      },
    },
  };
}

function withUser(identity: StoredIdentity, users: StoredUser[], identities: StoredIdentity[]) {
  const user = users.find((candidate) => candidate.id === identity.userId);

  if (!user) throw new Error('Auth identity QA fixture is inconsistent.');

  return {
    ...identity,
    user: {
      ...user,
      authIdentities: identities
        .filter((candidate) => candidate.userId === user.id)
        .map(({ provider }) => ({ provider })),
    },
  };
}

void main();
