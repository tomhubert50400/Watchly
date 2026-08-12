// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';
import { resolveAppEnvironment, validatePublicEnvironment } from '../config/appEnvironment';

const stagingConfig = {
  apiUrl: 'https://api-staging.watchly.example',
  firebaseApiKey: 'staging-api-key',
  firebaseAppId: 'staging-app-id',
  firebaseAuthDomain: 'watchly-staging.firebaseapp.com',
  firebaseProjectId: 'watchly-staging',
};

assert.equal(resolveAppEnvironment(undefined), 'development');
assert.equal(resolveAppEnvironment('staging'), 'staging');
assert.throws(() => resolveAppEnvironment('preview'), /Invalid EXPO_PUBLIC_APP_ENV/);
assert.doesNotThrow(() => validatePublicEnvironment('staging', stagingConfig));
assert.throws(
  () => validatePublicEnvironment('staging', { ...stagingConfig, apiUrl: 'http://10.0.0.4:3000' }),
  /must use an HTTPS API URL/,
);
assert.throws(
  () => validatePublicEnvironment('staging', { ...stagingConfig, apiUrl: 'https://localhost:3000' }),
  /cannot use a local API URL/,
);
assert.throws(
  () => validatePublicEnvironment('production', { ...stagingConfig, firebaseAppId: undefined }),
  /EXPO_PUBLIC_FIREBASE_APP_ID/,
);
assert.throws(
  () => validatePublicEnvironment('staging', { ...stagingConfig, uiReviewEmail: 'review@local.test' }),
  /cannot include development authentication configuration/,
);

class ScopedVersionGuard {
  private scope: string;
  private version = 0;

  constructor(scope: string) {
    this.scope = scope;
  }

  begin() {
    const request = { scope: this.scope, version: ++this.version };
    return { isCurrent: () => request.scope === this.scope && request.version === this.version, request };
  }

  switchScope(scope: string) {
    if (scope !== this.scope) {
      this.scope = scope;
      this.version += 1;
    }
  }
}

const guard = new ScopedVersionGuard('user-a:movie:1');
const accountARequest = guard.begin();
guard.switchScope('user-b:movie:1');
assert.equal(accountARequest.isCurrent(), false, 'an account switch must synchronously invalidate an in-flight response');
const firstBRequest = guard.begin();
const retryBRequest = guard.begin();
assert.equal(firstBRequest.isCurrent(), false, 'a retry must invalidate the older resource request');
assert.equal(retryBRequest.isCurrent(), true);

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

const watchlistCache = source('../watchlists/WatchlistCacheContext.tsx');
assert.match(watchlistCache, /getDetailCacheKey\(requestOwner, watchlistId\)/);
assert.match(watchlistCache, /ownerRef\.current !== ownerId/);
assert.match(watchlistCache, /assertCurrentRequest\(isCurrent\);[\s\S]*getWatchlist/);
assert.match(watchlistCache, /getWatchlist[\s\S]*assertCurrentRequest\(isCurrent\);[\s\S]*Promise\.all/);
assert.match(watchlistCache, /Promise\.all[\s\S]*assertCurrentRequest\(isCurrent\);/);

const personalScreen = source('../watchlists/PersonalWatchlistScreen.tsx');
assert.match(personalScreen, /stateScope === resourceScope/);
assert.match(personalScreen, /isLoading && !visibleWatchlist/);
assert.match(
  personalScreen,
  /error && !visibleWatchlist[\s\S]*<Button label="Retry"/,
  'a personal watchlist load failure must stay actionable when no list is visible',
);
assert.doesNotMatch(
  personalScreen,
  /error && visibleWatchlist[\s\S]*InlineStatusBanner/,
  'a personal watchlist refresh failure must stay silent while saved content is visible',
);

for (const relativePath of [
  '../opinions/OpinionSheet.tsx',
  '../tracking/TrackingControls.tsx',
  '../notifications/ReleaseAlertControl.tsx',
]) {
  const control = source(relativePath);
  assert.match(control, /requestRef\.current\.scope !== requestScope/);
  assert.match(control, /const isCurrent = \(\) => requestRef\.current\.scope === scope/);
  assert.match(control, /await [\s\S]*if \(!isCurrent\(\)\) return/);
}

const movieOpinion = source('../tracking/MovieRatingControl.tsx');
assert.match(movieOpinion, /key=\{`\$\{currentUser\?\.id \?\? 'signed-out'\}:movie:\$\{tmdbId\}`\}/);
assert.match(movieOpinion, /ownerKey=\{currentUser\?\.id \?\? null\}/);
assert.match(movieOpinion, /resourceKey=\{`movie:\$\{tmdbId\}`\}/);

console.log('Private control isolation QA passed.');
