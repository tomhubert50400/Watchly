// @ts-expect-error QA runs under Node, outside the Expo runtime types.
import assert from 'node:assert/strict';
// @ts-expect-error QA runs under Node, outside the Expo runtime types.
import { readFileSync } from 'node:fs';
// @ts-expect-error QA runs under Node, outside the Expo runtime types.
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as model from './spoilerModel';

type Write = { key: string; value: string; resolve: () => void; reject: () => void };
const pending: Write[] = [];
const storage = {
  getItem: async () => null,
  setItem: (key: string, value: string) => new Promise<void>((resolve, reject) => {
    pending.push({ key, value, resolve, reject: () => reject(new Error('Storage unavailable')) });
  }),
};
const source = readFileSync(new URL('./useSpoilerPreferences.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exported: Record<string, any> = {};
runInNewContext(compiled, {
  exports: exported,
  require: (name: string) => {
    if (name === '@react-native-async-storage/async-storage') return { default: storage };
    if (name === './spoilerModel') return model;
    if (name === 'react') return {
      useCallback: (fn: () => void) => fn,
      useEffect: (fn: () => void) => fn(),
      useSyncExternalStore: (_subscribe: unknown, read: () => unknown) => read(),
    };
    throw new Error(`Unexpected import: ${name}`);
  },
});
async function main() {
  const read = () => exported.useSpoilerPreferences('user-a');
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
  read();
  await tick();
  const controls = read();
  const first = controls.save({ enabled: true });
  assert.equal(read().preferences.enabled, true, 'activation must update before storage completes');
  const second = controls.save({ recentDays: 7 });
  assert.equal(read().preferences.enabled, true, 'rapid changes must merge against the latest snapshot');
  assert.equal(read().preferences.recentDays, 7);
  await tick();
  assert.equal(pending.length, 1, 'writes must be serialized');
  pending.shift()!.resolve();
  await first;
  await tick();
  assert.equal(read().preferences.recentDays, 7, 'an older write must not revert newer selections');
  assert.equal(JSON.parse(pending[0].value).recentDays, 7);
  pending.shift()!.resolve();
  await second;
  assert.equal(read().saving, false);
  const failed = read().save({ recentDays: 14 });
  const latest = read().save({ unwatchedMovies: true });
  await tick();
  pending.shift()!.reject();
  await failed;
  await tick();
  assert.equal(read().preferences.unwatchedMovies, true, 'an older failure must not undo a newer edit');
  pending.shift()!.reject();
  await latest;
  assert.equal(read().preferences.recentDays, 7, 'a final failure restores the last persisted selection');
  assert.equal(read().preferences.unwatchedMovies, false);
  assert.ok(read().error);
  const retry = read().save({ recentDays: 3 });
  await tick();
  pending.shift()!.resolve();
  await retry;
  assert.equal(read().preferences.recentDays, 3, 'editing must recover after a storage failure');
  assert.equal(read().error, null);
  const sheet = readFileSync(new URL('./SpoilerSettingsSheet.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(sheet, /disabled=\{[^}]*saving/, 'saving one preference must not dim unrelated controls');
  console.log('Spoiler preferences QA passed: immediate updates, ordered rapid edits, failure recovery and stable controls.');
}

void main();
