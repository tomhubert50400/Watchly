// QA runs under Node, separately from the React Native runtime.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { loadProgressively } from '../watchlists/requestBoundaries';

const source = readFileSync(new URL('./useHydratedProfileMediaItems.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function mount(ids: number[]) {
  let effect: (() => (() => void)) | undefined;
  let state: unknown;
  let publications = 0;
  let finished: Promise<void> | undefined;
  const started: number[] = [];
  const pending = new Map<number, () => void>();
  const exports: Record<string, Function> = {};
  const modules: Record<string, unknown> = {
    react: {
      useEffect: (callback: typeof effect) => { effect = callback; },
      useState: (initial: unknown) => {
        state = initial;
        return [state, (next: (current: unknown) => unknown) => {
          state = next(state);
          publications += 1;
        }];
      },
    },
    '../catalogue/CatalogueCacheContext': {
      useCatalogueCache: () => ({
        refreshMovie: (id: number) => {
          started.push(id);
          return new Promise((resolve) => pending.set(id, () => resolve({
            title: `Hydrated ${id}`, posterUrl: `poster:${id}`, backdropUrl: null,
          })));
        },
        refreshSeries: () => { throw new Error('Unexpected series request'); },
      }),
    },
    '../library/libraryModel': { calculateResumeEpisode: () => null },
    '../watchlists/requestBoundaries': {
      loadProgressively: (options: Parameters<typeof loadProgressively>[0]) => {
        finished = loadProgressively(options);
        return finished;
      },
    },
  };
  runInNewContext(code, { exports, require: (name: string) => {
    assert(name in modules, `Unexpected import: ${name}`);
    return modules[name];
  } });
  exports.useHydratedProfileMediaItems(ids.map((id) => ({
    key: `movie:${id}`, contentType: 'movie', tmdbId: id, title: `TMDB ${id}`,
    posterUrl: null, backdropUrl: null, numberOfEpisodes: null,
  })));
  const cleanup = effect!();
  return {
    started, pending, cleanup,
    finished: () => finished!,
    publications: () => publications,
    state: () => state as Array<{ title: string }>,
  };
}

async function run() {
  const old = mount(Array.from({ length: 12 }, (_, index) => index + 1));
  assert.deepEqual(old.started, [1, 2, 3], 'profile hydration must start only three requests');
  const beforeCleanup = old.publications();
  old.cleanup();
  old.pending.forEach((resolve) => resolve());
  await old.finished();
  assert.deepEqual(old.started, [1, 2, 3], 'cleanup must prevent starting the remaining queued titles');
  assert.equal(old.publications(), beforeCleanup, 'completed obsolete requests must not publish');

  const replacement = mount([101, 102, 103, 104]);
  replacement.pending.get(101)!();
  // Allow the async hydrator and progressive worker to start the next item.
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(replacement.started, [101, 102, 103, 104]);
  replacement.pending.forEach((resolve) => resolve());
  await replacement.finished();
  assert(replacement.state().every((item) => item.title.startsWith('Hydrated ')),
    'a fresh mount must still finish hydrating its current titles');
  replacement.cleanup();
  console.log('Profile hydration cancellation QA passed: bounded workers, cleanup and replacement.');
}

void run().catch((error) => { console.error(error); process.exitCode = 1; });
