// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';
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

const appSource = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
assert(
  appSource.includes('theme={watchlyNavigationTheme}'),
  'NavigationContainer must use the Watchly dark theme so native back transitions cannot expose the light default theme.',
);
assert(
  appSource.includes('background: colors.background,') && appSource.includes('card: colors.background,'),
  'The navigation theme background and card layers must both use the Watchly app background.',
);
assert(
  appSource.includes('<SafeAreaProvider style={styles.appRoot}>'),
  'The app root must remain dark behind rounded native transition corners.',
);

console.log('Stack config QA passed.');
