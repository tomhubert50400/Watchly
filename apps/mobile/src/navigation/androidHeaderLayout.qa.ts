// @ts-expect-error QA executes under Node, outside the Expo runtime types.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under Node, outside the Expo runtime types.
import { readFileSync } from 'node:fs';
// @ts-expect-error QA executes under Node, outside the Expo runtime types.
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { spacing } from '../design/tokens';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const heightContext = {};
const shownContext = {};
let height: number | undefined = 0;
let shown = true;
let top = 24;
const platform = { OS: 'android' };
const exported: any = {};
runInNewContext(ts.transpileModule(source('./useContentHeaderHeight.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: exported, require: (name: string) => ({
  react: { useContext: (context: unknown) => context === heightContext ? height : shown },
  '@react-navigation/elements': { HeaderHeightContext: heightContext, HeaderShownContext: shownContext },
  'react-native': { Platform: platform },
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top }) },
}[name]) });

assert.equal(exported.useContentHeaderHeight(), 80, 'A visible zero-height Android header must reserve toolbar and status bar space.');
top = 0;
assert.equal(exported.useContentHeaderHeight(), 56, 'Android still needs toolbar space without a top inset.');
top = 24;
height = 88;
assert.equal(exported.useContentHeaderHeight(), 88, 'Preserve an actual measured header height.');
height = 0;
shown = false;
assert.equal(exported.useContentHeaderHeight(), 0, 'Root tabs must not gain a second navigation bar.');
height = undefined;
assert.equal(exported.useContentHeaderHeight(), 0, 'Screens outside a native header keep their existing spacing.');
shown = true;
height = 0;
platform.OS = 'ios';
assert.equal(exported.useContentHeaderHeight(), 0, 'The Android fallback must never change iOS.');
height = 106;
assert.equal(exported.useContentHeaderHeight(), 106);

const homeSpacing = source('../home/HomeScreen.tsx').match(/const headerTopSpacing = ([\s\S]*?);/)?.[1];
assert.ok(homeSpacing);
const homeTop = (os: string, expo: boolean) => runInNewContext(homeSpacing, {
  Platform: { OS: os }, insets: { top: 62 }, spacing,
  Constants: { appOwnership: expo ? 'expo' : 'standalone', executionEnvironment: expo ? 'store' : 'bare' },
  AppOwnership: { Expo: 'expo' }, ExecutionEnvironment: { StoreClient: 'store' },
});
assert.equal(homeTop('android', false), spacing.sm, 'Android home controls must leave a small gap below the status bar.');
assert.equal(homeTop('android', true), spacing.sm);
assert.equal(homeTop('ios', false), 27, 'Preserve native iOS home spacing.');
assert.equal(homeTop('ios', true), -35, 'Preserve Expo Go iOS home spacing.');
for (const file of ['../components/Screen.tsx', '../watchlists/WatchlistDetailLayout.tsx', '../profile/ProfileMediaScreen.tsx', '../reviews/MovieReviewsScreen.tsx', '../imports/ImportMatchesScreen.tsx']) {
  assert.match(source(file), /useContentHeaderHeight\(\)/, `${file} must reserve space for Android transparent headers.`);
  assert.doesNotMatch(source(file), /useHeaderHeight\(\)/, `${file} must not use Android's zero height directly.`);
}
// Render every profile list variant to keep Android header actions out of the tab row.
const profileExports: any = {};
let headerOptions: any;
let filter = 'series';
const jsx = (type: unknown, props: unknown) => ({ type, props });
runInNewContext(ts.transpileModule(source('../profile/ProfileMediaScreen.tsx'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText, { exports: profileExports, require: (name: string) => ({
  react: { useState: (value: unknown) => [value, () => {}], useMemo: (fn: () => unknown) => fn(), useCallback: (fn: unknown) => fn, useLayoutEffect: (fn: () => void) => fn() },
  'react/jsx-runtime': { jsx, jsxs: jsx },
  '@react-navigation/native': { useNavigation: () => ({ setOptions: (options: unknown) => { headerOptions = options; } }), useRoute: () => ({ params: { filter, items: [] } }) },
  'react-native': { Platform: platform, View: 'view', Pressable: 'button', StyleSheet: { create: (value: unknown) => value }, useWindowDimensions: () => ({ width: 412 }) },
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 24 }) },
  '../navigation/useContentHeaderHeight': { useContentHeaderHeight: () => 80 },
  '../components/SegmentedControl': { SegmentedControl: 'tabs' },
  '../design/tokens': { colors: {}, spacing: { xl: 24, sm: 8, md: 12, lg: 16, xxxl: 48 }, typography: {} },
  '../library/useLibraryData': { useLibraryData: () => ({}) },
  '../auth/AuthSessionContext': { useAuthSession: () => ({}) },
  '../sync/titleRemovalUpdates': { useTitleRemovalUpdates: () => 0 },
  './profileMediaModel': { getProfileMediaItems: () => [], groupProfileMediaByStatus: () => ({ inProgress: [], planned: [], completed: [] }) },
  './useProfileMediaGenres': { useProfileMediaGenres: () => ({ genres: [], genresByKey: {} }) },
}[name] ?? {}) });
function findNode(node: any, predicate: (node: any) => boolean): any {
  if (!node || typeof node !== 'object') return undefined;
  if (predicate(node)) return node;
  return [node.props?.children].flat().map((child) => findNode(child, predicate)).find(Boolean);
}
for (const os of ['android', 'ios']) {
  platform.OS = os;
  for (filter of ['series', 'movies', 'planned', 'favorites']) {
    headerOptions = undefined;
    const screen = profileExports.ProfileMediaScreen();
    const inlineFilter = findNode(screen, (node) => node.props?.accessibilityLabel?.startsWith('Filter by genre:'));
    const tabs = findNode(screen, (node) => node.type === 'tabs');
    assert.equal(tabs.props.containerStyle.flex, 1, 'The tabs must fill their available row.');
    if (os === 'android') {
      assert.equal(headerOptions.headerRight().props.accessibilityLabel, 'Filter by genre: All genres');
      assert.equal(inlineFilter, undefined, `${filter} must place the Android filter beside the native title.`);
    } else {
      assert.equal(headerOptions, undefined, 'Preserve the existing iOS header.');
      assert.ok(inlineFilter, 'Preserve the existing iOS filter position.');
    }
  }
}
console.log('Android header layout QA passed.');
