import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { isPrismaConnectionError, registerPrismaPoolErrorHandler } from './prisma-retry';

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

console.log('Prisma retry QA passed.');
