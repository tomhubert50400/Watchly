// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';
// @ts-expect-error QA executes under tsx/Node.
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

const personalScreen = source('./PersonalWatchlistScreen.tsx');
const sharedScreen = source('./SharedWatchlistScreen.tsx');
const membersSheet = source('./WatchlistMembersSheet.tsx');
const sharedLayout = source('./WatchlistDetailLayout.tsx');

for (const screen of [personalScreen, sharedScreen]) {
  assert.match(screen, /<WatchlistPage/, 'every watchlist detail must use the shared page shell');
  assert.match(screen, /<WatchlistPosterGrid/, 'every watchlist detail must use the shared poster grid');
  assert.doesNotMatch(screen, /<WatchlistSummary/, 'watchlist details must not repeat header information');
  assert.match(screen, /<WatchlistPage title=\{route.params.title\}/,
    'both watchlists must pass their title to the shared screen header');
  assert.match(screen, /actions=\{headerActions\}/, 'both lists must pass their existing menu to the shared native header');
}

const app = source('../../App.tsx');
for (const name of ['SharedWatchlist', 'PersonalWatchlist']) {
  const options = app.split(`name="${name}"`)[1].split('/>')[0];
  assert.doesNotMatch(options, /headerShown: false/,
    `${name} must inherit the transparent native header`);
}

assert.match(sharedLayout, /resolveColumnCount/, 'the poster grid must adapt across screen sizes');
assert.match(
  sharedScreen,
  /isVoteComposerOpen \? <CreateSharedVoteSheet/,
  'shared voting controls must open in a dedicated modal',
);
assert.match(
  sharedScreen,
  /const headerActions = watchlist \? \(/,
  'shared watchlists must expose members from the header',
);
assert.match(
  membersSheet,
  /<BottomActionSheet[\s\S]*title="Members"/,
  'member management must live in a focused sheet',
);
assert.doesNotMatch(
  membersSheet,
  /if \(!watchlist\.isOwner\) return|watchlist\.isOwner \? <View/,
  'all members must be able to search and invite',
);
assert.doesNotMatch(
  sharedScreen,
  /<SectionHeader[\s\S]{0,180}title="Members"/,
  'members must not remain as a full page section',
);
assert.doesNotMatch(
  sharedScreen,
  /heroCard|posterGrid|sessionCard|ownerCard/,
  'shared lists must not restore their previous card-heavy layout',
);

console.log('Watchlist detail layout QA passed.');

let nativeOptions: any;
const exported: any = {};
const jsx = (type: unknown, props: unknown) => ({ type, props });
const titleExports: any = {};
runInNewContext(ts.transpileModule(source('../components/NativeHeaderTitle.tsx'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText, { exports: titleExports, require: (name: string) => ({
  'react/jsx-runtime': { jsx, jsxs: jsx },
  'react-native': { StyleSheet: { create: (value: unknown) => value } },
  '../design/tokens': { colors: {} },
}[name] ?? {}) });
runInNewContext(ts.transpileModule(sharedLayout, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: exported, require: (name: string) => ({
  react: { useRef: (current: unknown) => ({ current }), useLayoutEffect: (effect: () => void) => effect() },
  '@react-navigation/native': { useNavigation: () => ({ setOptions: (options: unknown) => { nativeOptions = options; } }) },
  '@react-navigation/elements': { useHeaderHeight: () => 106 },
  'react/jsx-runtime': { jsx, jsxs: jsx },
  'react-native': { ScrollView: 'scroll', Platform: { OS: 'ios' }, StyleSheet: { create: (value: unknown) => value } },
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 62, bottom: 34 }) },
  '../components/ScreenTopFade': { ScreenTopFade: 'top-fade' },
  '../components/NativeHeaderTitle': titleExports,
  '../design/tokens': { colors: {}, radii: {}, typography: {}, spacing: { xl: 24 } },
  '../components/useFocusedFieldVisibility': { useFocusedFieldVisibility: () => ({}) },
}[name] ?? {}) });

const sharedTitle = titleExports.NativeHeaderTitle({ title: 'Movie Night Test' });
const personalTitle = titleExports.NativeHeaderTitle({ title: 'Week end Ideas', subtitle: '3 titles' });
assert.equal(sharedTitle.props.children[0].props.children, 'Movie Night Test');
assert.equal(sharedTitle.props.children[0].props.accessibilityRole, 'header');
assert.equal(sharedTitle.props.children[0].props.numberOfLines, 1);
assert.equal(sharedTitle.props.children[1], null, 'Shared lists must not reserve space for an absent subtitle');
assert.equal(personalTitle.props.children[1].props.children, '3 titles', 'Personal lists must retain their title count');
assert.equal(sharedTitle.props.style, personalTitle.props.style, 'Both native title views use the same layout');
assert.equal(sharedTitle.props.children[0].props.style, personalTitle.props.children[0].props.style);

function scroller() {
  const page = exported.WatchlistPage({ title: 'Movie Night', actions: 'menu', background: 'artwork', headerFade: true, overlay: 'drag-overlay', trashHeader: 'trash' });
  const fade = page.props.children.find((node: any) => node?.type === 'top-fade');
  assert.ok(fade, 'Watchlists must use the same content mask and blur as Screen');
  assert.equal(fade.props.enabled, true);
  assert.equal(fade.props.topInset, 62, 'Match Screen fade geometry, independently of native header height');
  assert.equal(fade.props.children.type, 'scroll', 'Fade the scroll content, rather than adding a separate overlay');
  assert.ok(page.props.children.indexOf('drag-overlay') > page.props.children.indexOf(fade),
    'The dragged poster must remain above the masked content');
  assert.equal(nativeOptions.headerRight(), 'menu', 'The existing menu must be hosted by UIKit');
  assert.equal(nativeOptions.headerTitle().props.title, 'Movie Night');
  assert.equal(nativeOptions.headerTitle().type, titleExports.NativeHeaderTitle);
  assert.equal(nativeOptions.header().props.children, 'trash', 'Dragging temporarily replaces the native controls');
  assert.equal(nativeOptions.header().props.style.height, 106, 'Dragging must not change the content inset');
  return fade.props.children.props;
}
const scroll = scroller();
assert.equal(scroll.contentInsetAdjustmentBehavior, 'never', 'Native header space is applied manually only once');
assert.equal(scroll.automaticallyAdjustContentInsets, false);
assert.equal(Object.assign({}, ...scroll.contentContainerStyle).paddingTop, 130,
  'The measured native header height must include the safe area only once');
const editor = exported.WatchlistPage({});
const editorScroll = editor.props.children.find((node: any) => node?.type === 'top-fade').props.children;
assert.equal(editorScroll.props.children, undefined, 'The embedded favorites editor must not add a second header');
assert.equal(Object.assign({}, ...editorScroll.props.contentContainerStyle).paddingTop, 24,
  'The embedded editor must not apply a second top safe area');

exported.WatchlistPage({ title: 'Movie Night', actions: 'menu' });
assert.equal(nativeOptions.header, undefined, 'Ending a drag must restore the native header');
const previousOptions = nativeOptions;
exported.WatchlistPage({});
assert.equal(nativeOptions, previousOptions, 'An embedded editor must not replace its parent header controls');
