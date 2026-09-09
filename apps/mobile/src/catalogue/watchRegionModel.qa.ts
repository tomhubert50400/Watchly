import assert from 'node:assert/strict';
import { normalizeWatchRegion, resolveWatchRegion, watchRegions } from './watchRegionModel';

assert.equal(normalizeWatchRegion('FRA'), 'FR');
assert.equal(normalizeWatchRegion('KOR'), 'KR');
assert.equal(normalizeWatchRegion('USA'), 'US');
assert.equal(normalizeWatchRegion(' gb '), 'GB');
assert.equal(normalizeWatchRegion('invalid'), null);
assert.equal(resolveWatchRegion('FR', 'KOR'), 'FR', 'Manual choice takes precedence over the App Store');
assert.equal(resolveWatchRegion(null, 'KOR'), 'KR', 'Automatic mode restores the App Store country');
assert.equal(resolveWatchRegion(null, null), null, 'An unavailable storefront must not invent a country');
assert.equal(resolveWatchRegion('invalid', 'FRA'), 'FR');
assert.equal(new Set(watchRegions.map((region) => region.code)).size, watchRegions.length);
for (const region of watchRegions) {
  assert.match(region.code, /^[A-Z]{2}$/);
  assert.equal(normalizeWatchRegion(region.alpha3), region.code);
}
console.log('Watch region QA passed');
