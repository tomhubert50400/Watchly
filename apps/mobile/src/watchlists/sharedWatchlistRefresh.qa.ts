// @ts-expect-error QA executes under tsx/Node.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as voteModel from './sharedVoteModel';
import * as watchlistCover from './watchlistCover';

const code = ts.transpileModule(readFileSync(new URL('./SharedWatchlistScreen.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;
const noop = () => {};
const slots: any[] = [];
let cursor = 0;
let focused = true;
let revision = 0;
let requests = 0;
let effects: Array<() => void> = [];
let pending: Promise<void> = Promise.resolve();
let load: Function;
const item = (id: number) => ({ id: String(id), contentType: 'movie', tmdbId: id });
let serverItems = [item(1), item(2)];
const watchlist = { id: 'shared-list', items: [], votingSessions: [] as any[], members: [], memberCount: 1, isOwner: false };
let data: any = { watchlist, hydratedItems: [] };
const getToken = async () => 'token';
const refreshMovie = async () => ({ title: 'Film', posterUrl: 'poster', backdropUrl: null });
const sameDeps = (a: unknown[] | undefined, b: unknown[]) => a?.length === b.length && a.every((value, i) => Object.is(value, b[i]));
const useCallback = (callback: Function, deps: unknown[]) => {
  const index = cursor++;
  if (!sameDeps(slots[index]?.deps, deps)) slots[index] = { callback, deps };
  return slots[index].callback;
};
const useEffect = (create: Function, deps: unknown[]) => {
  const index = cursor++;
  if (!sameDeps(slots[index]?.deps, deps)) effects.push(() => {
    slots[index]?.cleanup?.();
    slots[index] = { deps, cleanup: create() };
  });
};
const revalidate = () => { pending = load(data).then((next: unknown) => { data = next; }); };
const moduleExports: Record<string, Function> = {};
const memory = new Map<string, any>();
const disk = new Map<string, any>();
const modules: Record<string, unknown> = {
  react: {
    useCallback, useEffect, useLayoutEffect: useEffect,
    useMemo: (compute: Function, deps: unknown[]) => {
      const index = cursor++;
      if (!sameDeps(slots[index]?.deps, deps)) slots[index] = { value: compute(), deps };
      return slots[index].value;
    },
    useRef: (current: unknown) => { const index = cursor++; slots[index] ??= { current }; return slots[index]; },
    useState: (initial: unknown) => {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, (value: unknown) => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }];
    },
  },
  'react/jsx-runtime': { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) },
  '@react-navigation/native': { useFocusEffect: (callback: Function) => useEffect(() => focused ? callback() : undefined, [focused, callback]) },
  '@react-navigation/elements': { useHeaderHeight: () => 104 },
  'react-native': { Platform: { OS: 'ios' }, StyleSheet: { create: (styles: unknown) => styles }, Keyboard: { dismiss: noop }, Switch: 'switch', Pressable: 'pressable' },
  'lucide-react-native': {},
  '../auth/AuthSessionContext': { useAuthSession: () => ({ currentUser: { id: 'user' }, firebaseIdToken: 'token', getFirebaseIdToken: getToken }) },
  '../catalogue/CatalogueCacheContext': { useCatalogueCache: () => ({ refreshMovie, refreshSeries: refreshMovie }) },
  '../api/sharedWatchlists': { getSharedWatchlist: async () => { requests++; return { ...watchlist, items: [...serverItems] }; } },
  '../cache/persistedCache': { getPrivateCacheKey: (owner: string, key: string) => `${owner}:${key}`,
    readPersistedCache: async (key: string) => disk.get(key) ?? null,
    writePersistedCache: async (key: string, value: any) => { disk.set(key, { data: value, savedAt: new Date().toISOString() }); } },
  '../cache/memoryResourceCache': { getMemoryResource: (key: string) => memory.get(key),
    setMemoryResource: (key: string, value: any, savedAt: string) => memory.set(key, { data: value, savedAt }) },
  // Simulate a fresh empty cache: only explicit revalidation can fetch newly added titles.
  '../cache/useCachedResource': { useCachedResource: (options: { load: Function }) => { load = options.load; return { data, revalidate, retry: revalidate }; } },
  '../sync/userDataEvents': { useUserDataRevision: (domain: string) => { assert.equal(domain, 'watchlists'); return revision; } },
  '../sync/titleRemovalUpdates': { useTitleRemovalUpdates: () => 0, isTitleRemoved: () => false },
  './WatchlistTrashHeader': { useWatchlistTrashHeader: () => ({}) },
  './InlineSharedVote': { InlineSharedVote: 'inline-vote' },
  './VoteTitlePicker': { VoteTitlePicker: 'title-picker', voteMediaKey: (item: any) => `${item.contentType}:${item.tmdbId}` },
  './CreateSharedVoteSheet': { CreateSharedVoteSheet: 'vote-sheet' },
  '../components/SectionHeader': { SectionHeader: 'section-header' },
  '../components/SegmentedControl': { SegmentedControl: 'segmented-control' },
  '../components/TextInput': { TextInput: 'input' },
  '../components/Button': { Button: 'button' },
  '../components/BottomActionSheet': { BottomActionSheet: 'sheet', BottomActionSheetScrollView: 'sheet-scroll' },
  './sharedVoteModel': voteModel,
  './watchlistCover': watchlistCover,
  './useWatchlistRemoval': { useWatchlistRemoval: () => ({}) },
  './personalWatchlistHydration': { hydrateWatchlistItems: async () => {} },
  './WatchlistFilters': { useWatchlistFilters: (items: unknown[]) => ({ visibleItems: items }) },
  './WatchlistDetailLayout': { WatchlistPage: 'page', WatchlistSection: 'section', WatchlistPosterGrid: 'grid' },
  '../feedback/haptics': { hapticSuccess: noop, hapticError: noop },
  '../design/tokens': { colors: {}, spacing: {}, radii: {}, typography: { body: {}, meta: {} } },
};
const expansionExports: Record<string, Function> = {};
runInNewContext(ts.transpileModule(readFileSync(new URL('./useVoteExpansion.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: expansionExports, require: (key: string) => modules[key] });
modules['./useVoteExpansion'] = expansionExports;
runInNewContext(code, { setInterval: () => 1, clearInterval: noop, exports: moduleExports, require: (name: string) => {
  if (name in modules) return modules[name];
  if (name.startsWith('../components/') || name.startsWith('./Watchlist') || [
    '../auth/SignInRequired', '../feedback/haptics', './watchlistTrashTarget', './sharedVoteModel',
  ].includes(name)) return {};
  throw new Error(`Unexpected import ${name}`);
} });
let selectedView: 'titles' | 'votes' = 'titles';
const navigation = { setParams: (params: any) => { selectedView = params.view; } };
function render() {
  cursor = 0; effects = [];
  const tree = moduleExports.SharedWatchlistScreen({ navigation, route: { params: { watchlistId: 'shared-list', view: selectedView } } });
  effects.forEach(effect => effect());
  return tree;
}
function gridItems(node: any): any[] | undefined {
  if (!node || typeof node !== 'object') return undefined;
  if (node.type === 'grid') return node.props.items;
  const children = node.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = gridItems(child);
    if (found) return found;
  }
  return undefined;
}
async function settle() {
  await pending;
  render();
  return gridItems(render()) ?? [];
}
function nodes(node: any): any[] {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children), ...nodes(node.props?.footer)];
}
void (async () => {
  render();
  assert.equal((await settle()).length, 2, 'opening a cached empty list must display titles added since the cache was saved');
  assert.equal(requests, 1, 'ordinary renders must not repeatedly reload the list');
  focused = false;
  render();
  serverItems.push(item(3));
  revision++;
  render();
  assert.equal(requests, 1, 'updates must wait while the screen is away');
  focused = true;
  render();
  assert.equal((await settle()).length, 3, 'returning from Add titles must refresh the grid');
  serverItems.push(item(4));
  revision++;
  render();
  assert.equal((await settle()).length, 4, 'watchlist updates while focused must refresh the grid');
  assert.equal(requests, 3);
  const session = { id: 'active', candidates: [], closesAt: new Date(Date.now() + 60_000).toISOString(), status: 'OPEN' };
  watchlist.votingSessions = [session, { ...session, id: 'past', status: 'CLOSED' }];
  data = { ...data, watchlist: { ...data.watchlist, votingSessions: watchlist.votingSessions } };
  render();
  const ordered = nodes(render()).filter(node => node.type === 'section-header' || node.props?.accessibilityRole === 'header')
    .map(node => node.props.title ?? node.props.children);
  assert.deepEqual(ordered, ['Votes'], 'Titles and Votes use the shared selector without a duplicate Titles heading');
  const tabs = () => nodes(render()).find(node => node.type === 'segmented-control');
  const panel = (childType: string) => nodes(render()).find(node => node.props?.importantForAccessibility && nodes(node.props.children).some(child => child.type === childType));
  const page = () => nodes(render()).find(node => node.type === 'page');
  assert.equal(page().props.topInset, undefined, 'Shared lists must leave safe-area spacing to the shared page shell');
  const scrollPositions: number[] = [];
  page().props.scrollRef.current = { scrollTo: ({ y }: { y: number }) => scrollPositions.push(y) };
  assert.equal(tabs().props.value, 'titles');
  assert.equal(panel('grid').props.accessibilityElementsHidden, false);
  assert.equal(panel('inline-vote').props.accessibilityElementsHidden, true);
  tabs().props.onChange('votes');
  assert.equal(scrollPositions.at(-1), 0, 'Switching tabs must return to the shared header at scroll offset zero');
  assert.equal(page().props.topInset, undefined, 'Both tabs must leave safe-area spacing to the shared page shell');
  assert.equal(panel('grid').props.accessibilityElementsHidden, true);
  assert.equal(panel('inline-vote').props.accessibilityElementsHidden, false);
  assert.equal(nodes(render()).filter(node => node.type === 'inline-vote').length, 2, 'active votes and past results render on the watchlist page');
  (modules['../sync/userDataEvents'] as any).notifyUserDataChanged = noop;
  let rejectDismiss!: (reason: Error) => void;
  (modules['../api/sharedWatchlists'] as any).dismissSharedVotingSession = () => new Promise((_resolve, reject) => { rejectDismiss = reject; });
  const pastNode = nodes(render()).find(node => node.type === 'inline-vote' && node.props.session.id === 'past');
  pastNode.props.onDismiss(pastNode.props.session);
  assert.ok(!nodes(render()).some(node => node.type === 'inline-vote' && node.props.session.id === 'past'), 'Dismissal hides the result before the server responds');
  await new Promise(resolve => setTimeout(resolve, 0)); rejectDismiss(new Error('Offline')); await new Promise(resolve => setTimeout(resolve, 0));
  assert.ok(nodes(render()).some(node => node.type === 'inline-vote' && node.props.session.id === 'past'), 'A failed dismissal restores the result');
  (modules['../api/sharedWatchlists'] as any).dismissSharedVotingSession = async () => {
    watchlist.votingSessions = watchlist.votingSessions.filter(vote => vote.id !== 'past');
    return { hidden: true };
  };
  const restored = nodes(render()).find(node => node.type === 'inline-vote' && node.props.session.id === 'past');
  restored.props.onDismiss(restored.props.session);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.ok(!nodes(render()).some(node => node.type === 'inline-vote' && node.props.session.id === 'past'));
  const createAction = page().props.actions.props.actions.find((action: any) => action.label === 'New vote');
  assert.ok(createAction, 'a non-owner member must have the New vote menu action');
  createAction.onPress();
  assert.ok(nodes(render()).some(node => node.type === 'vote-sheet'), 'the menu must open the creation modal');

  (modules['../api/sharedWatchlists'] as any).createSharedVotingSession = async () => {
    const created = { ...session, id: 'new-vote', title: 'New' };
    watchlist.votingSessions = [created, ...watchlist.votingSessions];
    return created;
  };
  (modules['../sync/userDataEvents'] as any).notifyUserDataChanged = noop;
  modules['../feedback/haptics'] = { hapticSuccess: noop, hapticError: noop };
  await nodes(render()).find(node => node.type === 'vote-sheet').props.onCreate({ title: 'New', durationMinutes: 60, isAnonymous: true, allowMultipleVotes: false, items: [{ ...item(1), title: 'Film', posterUrl: null }] });
  assert.ok(!nodes(render()).some(node => node.type === 'vote-sheet'), 'Successful creation closes the modal without navigating away');
  assert.ok(nodes(render()).some(node => node.type === 'inline-vote' && node.props.session.id === 'new-vote'), 'The created vote appears immediately on the base page');

  // A delayed refresh from an earlier choice must not replace newer optimistic choices.
  const currentVotes = () => nodes(render()).filter(node => node.type === 'inline-vote');
  const changeVote = (id: string, value: any, persist = false) => currentVotes().find(node => node.props.session.id === id).props.onChange(value, { persist });
  const first = { ...session, candidates: [{ ...item(1), itemId: '1', voteCount: 1, userHasVoted: true }] };
  const second = { ...session, id: 'new-vote', candidates: [{ ...item(2), itemId: '2', voteCount: 1, userHasVoted: true }] };
  let serverVotes = [first, { ...second, candidates: second.candidates.map(row => ({ ...row, voteCount: 0, userHasVoted: false })) }];
  let releaseRefresh!: () => void;
  let delayRefresh = true;
  (modules['../api/sharedWatchlists'] as any).getSharedWatchlist = async () => {
    const snapshot = { ...watchlist, items: [...serverItems], votingSessions: serverVotes };
    if (delayRefresh) await new Promise<void>(resolve => { releaseRefresh = resolve; });
    return snapshot;
  };
  changeVote('active', first, true);
  revalidate();
  await new Promise(resolve => setTimeout(resolve, 0));
  const newer = { ...first, candidates: [...first.candidates, { ...item(3), itemId: '3', voteCount: 1, userHasVoted: true }] };
  changeVote('active', newer);
  changeVote('new-vote', second);
  tabs().props.onChange('titles');
  assert.equal(currentVotes().length, 2, 'Switching tabs keeps pending vote components mounted');
  tabs().props.onChange('votes');
  nodes(render()).find(node => node.props?.accessibilityLabel === 'Collapse votes').props.onPress();
  assert.equal(currentVotes().length, 2, 'Collapsing the section keeps the saving vote components mounted');
  assert.ok(nodes(render()).some(node => node.props?.accessibilityElementsHidden === true && [node.props.style].flat().some((style: any) => style?.display === 'none')));
  releaseRefresh();
  await settle();
  assert.equal(currentVotes().find(node => node.props.session.id === 'active').props.session.candidates.length, 2,
    'A refresh started before the second choice must not make that choice disappear');
  changeVote('active', newer, true);
  data = { ...data };
  render();
  assert.equal(currentVotes().find(node => node.props.session.id === 'new-vote').props.session.candidates[0].userHasVoted, true,
    'Finishing one vote must preserve the optimistic choice in another vote');
  changeVote('new-vote', second, true);
  // A stale response arriving after confirmation is also rejected, then refreshed.
  revalidate();
  await new Promise(resolve => setTimeout(resolve, 0));
  const third = { ...newer, candidates: [...newer.candidates, { ...item(4), itemId: '4', voteCount: 1, userHasVoted: true }] };
  changeVote('active', third);
  changeVote('active', third, true);
  delayRefresh = false;
  serverVotes = [third, second];
  releaseRefresh();
  await pending;
  render();
  assert.equal(currentVotes().find(node => node.props.session.id === 'active').props.session.candidates.length, 3,
    'A stale refresh arriving after confirmation must not undo the third choice');
  await settle();
  serverVotes = [{ ...third, candidates: third.candidates.map(row => ({ ...row, voteCount: 2 })) }, second];
  revalidate();
  await settle();
  assert.equal(currentVotes().find(node => node.props.session.id === 'active').props.session.candidates[0].voteCount, 2,
    'Fresh server responses still include votes from other members');
  nodes(render()).find(node => node.props?.accessibilityLabel === 'Expand votes').props.onPress();
  assert.ok(nodes(render()).some(node => node.props?.accessibilityElementsHidden === false));

  let rejectDelete!: (reason: Error) => void;
  (modules['../api/sharedWatchlists'] as any).deleteSharedVotingSession = () => new Promise((_resolve, reject) => { rejectDelete = reject; });
  const createdVote = { ...third, isCreator: true };
  changeVote('active', createdVote, true);
  currentVotes().find(node => node.props.session.id === 'active').props.onDelete(createdVote);
  assert.ok(!currentVotes().some(node => node.props.session.id === 'active'), 'Deleting hides the vote immediately');
  await new Promise(resolve => setTimeout(resolve, 0));
  rejectDelete(new Error('Offline'));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.ok(currentVotes().some(node => node.props.session.id === 'active'), 'Failed deletion restores the vote');

  // Persist independent account/list/vote choices, and ignore late reads after a tap.
  slots.length = 0;
  const expansion = (user = 'user', list = 'list', target = 'section', initial = true) => {
    cursor = 0; effects = [];
    const value = expansionExports.useVoteExpansion(user, list, target, initial);
    effects.forEach(effect => effect());
    return value;
  };
  assert.equal(expansion()[0], true);
  expansion()[1]();
  assert.equal(expansion()[0], false);
  slots.length = 0;
  assert.equal(expansion()[0], false, 'Reopening uses the memory choice immediately');
  slots.length = 0; memory.clear();
  expansion(); await Promise.resolve();
  assert.equal(expansion()[0], false, 'Restarting restores the stored choice');
  assert.equal(expansion('other-user')[0], true, 'Account choices are isolated');
  assert.equal(expansion('user', 'other-list')[0], true, 'List choices are isolated');
  assert.equal(expansion('user', 'list', 'vote-2')[0], true, 'Each vote has its own choice');
  const storage = modules['../cache/persistedCache'] as any;
  const read = storage.readPersistedCache;
  let resolveRead!: (value: any) => void;
  storage.readPersistedCache = () => new Promise(resolve => { resolveRead = resolve; });
  expansion('user', 'list', 'slow-vote')[1]();
  resolveRead({ data: true, savedAt: new Date().toISOString() }); await Promise.resolve();
  assert.equal(expansion('user', 'list', 'slow-vote')[0], false, 'A late disk read cannot reverse a tap');
  storage.readPersistedCache = read;

  // Exercise the actual modal with 11 titles, custom options and repeated submit taps.
  slots.length = 0;
  const sheetCode = ts.transpileModule(readFileSync(new URL('./CreateSharedVoteSheet.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const sheetExports: Record<string, Function> = {};
  runInNewContext(sheetCode, { exports: sheetExports, require: (name: string) => modules[name] ?? {} });
  const submissions: any[] = [];
  let finish!: () => void;
  const sheetProps = { items: Array.from({ length: 11 }, (_, i) => ({ ...item(i + 1), title: `Title ${i + 1}` })),
    error: null, isCreating: false, onClose: noop, onCreate: (value: unknown) => {
      submissions.push(value); return new Promise<void>(resolve => { finish = resolve; });
    } };
  const sheet = () => { cursor = 0; return nodes(sheetExports.CreateSharedVoteSheet(sheetProps)); };
  const picker = () => sheet().find(node => node.type === 'title-picker');
  assert.equal(picker().props.selected.length, 10);
  assert.equal(picker().props.limit, 10);
  picker().props.onChange([...picker().props.selected.slice(1), sheetProps.items[10]]);
  sheet().find(node => node.type === 'input').props.onChangeText('Team choice');
  sheet().filter(node => node.props?.accessibilityRole === 'radio')[1].props.onPress();
  sheet().find(node => node.type === 'switch').props.onValueChange(false);
  sheet().find(node => node.props?.accessibilityLabel === 'Multiple votes').props.onValueChange(false);
  const submit = sheet().find(node => node.type === 'button').props.onPress;
  submit(); submit();
  assert.equal(submissions.length, 1, 'repeated taps must create only one vote');
  assert.equal(submissions[0].title, 'Team choice');
  assert.equal(submissions[0].durationMinutes, 60);
  assert.equal(submissions[0].isAnonymous, false);
  assert.equal(submissions[0].allowMultipleVotes, false);
  assert.equal(submissions[0].items.length, 10);
  assert.ok(submissions[0].items.some((row: any) => row.id === '11') && !submissions[0].items.some((row: any) => row.id === '1'));
  finish();
  await Promise.resolve();
  const loadComponent = (file: string, name: string) => {
    const output = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const exported: Record<string, Function> = {};
    runInNewContext(output, { setTimeout, clearTimeout, exports: exported, require: (key: string) => modules[key] ?? {} });
    return exported[name];
  };
  const native = modules['react-native'] as any;
  let dismissed = 0;
  native.Keyboard.dismiss = () => { dismissed++; };
  const Search = loadComponent('./WatchlistSearchField.tsx', 'WatchlistSearchField');
  let query = 'Matrix';
  const search = () => nodes(Search({ value: query, label: 'Search accounts', placeholder: '', onChangeText: (value: string) => { query = value; } }));
  search().find(node => node.props?.accessibilityRole === 'button').props.onPressIn();
  assert.equal(query, '', 'The first touch must clear before waiting for keyboard dismissal');
  assert.equal(dismissed, 1);
  assert.ok(!search().some(node => node.props?.accessibilityRole === 'button'), 'The cross disappears when empty');

  slots.length = 0;
  modules['./WatchlistSearchField'] = { WatchlistSearchField: 'search' };
  let pickerItems = sheetProps.items;
  let selection = pickerItems.slice(0, 10);
  let globalQuery = '';
  modules['../api/catalogue'] = { searchCatalogue: async (query: string) => { globalQuery = query; return { items: [{ id: 'global', title: 'Alien', mediaType: 'movie', tmdbId: 348, posterUrl: 'alien.jpg' }] }; } };
  // Reload after installing the catalogue stub, as CommonJS imports capture its object.
  modules['../watchlists/WatchlistSearchField'] = modules['./WatchlistSearchField'];
  const CataloguePicker = loadComponent('../catalogue/CatalogueTitlePicker.tsx', 'CatalogueTitlePicker');
  const renderPicker = (appearance = 'default', disabled = false) => { cursor = 0; effects = []; const tree = nodes(CataloguePicker({ items: pickerItems, selected: selection, limit: appearance === 'top-five' ? 5 : 10, appearance, disabled, onChange: (next: typeof selection) => { selection = next; } })); effects.forEach(effect => effect()); return tree; };
  assert.equal(renderPicker().find(node => node.props?.accessibilityLabel === 'Title 11').props.disabled, true);
  renderPicker().find(node => node.props?.accessibilityLabel === 'Title 1').props.onPress();
  assert.equal(renderPicker().find(node => node.props?.accessibilityLabel === 'Title 11').props.disabled, false);
  renderPicker().find(node => node.type === 'search').props.onChangeText('Alien');
  renderPicker();
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.equal(globalQuery, 'Alien');
  renderPicker().find(node => node.props?.accessibilityLabel === 'Alien').props.onPress();
  assert.equal(selection.length, 10, 'Global search preserves selected watchlist titles');
  assert.ok(selection.some(row => row.tmdbId === 348), 'A title outside the watchlist is selectable');

  slots.length = 0;
  pickerItems = Array.from({ length: 5000 }, (_, index) => ({
    id: `large-${index}`, contentType: 'movie', tmdbId: index + 1, title: `Library title ${index + 1}`, posterUrl: null,
  }));
  selection = [];
  const posterCount = () => renderPicker().filter(node => node.props?.accessibilityRole === 'checkbox').length;
  assert.equal(posterCount(), 24, 'Opening a large library must mount only the first 24 poster cards');
  renderPicker().find(node => node.props?.label === 'Show more titles').props.onPress();
  assert.equal(posterCount(), 48, 'More titles are mounted only when requested');
  renderPicker().find(node => node.type === 'search').props.onChangeText('Library title 5000');
  const lastTitle = renderPicker().find(node => node.props?.accessibilityLabel === 'Library title 5000');
  assert.ok(lastTitle, 'Search must include titles outside the mounted batch');
  lastTitle.props.onPress();
  assert.equal(selection[0].tmdbId, 5000);
  renderPicker().find(node => node.type === 'search').props.onChangeText('');
  assert.equal(posterCount(), 24, 'Changing the query resets the visible batch');
  assert.equal(selection[0].tmdbId, 5000, 'Changing the visible batch preserves the selected title');
  assert.equal(renderPicker('top-five').filter(node => node.props?.accessibilityRole === 'checkbox').length, 25, 'Top 5 shows at most 25 profile titles');
  assert.ok(!renderPicker('top-five').some(node => node.props?.label === 'Show more titles'), 'Top 5 cannot load more profile titles');
  renderPicker('top-five').find(node => node.props?.accessibilityLabel === 'Library title 1').props.onPress();
  const rankedCard = renderPicker('top-five').find(node => node.props?.accessibilityLabel === 'Library title 1');
  assert.ok(nodes(rankedCard).some(node => node.props?.children === 2), 'Selected Top 5 posters display their current rank');
  const fullProfileItems = pickerItems;
  pickerItems = pickerItems.slice(0, 3);
  assert.equal(renderPicker('top-five').filter(node => node.props?.accessibilityRole === 'checkbox').length, 3, 'A small profile is not padded with selected or catalogue titles');
  pickerItems = [];
  assert.equal(renderPicker('top-five').filter(node => node.props?.accessibilityRole === 'checkbox').length, 0, 'An empty profile stays empty before searching');
  renderPicker('top-five').find(node => node.type === 'search').props.onChangeText('Alien');
  renderPicker('top-five');
  await new Promise(resolve => setTimeout(resolve, 300));
  const globalTitle = renderPicker('top-five').find(node => node.props?.accessibilityLabel === 'Alien');
  assert.ok(globalTitle, 'Top 5 searches the global catalogue even with an empty profile');
  assert.ok(globalTitle.props.style.some((style: any) => style?.flexDirection === 'row' && style.width === '100%'), 'Top 5 search results use full-width rows');
  const previousSelection = selection;
  selection = fullProfileItems.slice(0, 5);
  const choices = () => renderPicker('top-five').filter(node => node.props?.accessibilityLabel?.endsWith('from selection'));
  assert.deepEqual(choices().map(node => node.props.accessibilityLabel), selection.map(item => `Remove ${item.title} from selection`), 'The summary shows all current choices in order during a different search');
  assert.equal(renderPicker('top-five').find(node => node.props?.accessibilityLabel === 'Alien').props.disabled, true);
  assert.ok(renderPicker('top-five', true).filter(node => node.props?.accessibilityLabel?.endsWith('from selection')).every(node => node.props.disabled), 'Saving disables summary removal');
  choices()[1].props.onPress();
  assert.deepEqual(selection.map(item => item.tmdbId), [1, 3, 4, 5], 'Removing a summary poster preserves the remaining order');
  assert.equal(choices().length, 4);
  assert.equal(renderPicker('top-five').find(node => node.type === 'search').props.value, 'Alien', 'Removing a choice preserves the active search');
  assert.equal(renderPicker('top-five').find(node => node.props?.accessibilityLabel === 'Alien').props.disabled, false, 'Removing a choice immediately enables a replacement');
  selection = previousSelection;
  globalTitle.props.onPress();
  assert.ok(selection.some(row => row.tmdbId === 348));
  renderPicker('top-five').find(node => node.type === 'search').props.onChangeText('');
  assert.equal(renderPicker('top-five').filter(node => node.props?.accessibilityRole === 'checkbox').length, 0, 'Clearing global search restores only the profile titles');
  pickerItems = fullProfileItems;
  assert.ok(!renderPicker('top-five').find(node => node.props?.accessibilityLabel === 'Library title 1').props.style.some((style: any) => style?.flexDirection === 'row'), 'Clearing the search restores the profile poster grid');

  slots.length = 0;
  const api = modules['../api/sharedWatchlists'] as any;
  let saved: any = { id: 'vote', title: 'Tonight', status: 'OPEN', closesAt: new Date(Date.now() + 60000).toISOString(), allowMultipleVotes: false, candidates: [
    { id: 'candidate', itemId: '1', contentType: 'movie', tmdbId: 1, userHasVoted: false, voteCount: 0 },
  ] };
  const calls: string[] = [];
  let releaseVote!: () => void;
  api.voteForSharedCandidate = async () => { calls.push('vote'); const snapshot = saved; await new Promise<void>(resolve => { releaseVote = resolve; }); return snapshot; };
  api.removeSharedCandidateVote = async () => { calls.push('remove'); return { ...saved, candidates: saved.candidates.map((row: any) => ({ ...row, userHasVoted: false, voteCount: 0 })) }; };
  api.addSharedVotingCandidates = async (_token: string, listId: string, sessionId: string, titles: any[]) => {
    assert.equal(listId, 'list'); assert.equal(sessionId, 'vote'); assert.equal(titles[0].tmdbId, 2); calls.push('add');
    return { ...saved, candidates: saved.candidates.map((row: any) => row.tmdbId === 2 ? { ...row, id: 'second', itemId: '2' } : row) };
  };
  let dismissedResult: string | null = null;
  let deletedResult: string | null = null;
  let deleteConfirmation: any[] = [];
  native.Alert = { alert: (_title: string, _body: string, buttons: any[]) => { deleteConfirmation = buttons; } };
  const Inline = loadComponent('./InlineSharedVote.tsx', 'InlineSharedVote');
  const renderInline = () => { cursor = 0; effects = []; const tree = nodes(Inline({ session: saved, watchlistId: 'list', items: pickerItems, isOwner: false, now: new Date(), onDelete: (value: any) => { deletedResult = value.id; }, onDismiss: (value: any) => { dismissedResult = value.id; }, onChange: (value: typeof saved) => { saved = value; } })); effects.forEach(effect => effect()); return tree; };
  renderInline().find(node => node.props?.accessibilityLabel?.startsWith('Vote for')).props.onPress();
  assert.equal(saved.candidates[0].userHasVoted, true, 'The selection must update before any backend response');
  assert.equal(renderInline().find(node => node.props?.accessibilityRole === 'progressbar').props.accessibilityValue.now, 100);
  renderInline().find(node => node.props?.accessibilityLabel === 'Collapse active vote').props.onPress();
  assert.ok(!renderInline().some(node => node.props?.accessibilityRole === 'progressbar'), 'An active vote can collapse while its save is pending');
  renderInline().find(node => node.props?.accessibilityLabel === 'Expand active vote').props.onPress();
  assert.equal(renderInline().find(node => node.props?.accessibilityRole === 'progressbar').props.accessibilityValue.now, 100);
  await new Promise(resolve => setTimeout(resolve, 0));
  renderInline().find(node => node.props?.accessibilityLabel?.startsWith('Remove your vote')).props.onPress();
  assert.equal(saved.candidates[0].userHasVoted, false, 'A second tap updates immediately even while the first request is pending');
  releaseVote();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(calls, ['vote', 'remove'], 'Rapid choices save in order');
  assert.equal(saved.candidates[0].userHasVoted, false);
  api.voteForSharedCandidate = async () => { throw new Error('Offline'); };
  renderInline().find(node => node.props?.accessibilityLabel?.startsWith('Vote for')).props.onPress();
  assert.equal(saved.candidates[0].userHasVoted, true);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(saved.candidates[0].userHasVoted, false, 'A failed request restores the confirmed choice');
  renderInline().find(node => node.props?.accessibilityLabel === 'Options for Tonight').props.onPress();
  assert.ok(!renderInline().some(node => node.props?.label === 'Close voting early'));
  assert.ok(!renderInline().some(node => node.props?.label === 'Delete vote'), 'Other members cannot delete a vote');
  renderInline().find(node => node.type === 'title-picker').props.onChange([pickerItems[1]]);
  renderInline().find(node => node.props?.label === 'Add 1 title').props.onPress();
  assert.equal(saved.candidates.length, 2, 'Adding a title must update immediately');
  assert.ok(!renderInline().some(node => node.type === 'sheet'), 'The add modal closes before the backend response');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(saved.candidates.length, 2);
  assert.equal(saved.candidates[1].id, 'second');
  saved = { ...saved, status: 'CLOSED', closedAt: new Date().toISOString() };
  assert.equal(renderInline().filter(node => node.props?.accessibilityRole === 'progressbar').length, 0, 'Completed results start compact, independently of active vote expansion');
  assert.ok(!renderInline().some(node => node.props?.accessibilityLabel === 'Hide vote result for me'), 'Result actions stay inside the expanded detail');
  renderInline().find(node => node.props?.accessibilityLabel === 'Expand vote results').props.onPress();
  assert.equal(renderInline().filter(node => node.props?.accessibilityRole === 'progressbar').length, 2);
  assert.ok(renderInline().filter(node => node.props?.accessibilityLabel?.startsWith('Vote for')).every(node => node.props.disabled));
  renderInline().find(node => node.props?.accessibilityLabel === 'Hide vote result for me').props.onPress();
  assert.equal(dismissedResult, 'vote');
  saved = { ...saved, isCreator: true };
  renderInline().find(node => node.props?.accessibilityLabel === 'Options for Tonight').props.onPress();
  renderInline().find(node => node.props?.label === 'Delete vote').props.onPress();
  assert.equal(deletedResult, null, 'Deletion requires confirming the action');
  deleteConfirmation.find(button => button.text === 'Delete vote').onPress();
  assert.equal(deletedResult, 'vote', 'The creator can delete a completed vote from its options');
  assert.ok(!readFileSync(new URL('./InlineSharedVote.tsx', import.meta.url), 'utf8').includes('Available for 6 hours'));
  console.log('Inline vote QA passed: optimistic vote, rapid toggle queue, rollback, global search, 10-title limit, immediate additions and collapsible results.');
  console.log('Shared watchlist freshness QA passed: stale refresh during and after saves, concurrent sessions, fresh member votes, collapsed pending saves and cached list refresh.');
  console.log('Shared vote UI QA passed: section order, member menu, modal options, title limit and duplicate submit.');
})();
