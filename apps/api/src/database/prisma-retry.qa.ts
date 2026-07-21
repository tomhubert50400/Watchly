import assert from 'node:assert/strict';
import { isPrismaConnectionError } from './prisma-retry';

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
  isPrismaConnectionError({ message: 'Voting candidates must belong to this shared watchlist.' }),
  false,
  'validation failures must not be retried as connection errors',
);

console.log('Prisma retry QA passed.');
