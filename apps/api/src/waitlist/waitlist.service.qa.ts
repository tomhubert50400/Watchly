import assert from 'node:assert/strict';
import { WaitlistService } from './waitlist.service';

async function run() {
  const upserts: unknown[] = [];
  const prisma = {
    waitlistSubscriber: {
      upsert: async (args: unknown) => {
        upserts.push(args);
        return { id: 'subscriber-1' };
      },
    },
    withConnectionRetry: async <T>(operation: () => Promise<T>) => operation(),
  };
  const service = new WaitlistService(prisma as never);

  assert.deepEqual(
    await service.join({ email: '  Viewer+Watchly@Example.COM  ' }),
    { status: 'joined' },
  );
  assert.deepEqual(upserts[0], {
    create: { emailNormalized: 'viewer+watchly@example.com' },
    update: {},
    where: { emailNormalized: 'viewer+watchly@example.com' },
  });

  assert.deepEqual(
    await service.join({ email: 'bot@example.com', website: 'https://spam.example' }),
    { status: 'joined' },
  );
  assert.equal(upserts.length, 1, 'honeypot submissions must not reach the database');

  console.log('Waitlist API QA passed.');
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
