import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { isPrismaConnectionError, isPrismaTransactionConflict, registerPrismaPoolErrorHandler } from './prisma-retry';
import { PrismaService } from './prisma.service';

const pool = new EventEmitter();
const poolError = Object.assign(new Error('portal "" does not exist'), { code: '34000' });
let handledPoolError: Error | undefined;

registerPrismaPoolErrorHandler(pool, (error) => {
  handledPoolError = error;
});
pool.emit('error', poolError);

assert.equal(
  handledPoolError,
  poolError,
  'idle PostgreSQL client errors must be handled instead of crashing the API process',
);

assert.equal(
  isPrismaConnectionError({
    message: 'bind message supplies 4 parameters, but prepared statement "" requires 2',
  }),
  true,
  'prepared statement protocol mismatches must reset the Prisma connection before retrying',
);
assert.equal(
  isPrismaConnectionError({
    meta: {
      driverAdapterError: {
        cause: {
          originalCode: '08P01',
        },
      },
    },
  }),
  true,
  'PostgreSQL protocol violations must reset the Prisma connection before retrying',
);
assert.equal(
  isPrismaConnectionError({ code: '34000', message: 'portal "" does not exist' }),
  true,
  'empty PostgreSQL portal failures must reset the Prisma connection before retrying',
);
assert.equal(
  isPrismaConnectionError({ message: 'Voting candidates must belong to this shared watchlist.' }),
  false,
  'validation failures must not be retried as connection errors',
);

async function verifyRetries() {
  const service = Object.create(PrismaService.prototype) as PrismaService;
  let resets = 0;
  service.resetConnection = async () => { resets += 1; };
  const delays: number[] = [];
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = ((callback: () => void, milliseconds: number) => {
    delays.push(milliseconds);
    callback();
  }) as unknown as typeof setTimeout;
  try {
    for (const conflict of [
      { code: 'P2034' },
      { code: '40P01' },
      { code: '40001' },
      { name: 'DriverAdapterError', cause: { originalCode: '40P01' } },
      { code: 'P2010', meta: { code: '40P01' } },
      { meta: { driverAdapterError: { cause: { originalCode: '40001' } } } },
    ]) {
      assert.equal(isPrismaTransactionConflict(conflict), true);
      let attempts = 0;
      delays.length = 0;
      const result = await service.withConnectionRetry(async () => {
        attempts += 1;
        if (attempts < 3) throw conflict;
        return 'committed';
      });
      assert.equal(result, 'committed');
      assert.equal(attempts, 3);
      assert.deepEqual(delays, [300, 600]);
      assert.equal(resets, 0, 'Transaction conflicts must retry without resetting a healthy pool');
    }

    let attempts = 0;
    const exhausted = { code: 'P2034' };
    await assert.rejects(service.withConnectionRetry(async () => {
      attempts += 1;
      throw exhausted;
    }), (error) => error === exhausted);
    assert.equal(attempts, 8, 'Transaction retries must stop at the existing retry budget');
    assert.equal(resets, 0);

    for (const failure of [null, 'deadlock detected', { code: 'P2002' }, new Error('Validation failed')]) {
      assert.equal(isPrismaTransactionConflict(failure), false);
      attempts = 0;
      await assert.rejects(service.withConnectionRetry(async () => {
        attempts += 1;
        throw failure;
      }), (error) => error === failure);
      assert.equal(attempts, 1, 'Validation and uniqueness errors must not be retried');
    }

    attempts = 0;
    await service.withConnectionRetry(async () => {
      attempts += 1;
      if (attempts === 1) throw { code: 'P1017' };
    });
    assert.equal(attempts, 2);
    assert.equal(resets, 1, 'Connection failures must still reset the pool before retrying');
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
}

void verifyRetries().then(() => console.log('Prisma retry QA passed.')).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
