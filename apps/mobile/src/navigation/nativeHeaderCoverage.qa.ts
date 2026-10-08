// @ts-expect-error QA executes under Node, outside the Expo runtime types.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under Node, outside the Expo runtime types.
import { readFileSync } from 'node:fs';
// @ts-expect-error QA executes under Node, outside the Expo runtime types.
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { resolvePreviousPageLabel, rootStackScreenOptions } from './stackConfig';

assert.equal(rootStackScreenOptions.headerShown, true, 'Keep UIKit header controls enabled.');
assert.equal(rootStackScreenOptions.headerTransparent, true);
assert.equal(rootStackScreenOptions.headerStyle.backgroundColor, 'transparent');
assert.equal(rootStackScreenOptions.headerShadowVisible, false);
assert.equal(rootStackScreenOptions.headerBlurEffect, 'none');
assert.equal(rootStackScreenOptions.scrollEdgeEffects.top, 'hidden', 'Scrolling must not restore the iOS edge band.');

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = source('../../App.tsx');
assert.match(app, /headerTitle: \(\{ children \}\) => <NativeHeaderTitle title=\{children\} \/>/,
  'Every native header must reuse the watchlist title view instead of the standard iOS title.');
assert.match(source('../watchlists/WatchlistDetailLayout.tsx'), /headerTitle: \(\) => <NativeHeaderTitle/,
  'Watchlists and other pages must use the same title component.');
assert.match(app, /headerLeft:[\s\S]*<StackBackButton/);
assert.match(app, /goBackIfFocused\(navigation\)/);
assert.doesNotMatch(app, /headerStyle: \{ backgroundColor: colors.background \}/);
const discoverRegistration = app.split('name="DiscoverResults"')[1].split('/>')[0];
assert.doesNotMatch(discoverRegistration, /headerShown|headerLeft|headerBackVisible/,
  'Explore, More for you, collections and home categories must inherit the shared native back controls.');
assert.doesNotMatch(source('../catalogue/DiscoverResultsScreen.tsx'), /leading=|ChevronLeft|navigation\.goBack\(/,
  'Discover results must not draw a second back button inside the scrolling content.');
assert.equal(resolvePreviousPageLabel([
  { name: 'MainTabs', state: { index: 1, routes: [{ name: 'Home' }, { name: 'Explore' }] } },
  { name: 'DiscoverResults' },
]), 'Discover', 'Back must use the visible Discover tab label.');
for (const route of ['FilmDetail', 'SeriesDetail', 'ActorDetail', 'Settings', 'Notifications', 'ReleaseCalendar', 'AllTimeStats', 'PersonalWatchlist', 'SharedWatchlist']) {
  const registration = app.split(`name="${route}"`)[1].split('/>')[0];
  assert.doesNotMatch(registration, /headerShown: false/, `${route} must preserve its native controls.`);
}
for (const [screen, contentType] of [['FilmDetailScreen', 'movie'], ['SeriesDetailScreen', 'series']] as const) {
  const detail = source(`../catalogue/${screen}.tsx`);
  assert(detail.includes(`headerRight: () => <FavoriteControl contentType="${contentType}" tmdbId={tmdbId} />`));
  assert.match(detail, /scrollEnabled=\{!isRatingGestureActive\}/);
  assert.doesNotMatch(detail, /ScreenBackButton|headerMode="overlay"/);
}

// Exercise the shared screen's layout with and without a native header.
let headerHeight = 106;
const exported: any = {};
const jsx = (type: unknown, props: unknown) => ({ type, props });
runInNewContext(ts.transpileModule(source('../components/Screen.tsx'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText, { exports: exported, require: (name: string) => ({
  react: { useRef: (current: unknown) => ({ current }), useContext: () => headerHeight },
  'react/jsx-runtime': { jsx, jsxs: jsx },
  '@react-navigation/native': { useScrollToTop: () => {} },
  '@react-navigation/elements': { HeaderHeightContext: {} },
  'react-native': { ScrollView: 'scroll', Platform: { OS: 'ios' }, StyleSheet: { create: (value: unknown) => value } },
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 62, bottom: 34 }) },
  '../design/tokens': { colors: {}, spacing: { xl: 24, xxxl: 48 } },
  './useFocusedFieldVisibility': { useFocusedFieldVisibility: () => ({}) },
  './ScreenTopFade': { ScreenTopFade: 'top-fade' },
}[name] ?? {}) });
function findProps(node: any, type: string): any {
  if (!node || typeof node !== 'object') return undefined;
  if (node.type === type) return node.props;
  return [node.props?.children].flat().map((child) => findProps(child, type)).find(Boolean);
}
for (const [height, expected] of [[106, 106], [0, 62]]) {
  headerHeight = height;
  const screen = exported.Screen({ title: '' });
  const scroll = findProps(screen, 'scroll');
  assert.equal(findProps(screen, 'top-fade').topInset, 62,
    'Like watchlists, the fade must end at the safe area rather than cover the entire navigation bar.');
  assert.equal(Object.assign({}, ...scroll.contentContainerStyle).paddingTop, expected);
  assert.equal(scroll.contentInsetAdjustmentBehavior, 'never', 'Do not apply native insets twice.');
}
console.log('Transparent native header and screen inset QA passed.');
