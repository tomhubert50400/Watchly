// @ts-expect-error QA executes under tsx/Node.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const moduleExports: Record<string, Function> = {};
const code = ts.transpileModule(readFileSync(new URL('./optionalImagePrefetch.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
runInNewContext(code, { exports: moduleExports, require: (name: string) => {
  assert.equal(name, 'react-native');
  return { Image: { prefetch: () => Promise.resolve(true) } };
} });
const createPrefetcher = moduleExports.createOptionalImagePrefetcher;
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

async function verify() {
  const started: string[] = [];
  const pending = new Map<string, () => void>();
  let active = 0;
  let peak = 0;
  const prefetch = createPrefetcher((url: string) => {
    started.push(url);
    peak = Math.max(peak, ++active);
    return new Promise<void>(resolve => pending.set(url, resolve)).finally(() => { active -= 1; });
  });
  let startupCurrent = true;
  const startup = prefetch([' a ', 'b', 'shared', 'obsolete', 'queued-shared', 'a', null, ''], () => startupCurrent);
  const discover = prefetch(['shared', 'queued-shared', 'c', 'd']);
  await flush();
  assert.deepEqual(started, ['a', 'b', 'shared']);
  startupCurrent = false;
  for (const url of ['a', 'b', 'shared']) pending.get(url)!();
  await flush();
  assert.deepEqual(started, ['a', 'b', 'shared', 'queued-shared', 'c', 'd'],
    'canceled-only URLs must be skipped; another live consumer must retain a shared queued URL');
  for (const url of ['queued-shared', 'c', 'd']) pending.get(url)!();
  await Promise.all([startup, discover]);
  assert.equal(peak, 3, 'startup and Discover must share a three-request budget');
  assert.equal(started.filter(url => url === 'shared').length, 1, 'overlapping callers must share in-flight work');

  const before = started.length;
  await prefetch(['never-start'], () => false);
  assert.equal(started.length, before, 'already canceled callers must not schedule work');
  let sameTurnCurrent = true;
  const sameTurn = prefetch(['same-turn-canceled'], () => sameTurnCurrent);
  sameTurnCurrent = false;
  await sameTurn;
  assert.equal(started.length, before, 'cancellation before the native call must also be respected');

  let obsolete = false;
  let obsoleteChecks = 0;
  let finishSlow!: () => void;
  const slow = createPrefetcher(() => new Promise<void>(resolve => { finishSlow = resolve; }), 1);
  const oldOwner = slow(['slow'], () => { obsoleteChecks += 1; return !obsolete; });
  await flush();
  obsolete = true;
  const stillCurrent = () => true;
  const freshOwner = slow(['slow'], stillCurrent);
  const afterPruning = obsoleteChecks;
  const repeatedOwners = Array.from({ length: 100 }, () => slow(['slow'], stillCurrent));
  assert.equal(obsoleteChecks, afterPruning, 'later joins must not retain and recheck obsolete owner closures');
  finishSlow();
  await Promise.all([oldOwner, freshOwner, ...repeatedOwners]);

  const attempts: string[] = [];
  const resilient = createPrefetcher((url: string) => {
    attempts.push(url);
    if (url === 'throw') throw new Error('synchronous image failure');
    if (url === 'reject') return Promise.reject(new Error('image unavailable'));
    return Promise.resolve(false);
  }, 1);
  await resilient(['throw', 'reject', 'next']);
  await resilient(['reject']);
  assert.deepEqual(attempts, ['throw', 'reject', 'next', 'reject'],
    'sync failures, rejected requests and false results must release capacity; failed URLs must be retryable');
  assert.throws(() => createPrefetcher(() => Promise.resolve(), 0), /positive integer/);

  for (const relative of ['../launch/AppStartupPreloader.tsx', '../catalogue/DiscoverScreen.tsx']) {
    const source = readFileSync(new URL(relative, import.meta.url), 'utf8');
    assert.match(source, /import \{ prefetchOptionalImages \} from '\.\.\/cache\/optionalImagePrefetch'/);
    assert.doesNotMatch(source, /Image\.prefetch/, 'callers must not bypass the global image budget');
  }
  console.log('Optional image prefetch QA passed: global concurrency, deduplication, cancellation, shared ownership and failure recovery.');
}
void verify();
