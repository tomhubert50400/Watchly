// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { mock } from 'node:test';
import { createFavoriteOrderAutosave } from './favoriteOrderAutosave';

async function run() {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const autosave = createFavoriteOrderAutosave();
    const saved: string[] = [];
    const errors: unknown[] = [];
    const onError = (error: unknown) => { errors.push(error); };
    const save = (order: string) => async () => { saved.push(order); };

    autosave.schedule(save('first'), onError);
    mock.timers.tick(900);
    autosave.schedule(save('latest'), onError);
    mock.timers.tick(999);
    assert.deepEqual(saved, [], 'each drop restarts the one-second delay');
    mock.timers.tick(1);
    await Promise.resolve();
    assert.deepEqual(saved, ['latest'], 'rapid drops save only the latest order');

    let finishSlowSave = () => {};
    autosave.schedule(() => new Promise<void>((resolve) => {
      saved.push('slow');
      finishSlowSave = resolve;
    }), onError);
    mock.timers.tick(1000);
    autosave.schedule(save('superseded'), onError);
    mock.timers.tick(1000);
    autosave.schedule(save('after-close'), onError);
    assert.equal(autosave.flush(), undefined, 'closing never waits for a network request');
    assert.deepEqual(saved, ['latest', 'slow'], 'requests cannot overlap or finish out of order');
    finishSlowSave();
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(saved, ['latest', 'slow', 'after-close'], 'the last drop survives closing during a request');
    autosave.flush();
    mock.timers.tick(1000);
    assert.equal(saved.length, 3, 'closing again does not duplicate a save');

    autosave.schedule(save('close-before-delay'), onError);
    autosave.flush();
    await Promise.resolve();
    assert.equal(saved.at(-1), 'close-before-delay', 'leaving immediately flushes the pending order');

    autosave.schedule(() => new Promise<void>((resolve) => {
      finishSlowSave = resolve;
    }), onError);
    autosave.flush();
    autosave.schedule(save('still-debounced'), onError);
    mock.timers.tick(900);
    finishSlowSave();
    await Promise.resolve();
    assert.equal(saved.at(-1), 'close-before-delay', 'an earlier response cannot shorten the latest debounce');
    mock.timers.tick(100);
    await Promise.resolve();
    assert.equal(saved.at(-1), 'still-debounced');

    const failure = new Error('offline');
    autosave.schedule(async () => { throw failure; }, onError);
    autosave.flush();
    await Promise.resolve();
    assert.deepEqual(errors, [failure], 'save failures are surfaced for retry');
    autosave.schedule(save('retry'), onError);
    mock.timers.tick(1000);
    await Promise.resolve();
    assert.equal(saved.at(-1), 'retry', 'a failed request does not block later saves');
  } finally {
    mock.timers.reset();
  }
  console.log('Favorite order autosave QA passed.');
}

void run();
