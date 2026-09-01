import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { BlocksService } from './blocks.service';

async function run() {
  const blockerId = '11111111-1111-4111-8111-111111111111';
  const firstCreatedAt = new Date('2026-08-31T12:00:00.000Z');
  const secondCreatedAt = new Date('2026-08-30T12:00:00.000Z');
  const queryArgs: unknown[] = [];
  const pages = [
    [
      {
        blockedUser: {
          avatarObjectKey: 'avatars/22222222-2222-4222-8222-222222222222/photo.jpg',
          displayName: 'Maya Chen',
          handle: 'maya_chen',
          id: '22222222-2222-4222-8222-222222222222',
        },
        createdAt: firstCreatedAt,
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      },
      {
        blockedUser: {
          avatarObjectKey: null,
          displayName: null,
          handle: null,
          id: '33333333-3333-4333-8333-333333333333',
        },
        createdAt: secondCreatedAt,
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      },
      {
        blockedUser: {
          avatarObjectKey: null,
          displayName: 'Next page',
          handle: 'next_page',
          id: '44444444-4444-4444-8444-444444444444',
        },
        createdAt: new Date('2026-08-29T12:00:00.000Z'),
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      },
    ],
    [
      {
        blockedUser: {
          avatarObjectKey: null,
          displayName: 'Next page',
          handle: 'next_page',
          id: '44444444-4444-4444-8444-444444444444',
        },
        createdAt: new Date('2026-08-29T12:00:00.000Z'),
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      },
    ],
    [],
  ];
  const prisma = {
    userBlock: {
      findMany: async (args: unknown) => {
        queryArgs.push(args);
        return pages.shift() ?? [];
      },
    },
    withConnectionRetry: async (operation: () => Promise<unknown>) => operation(),
  };
  const service = new BlocksService(
    { getOrCreateUser: async () => ({ id: blockerId }) } as never,
    prisma as never,
    {
      getPublicUrl: (objectKey: string | null) => objectKey
        ? `https://images.watchly.test/${objectKey}`
        : null,
    } as never,
  );
  const identity = { providerUserId: 'viewer' } as never;

  const firstPage = await service.listBlockedUsers(identity, undefined, '2');

  assert.deepEqual(firstPage.items, [
    {
      avatarUrl: 'https://images.watchly.test/avatars/22222222-2222-4222-8222-222222222222/photo.jpg',
      blockedAt: firstCreatedAt.toISOString(),
      displayName: 'Maya Chen',
      handle: 'maya_chen',
      userId: '22222222-2222-4222-8222-222222222222',
    },
    {
      avatarUrl: null,
      blockedAt: secondCreatedAt.toISOString(),
      displayName: 'Watchly member',
      handle: null,
      userId: '33333333-3333-4333-8333-333333333333',
    },
  ]);
  assert.equal(typeof firstPage.nextCursor, 'string');
  if (!firstPage.nextCursor) throw new Error('The first page must include a cursor.');
  const nextCursor = firstPage.nextCursor;
  assert.ok(nextCursor.length > 0);
  assert.deepEqual(queryArgs[0], {
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      blockedUser: {
        select: {
          avatarObjectKey: true,
          displayName: true,
          handle: true,
          id: true,
        },
      },
      createdAt: true,
      id: true,
    },
    take: 3,
    where: { blockerId },
  });

  const secondPage = await service.listBlockedUsers(identity, nextCursor, '2');

  assert.equal(secondPage.items.length, 1);
  assert.equal(secondPage.nextCursor, null);
  assert.deepEqual((queryArgs[1] as { where: unknown }).where, {
    AND: [
      {
        OR: [
          { createdAt: { lt: secondCreatedAt } },
          { createdAt: secondCreatedAt, id: { lt: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } },
        ],
      },
    ],
    blockerId,
  });

  await service.listBlockedUsers(identity, undefined, '20', '  @MAYA  ');
  assert.deepEqual((queryArgs[2] as { where: unknown }).where, {
    AND: [
      {
        blockedUser: {
          OR: [
            { displayName: { contains: 'MAYA', mode: 'insensitive' } },
            { handle: { contains: 'MAYA', mode: 'insensitive' } },
          ],
        },
      },
    ],
    blockerId,
  });

  await assert.rejects(
    () => service.listBlockedUsers(identity, 'not-a-cursor', '20'),
    BadRequestException,
  );
  await assert.rejects(
    () => service.listBlockedUsers(identity, undefined, '0'),
    BadRequestException,
  );
  await assert.rejects(
    () => service.listBlockedUsers(identity, undefined, '51'),
    BadRequestException,
  );
  await assert.rejects(
    () => service.listBlockedUsers(identity, undefined, '20', 'x'.repeat(81)),
    BadRequestException,
  );

  console.log('Blocked users API QA passed.');
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
