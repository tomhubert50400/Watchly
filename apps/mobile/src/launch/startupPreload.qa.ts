// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
const feedSource = readFileSync(new URL('../feed/FeedScreen.tsx', import.meta.url), 'utf8');
const preloadSource = readFileSync(new URL('AppStartupPreloader.tsx', import.meta.url), 'utf8');
const launchSource = readFileSync(new URL('WatchlyLaunchGate.tsx', import.meta.url), 'utf8');

assert.match(
  appSource,
  /<AppStartupPreloader\s*\/>/,
  'the startup preloader must mount inside the application providers',
);
assert.match(
  launchSource,
  /appReady \|\| latestRevealReached/,
  'the launch fade must wait for application readiness until the safety deadline',
);

for (const requiredResource of [
  'PUBLIC_HOME_KEY',
  'PUBLIC_CATALOGUE_SECTIONS_KEY',
  'getHomeProgressKey',
  'getHomeFeedKey',
  'getHomeNotificationsKey',
  'getCommunityFeedKey',
  'loadCommunityFeed',
  'getLibraryResourceKey',
  'getProfileResourceKey',
  'preloadWatchlists',
]) {
  assert.match(
    preloadSource,
    new RegExp(requiredResource),
    `${requiredResource} must participate in startup preloading`,
  );
}

assert.equal(
  appSource.match(/lazy: false/g)?.length,
  2,
  'native and fallback tab navigators must mount every primary screen during startup',
);
assert.match(
  appSource,
  /sceneStyle: styles\.tabScene/,
  'fallback tab scenes must paint the Watchly background before their screen content',
);
assert.match(
  feedSource,
  /useCachedResource<HydratedFeedItem\[\]>/,
  'Community must consume the same hydrated resource prepared by startup preloading',
);

assert.match(
  preloadSource,
  /Image\.prefetch/,
  'startup must warm the remote artwork that is immediately visible after launch',
);
assert.match(
  preloadSource,
  /status === 'loading'/,
  'private preloading must wait until authentication resolves',
);
assert.doesNotMatch(
  preloadSource,
  /setReady\(false\)/,
  'launch readiness must remain true once the usable application shell is ready',
);

const authenticationGuardIndex = preloadSource.indexOf("if (status === 'loading')");
const launchReadyIndex = preloadSource.indexOf('setReady(true)');
const cataloguePreloadIndex = preloadSource.indexOf('await preloadCatalogueItems');
const privatePreloadIndex = preloadSource.indexOf('const privateResults');

assert.ok(
  authenticationGuardIndex >= 0 && authenticationGuardIndex < launchReadyIndex,
  'launch readiness must wait for authentication resolution',
);
assert.ok(
  launchReadyIndex >= 0 && launchReadyIndex < cataloguePreloadIndex,
  'catalogue detail warming must continue after the launch becomes ready',
);
assert.ok(
  launchReadyIndex < privatePreloadIndex,
  'private section warming must continue after the launch becomes ready',
);

console.log('Startup preload QA passed.');
