import { appLinking } from './linking';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(
  JSON.stringify(appLinking.prefixes) === JSON.stringify(['tvapp://', 'com.tom.tvapp.dev://', 'com.trywatchly.app://']),
  'Linking must accept every native scheme declared in app.json.',
);
assert(appLinking.config?.screens?.ReviewAccess === 'review-access', 'Review access must have its own deep link.');
assert(appLinking.config?.screens?.Notifications === 'alerts', 'tvapp://alerts must route to Notifications.');
const mainTabs = appLinking.config?.screens?.MainTabs;
assert(
  typeof mainTabs === 'object' && mainTabs.screens?.Library === 'library',
  'tvapp://library must route to the Library tab.',
);
const filmDetail = appLinking.config?.screens?.FilmDetail;
assert(typeof filmDetail === 'object' && filmDetail.path === 'film/:tmdbId', 'Film details must expose a shareable deep link.');
assert(
  typeof filmDetail === 'object' && filmDetail.parse?.tmdbId?.('346687') === 346687,
  'Film deep links must parse TMDB identifiers as numbers.',
);

console.log('Navigation linking QA passed.');
