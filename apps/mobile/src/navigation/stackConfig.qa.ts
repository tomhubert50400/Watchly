import { detailBackOptions, resolvePreviousPageLabel, rootStackScreenOptions } from './stackConfig';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  rootStackScreenOptions.headerBackButtonDisplayMode === 'minimal',
  'Native stack back buttons must not expose internal route names such as MainTabs.',
);
assert(detailBackOptions('Home').headerBackTitle === 'Home', 'Detail back must name its real Home origin.');
assert(detailBackOptions('Library').headerBackTitle === 'Library', 'Detail back must name its real Library origin.');
assert(detailBackOptions(undefined).headerBackTitle === 'Back', 'Unknown detail origins must use a human fallback.');
assert(
  detailBackOptions('Explore').headerBackButtonDisplayMode === 'default',
  'Detail back labels must be visible instead of forcing the minimal chevron mode.',
);
assert(
  resolvePreviousPageLabel([
    { name: 'MainTabs', state: { index: 2, routes: [{ name: 'Home' }, { name: 'Explore' }, { name: 'Library' }] } },
    { name: 'FilmDetail' },
  ]) === 'Library',
  'A detail opened from MainTabs must name the active source tab.',
);
assert(
  resolvePreviousPageLabel([{ name: 'PersonalWatchlist', params: { title: 'Weekend Queue' } }, { name: 'FilmDetail' }]) === 'Weekend Queue',
  'A detail opened from a titled page must use that visible page title.',
);

console.log('Stack config QA passed.');
