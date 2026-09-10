import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as model from './watchRegionModel';
import { normalizeWatchRegion, readWatchRegionOverride, resolveWatchRegion, watchRegionOverrideDuration, watchRegions } from './watchRegionModel';
import { fetchWatchRegionCountry } from './watchRegionIp';

assert.equal(normalizeWatchRegion('FRA'), 'FR');
assert.equal(normalizeWatchRegion('KOR'), 'KR');
assert.equal(normalizeWatchRegion('USA'), 'US');
assert.equal(normalizeWatchRegion(' gb '), 'GB');
assert.equal(normalizeWatchRegion('invalid'), null);
const now = 1000;
const override = { country: 'FR', expiresAt: now + watchRegionOverrideDuration };
assert.equal(watchRegionOverrideDuration, 7_200_000);
assert.equal(resolveWatchRegion(override, 'KOR', now), 'FR', 'Manual choice takes precedence over IP');
assert.equal(resolveWatchRegion(override, 'KOR', override.expiresAt - 1), 'FR');
assert.equal(resolveWatchRegion(override, 'KOR', override.expiresAt), 'KR', 'Return to IP at exactly two hours');
assert.equal(resolveWatchRegion(override, null, override.expiresAt), null, 'Expired choice cannot survive an IP failure');
assert.equal(resolveWatchRegion(override, null, now), 'FR', 'IP failure does not erase an active manual choice');
assert.equal(resolveWatchRegion(null, 'KOR'), 'KR');
assert.equal(resolveWatchRegion(null, null), null, 'Unavailable IP must not invent a country');
const restored = readWatchRegionOverride(JSON.stringify(override));
assert.deepEqual(restored, override);
assert.equal(resolveWatchRegion(restored, 'US', override.expiresAt - 1), 'FR', 'Restart preserves original expiry');
assert.equal(resolveWatchRegion(restored, 'US', override.expiresAt), 'US');
for (const stored of ['FR', '"US"', '{', '{"country":123,"expiresAt":42}', '{"country":"FR","expiresAt":"42"}', null]) {
  assert.equal(readWatchRegionOverride(stored), null, 'Legacy or malformed storage must not become a permanent override');
}
assert.equal(new Set(watchRegions.map((region) => region.code)).size, watchRegions.length);
for (const region of watchRegions) {
  assert.match(region.code, /^[A-Z]{2}$/);
  assert.equal(normalizeWatchRegion(region.alpha3), region.code);
}
async function testIpCountry() {
  const originalFetch = globalThis.fetch;
  try {
    for (const [body, expected] of [[{ country: 'FR' }, 'FR'], [{ country: 'invalid' }, null], [{ country: 42 }, null], [null, null]] as const) {
      globalThis.fetch = async () => new Response(JSON.stringify(body));
      assert.equal(await fetchWatchRegionCountry(), expected);
    }
    globalThis.fetch = async () => new Response('', { status: 429 });
    assert.equal(await fetchWatchRegionCountry(), null);
    globalThis.fetch = async () => { throw new Error('offline'); };
    assert.equal(await fetchWatchRegionCountry(), null);
    globalThis.fetch = async () => new Response('not json');
    assert.equal(await fetchWatchRegionCountry(), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
  await testRegionLifecycle();
  console.log('Watch region QA passed: IP failures, persistence, expiry, foreground resume and request coalescing');
}

async function testRegionLifecycle() {
  const compiled = ts.transpileModule(readFileSync(new URL('./useWatchRegion.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const originalNow = Date.now;
  let clock = 1000;
  Date.now = () => clock;
  let stored: string | null = null;
  let ipCountry: string | null = 'KR';
  let requests = 0;
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
  function boot() {
    const exported: Record<string, any> = {};
    const timers = new Map<number, { callback: () => void; at: number }>();
    let timerId = 0;
    let onActive = (_status: string) => {};
    let subscribe: (listener: () => void) => () => void;
    runInNewContext(compiled, {
      exports: exported, Date,
      setTimeout: (callback: () => void, delay: number) => {
        timers.set(++timerId, { callback, at: clock + delay });
        return timerId;
      },
      clearTimeout: (id: number) => timers.delete(id),
      require: (name: string) => {
        if (name === '@react-native-async-storage/async-storage') return { default: {
          getItem: async () => stored,
          setItem: async (_key: string, value: string) => { stored = value; },
          removeItem: async () => { stored = null; },
        } };
        if (name === './watchRegionModel') return model;
        if (name === './watchRegionIp') return { fetchWatchRegionCountry: async () => { requests++; return ipCountry; } };
        if (name === 'react-native') return { AppState: { addEventListener: (_event: string, callback: typeof onActive) => {
          onActive = callback;
          return { remove() {} };
        } } };
        if (name === 'react') return { useSyncExternalStore: (listen: typeof subscribe, read: () => unknown) => {
          subscribe = listen;
          return read();
        } };
        throw new Error(`Unexpected import: ${name}`);
      },
    });
    const read = () => exported.useWatchRegion();
    read();
    const unmount = subscribe!(() => {});
    return { read, unmount, active: () => onActive('active'), fireTimers: () => {
      for (const [id, timer] of timers) if (timer.at <= clock) { timers.delete(id); timer.callback(); }
    } };
  }
  try {
    let app = boot();
    await tick();
    assert.equal(app.read().country, 'KR');
    await app.read().setCountry('FR');
    const expiry = JSON.parse(stored!).expiresAt;
    assert.equal(expiry, clock + 7_200_000);
    app.unmount();
    clock += 60_000;
    app = boot();
    await tick();
    assert.equal(app.read().country, 'FR', 'Manual choice survives a cold restart');
    assert.equal(app.read().override.expiresAt, expiry, 'Restart must not extend the two hours');
    clock = expiry - 1;
    app.fireTimers();
    assert.equal(app.read().country, 'FR');
    clock = expiry;
    ipCountry = 'GB';
    app.fireTimers();
    await tick();
    assert.equal(app.read().country, 'GB', 'Timer refreshes the IP at expiry');
    assert.equal(stored, null);
    await app.read().setCountry('FR');
    clock += 7_200_001;
    ipCountry = null;
    const before = requests;
    app.active();
    await tick();
    assert.equal(requests, before + 1, 'Resume and expiration share one IP request');
    assert.equal(app.read().country, null, 'Offline resume cannot retain an expired country');
    assert.equal(app.read().override, null);
    ipCountry = 'KR';
    await app.read().setCountry('FR');
    await app.read().setCountry(null);
    await tick();
    assert.equal(app.read().country, 'KR', 'Automatic selection cancels the override immediately');
    app.unmount();
  } finally {
    Date.now = originalNow;
  }
}
void testIpCountry();
