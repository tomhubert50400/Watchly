// @ts-expect-error QA executes under tsx/Node.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as reducer from './cachedResourceReducer';
import * as memory from './memoryResourceCache';

const code = ts.transpileModule(readFileSync(new URL('./useCachedResource.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

function mount() {
  const slots: any[] = [];
  let cursor = 0;
  let effects: Array<{ index: number; create: Function; deps: unknown[] }> = [];
  let dirty = false;
  const requests: Array<(data: unknown) => void> = [];
  const sameDeps = (a: unknown[] | undefined, b: unknown[]) => a?.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const load = () => new Promise(resolve => requests.push(resolve));
  const exported: Record<string, Function> = {};
  const modules: Record<string, unknown> = {
    react: {
      useReducer: (reduce: Function, initial: unknown, init: Function) => {
        const index = cursor++;
        slots[index] ??= { value: init(initial) };
        return [slots[index].value, (action: unknown) => { slots[index].value = reduce(slots[index].value, action); dirty = true; }];
      },
      useState: (initial: unknown) => {
        const index = cursor++;
        slots[index] ??= { value: initial };
        return [slots[index].value, (value: any) => {
          slots[index].value = typeof value === 'function' ? value(slots[index].value) : value;
          dirty = true;
        }];
      },
      useRef: (current: unknown) => { const index = cursor++; slots[index] ??= { current }; return slots[index]; },
      useCallback: (callback: Function, deps: unknown[]) => {
        const index = cursor++;
        if (!sameDeps(slots[index]?.deps, deps)) slots[index] = { callback, deps };
        return slots[index].callback;
      },
      useEffect: (create: Function, deps: unknown[]) => {
        const index = cursor++;
        if (!sameDeps(slots[index]?.deps, deps)) effects.push({ index, create, deps });
      },
    },
    './cachedResourceReducer': reducer,
    './memoryResourceCache': memory,
    './persistedCache': { readPersistedCache: async () => null, writePersistedCache: async () => {} },
  };
  runInNewContext(code, { exports: exported, require: (name: string) => modules[name] });
  return {
    requests,
    render: (options: { key: string; paused?: boolean; enabled?: boolean }) => {
      const frames: any[] = [];
      do {
        cursor = 0; effects = []; dirty = false;
        frames.push(exported.useCachedResource({ ...options, load }));
        for (const effect of effects) slots[effect.index]?.cleanup?.();
        for (const effect of effects) slots[effect.index] = { deps: effect.deps, cleanup: effect.create() };
      } while (dirty);
      return frames;
    },
    unmount: () => { for (const slot of slots) slot?.cleanup?.(); },
  };
}

void (async () => {
  const key = 'watchly:user:pause-test:discover';
  const data = { items: [{ id: 'movie:1' }, { id: 'movie:2' }] };
  memory.setMemoryResource(key, data, new Date().toISOString());
  const hook = mount();
  for (const paused of [false, true, false]) {
    const frames = hook.render({ key, paused });
    assert(frames.every(frame => frame.data === data), 'Focus changes must never render an empty frame or unmount the carousel.');
  }
  await flush();
  assert.equal(hook.requests.length, 0, 'A fresh cache must avoid network requests after returning.');

  memory.setMemoryResource(key, data, new Date(Date.now() - 600_000).toISOString());
  hook.render({ key, paused: true });
  await flush();
  assert.equal(hook.requests.length, 0, 'Stale data must not trigger loading while paused.');
  const resumed = hook.render({ key, paused: false });
  assert(resumed.every(frame => frame.data === data && !frame.isRefreshing), 'Stale content stays visible during silent revalidation.');
  await flush();
  assert.equal(hook.requests.length, 1);
  hook.render({ key, paused: true });
  hook.requests[0]({ items: [{ id: 'late-response' }] });
  await flush();
  assert(hook.render({ key, paused: true }).every(frame => frame.data === data), 'A late response must not replace paused content.');

  assert(hook.render({ key: `${key}:other-user`, paused: true }).every(frame => frame.data === null), 'Changing accounts while paused must clear the old account immediately.');
  hook.unmount();
  const disabled = mount();
  disabled.render({ key });
  assert(disabled.render({ key, enabled: false }).every(frame => frame.data === null), 'Disabling a resource must still hide its data.');
  disabled.unmount();
  const cold = mount();
  cold.render({ key: `${key}:cold`, paused: true });
  await flush();
  assert.equal(cold.requests.length, 0, 'An initially paused page must not load.');
  cold.unmount();
  console.log('Cached resource pause QA passed.');
})();
