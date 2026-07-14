// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
import { createAuthTransitionGuard, performGuaranteedSignOut } from './authTransition';

async function run() {
  const guard = createAuthTransitionGuard();
  const applied: string[] = [];
  let releaseA!: () => void;
  const waitForA = new Promise<void>((resolve) => { releaseA = resolve; });

  const transitionA = guard.begin();
  const pendingA = (async () => {
    await waitForA;
    if (guard.isCurrent(transitionA)) applied.push('A');
  })();

  const transitionB = guard.begin();
  await Promise.resolve();
  if (guard.isCurrent(transitionB)) applied.push('B');
  releaseA();
  await pendingA;

  assert.deepEqual(applied, ['B'], 'an older Firebase callback must not reinstall account A');

  const pendingSignIn = guard.begin();
  guard.invalidate();
  assert.equal(guard.isCurrent(pendingSignIn), false, 'sign-out must invalidate an in-flight sign-in');

  const pendingRefresh = guard.begin();
  const newerSignIn = guard.begin();
  assert.equal(guard.isCurrent(pendingRefresh), false, 'sign-in must invalidate prior auth work');
  assert.equal(guard.isCurrent(newerSignIn), true);

  const cleanupCalls: string[] = [];
  await assert.rejects(
    performGuaranteedSignOut('user-a', {
      clearPrivateCacheForUser: async (userId) => { cleanupCalls.push(userId); },
      signOutFromFirebase: async () => { throw new Error('firebase unavailable'); },
    }),
    /firebase unavailable/,
  );
  assert.deepEqual(cleanupCalls, ['user-a'], 'private cache cleanup must run when Firebase sign-out rejects');

  console.log('Auth transition QA passed.');
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});