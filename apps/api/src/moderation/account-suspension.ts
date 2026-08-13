import { Prisma } from '../generated/prisma/client';

export type AccountSuspensionState = {
  suspendedAt: Date | null;
  suspendedUntil: Date | null;
};

export function isAccountSuspended(
  account: AccountSuspensionState,
  now = new Date(),
) {
  return account.suspendedAt !== null &&
    (account.suspendedUntil === null || account.suspendedUntil > now);
}

export function activeAccountWhere(now = new Date()): Prisma.UserWhereInput {
  return {
    OR: [
      { suspendedAt: null },
      { suspendedUntil: { lte: now } },
    ],
  };
}

export function suspendedAccountWhere(now = new Date()): Prisma.UserWhereInput {
  return {
    suspendedAt: { not: null },
    OR: [
      { suspendedUntil: null },
      { suspendedUntil: { gt: now } },
    ],
  };
}
