import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import './recentViewingActivity.qa';

function mount({ enabled = true, fail = false, kind = 'profile', planned = false, contentType = 'movie', deferred = false, home = false } = {}) {
  const alerts: any[] = [];
  const changed: string[][] = [];
  const toasts: any[] = [];
  let opened = 0;
  let deleted = 0;
  let removedFromList = 0;
  const requests: string[] = [];
  let finishRequest!: () => void;
  const waiting = new Promise<void>((resolve) => { finishRequest = resolve; });
  const modules: Record<string, unknown> = {
    react: { useRef: (current: unknown) => ({ current }), useState: (value: unknown) => [value, () => {}], useSyncExternalStore: (_subscribe: unknown, snapshot: Function) => snapshot() },
    'react/jsx-runtime': { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) },
    'react-native': {
      Pressable: 'Pressable',
      View: 'View', Text: 'Text', ScrollView: 'ScrollView', StyleSheet: { create: (styles: unknown) => styles },
      Alert: { alert: (...args: unknown[]) => alerts.push(args) },
    },
    '../auth/AuthSessionContext': { useAuthSession: () => ({ currentUser: { id: 'owner' }, getFirebaseIdToken: async () => 'token' }) },
    '../api/profile': { removeProfileTitle: async (token: string, type: string, tmdbId: number) => {
      assert.equal(token, 'token'); assert.equal(type, contentType); assert.equal(tmdbId, 550); deleted += 1;
      if (deferred) await waiting;
      if (fail) throw new Error('Offline');
    } },
    '../api/watchlists': { removeWatchlistItem: async (token: string, id: string, type: string, tmdbId: number) => {
      assert.deepEqual([token, id, type, tmdbId], ['token', 'list', contentType, 550]);
      requests.push('personal'); if (deferred) await waiting; if (fail) throw new Error('Offline');
    } },
    '../api/sharedWatchlists': { removeSharedWatchlistItem: async (token: string, id: string, type: string, tmdbId: number) => {
      assert.deepEqual([token, id, type, tmdbId], ['token', 'list', contentType, 550]);
      requests.push('shared'); if (deferred) await waiting; if (fail) throw new Error('Voting is in progress');
    } },
    '../cache/memoryResourceCache': { clearMemoryResourcesWithPrefix: () => {} },
    '../cache/persistedCache': { getPrivateCacheKey: (owner: string, key: string) => `${owner}:${key}`, removePersistedCache: async () => {}, removePersistedCachesWithPrefix: async () => {} },
    '../design/tokens': { colors: { danger: 'red' }, spacing: {}, typography: {} },
    '@react-navigation/native': { useNavigation: () => ({ navigate: () => { opened += 1; } }) },
    '../notifications/ToastContext': { useToast: () => ({ showToast: (...args: unknown[]) => toasts.push(args) }) },
    '../sync/userDataEvents': { notifyUserDataChanged: (...domains: string[]) => changed.push(domains) },
    '../viewings/viewingHistoryUpdates': { setViewingHistoryUpdate: () => {}, getViewingHistoryUpdates: () => [] },
  };
  function load(path: string) {
    const exports: Record<string, any> = {};
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
    runInNewContext(code, { exports, Error, require: (name: string) => { assert(name in modules, name); return modules[name]; } });
    return exports;
  }
  // Gesture, animation and modal lifecycle are exercised by posterActionsMenu.qa.ts.
  modules['../components/PosterActionsMenu'] = { PosterActionsMenu: (props: any) => ({ type: 'PosterActionsMenu', props }) };
  const updates = load('../sync/titleRemovalUpdates.ts');
  modules['../sync/titleRemovalUpdates'] = updates;
  modules['./profileTitleRemoval'] = modules['../profile/profileTitleRemoval'] = load('./profileTitleRemoval.ts');
  modules['../watchlists/useWatchlistRemoval'] = load('../watchlists/useWatchlistRemoval.ts');
  const sharedProps = { children: 'poster', width: 104, onOpen: () => { opened += 1; } };
  const removal = kind !== 'profile' ? load('../watchlists/useWatchlistRemoval.ts').useWatchlistRemoval({
    kind, watchlistId: 'list', name: planned ? 'Planned to Watch' : 'My list', isPlanned: planned, onRemoved: () => { removedFromList += 1; },
  }) : null;
  const drop = () => removal.removeDroppedItem({ id: 'item', title: 'Title', tmdbId: 550, contentType });
  let menu = kind === 'profile'
    ? load('./ProfileTitleMenu.tsx').ProfileTitleMenu({ ...sharedProps, contentType, enabled, label: 'Open title', title: 'Title', tmdbId: 550 })
    : { type: 'unused', props: {} };
  if (home) {
    for (const component of ['HorizontalScrollFade', 'Button', 'InlineStatusBanner', 'LoadingState', 'MediaPoster', 'ScreenReveal', 'SectionHeader']) {
      modules[`../components/${component}`] = { [component]: component };
    }
    modules['../watchlists/watchlistHomeModel'] = load('../watchlists/watchlistHomeModel.ts');
    const tree = load('../home/HomeWatchlists.tsx').HomeWatchlists({
      data: { items: [], lists: [{ id: 'list', kind, name: planned ? 'Planned' : 'My list', isPlanned: planned,
        updatedAt: '2026-10-07', previewItems: [{ contentType, tmdbId: 550, title: 'Title', posterUrl: 'poster' }] }] },
      loading: false, error: null, onRetry: () => {},
    });
    function findPoster(node: any): any {
      if (!node) return null;
      if (Array.isArray(node)) return node.map(findPoster).find(Boolean);
      if (typeof node.type === 'function') return findPoster(node.type(node.props));
      if (node.type === 'PosterActionsMenu') return node;
      return findPoster(node.props?.children);
    }
    menu = findPoster(tree);
    assert(menu, 'Home renders an actionable poster from the real list selector');
  }
  while (typeof menu.type === 'function') menu = menu.type(menu.props);
  const hidden = () => updates.isTitleRemoved('owner', kind === 'profile' ? 'profile' : `${kind}:list`, { contentType, tmdbId: 550 });
  return { menu, drop, alerts, changed, toasts, requests, hidden, finishRequest, removedFromList: () => removedFromList, deleted: () => deleted, opened: () => opened };
}
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
async function run() {
  const own = mount();
  assert.equal(own.menu.props.enabled, true);
  assert.equal(own.menu.props.width, 104);
  own.menu.props.onOpen();
  assert.equal(own.opened(), 1, 'opening still navigates to the movie');
  own.menu.props.onRemove();
  assert.equal(own.deleted(), 0, 'selecting Remove must first show confirmation');
  assert.equal(own.alerts[0][2][0].style, 'cancel');
  own.alerts[0][2][1].onPress();
  own.alerts[0][2][1].onPress();
  await settle();
  assert.equal(own.deleted(), 1, 'duplicate confirmation taps must not repeat deletion');
  assert(own.changed[0].includes('watchlists') && own.changed[0].includes('viewings') && own.changed[0].includes('profile'));
  assert.equal(own.toasts.length, 0, 'successful deletion stays silent');

  const publicCard = mount({ enabled: false });
  assert.equal(publicCard.menu.props.enabled, false, 'public profiles have no removal gesture');
  publicCard.menu.props.onRemove();
  assert.equal(publicCard.alerts.length, 0);

  const failed = mount({ fail: true });
  failed.menu.props.onRemove();
  failed.alerts[0][2][1].onPress();
  await settle();
  assert.equal(failed.changed.length, 0, 'failed deletion must preserve profile data');
  assert.equal(failed.toasts.length, 1);
  assert.notEqual(failed.toasts[0][1], 'success');

  for (const kind of ['personal', 'shared']) {
    const list = mount({ kind });
    list.drop(); list.drop();
    await settle();
    assert.deepEqual(list.requests, [kind]);
    assert.equal(list.removedFromList(), 1);
    assert.equal(list.deleted(), 0, 'ordinary list removal must not call profile deletion');
    assert.equal(list.changed.flat().join(','), 'watchlists');
  }
  const planned = mount({ kind: 'personal', planned: true });
  planned.drop();
  assert.equal(planned.requests.length, 0, 'full profile erasure still needs confirmation after dropping');
  assert.match(planned.alerts[0][1], /ratings, reviews, viewing history/);
  planned.alerts[0][2][1].onPress(); await settle();
  assert.equal(planned.removedFromList(), 1);
  assert(planned.changed.flat().includes('profile') && planned.changed.flat().includes('tracking'));
  const voting = mount({ kind: 'shared', fail: true });
  voting.drop(); await settle();
  assert.equal(voting.removedFromList(), 0, 'a rejected shared removal must keep the visible title');
  assert.equal(voting.changed.length, 0);
  assert.match(voting.toasts[0][0], /Voting/);

  const rail = readFileSync(new URL('./ProfileMediaRail.tsx', import.meta.url), 'utf8');
  assert.match(rail, /enabled=\{canRemoveTitles\}/);
  const grid = readFileSync(new URL('./ProfileMediaScreen.tsx', import.meta.url), 'utf8');
  assert.match(grid, /canRemoveTitles=\{!usesProvidedItems\}/);
  const publicProfile = readFileSync(new URL('./PublicProfileScreen.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(publicProfile, /canRemoveTitles/);
  const series = mount({ contentType: 'series' });
  series.menu.props.onRemove();
  series.alerts[0][2][1].onPress(); await settle();
  assert.equal(series.deleted(), 1);
  assert(series.changed.flat().includes('episodeProgress'));
  const plannedSeries = mount({ contentType: 'series', kind: 'personal', planned: true });
  plannedSeries.drop(); plannedSeries.alerts[0][2][1].onPress(); await settle();
  assert.equal(plannedSeries.removedFromList(), 1);
  assert(plannedSeries.changed.flat().includes('episodeProgress'));
  for (const contentType of ['movie', 'series']) {
    for (const kind of ['personal', 'shared']) {
      for (const planned of kind === 'personal' ? [false, true] : [false]) {
        for (const fail of [false, true]) {
          const home = mount({ home: true, contentType, kind, planned, fail, deferred: true });
          home.menu.props.onOpen();
          assert.equal(home.opened(), 1, 'a Home tap still opens the title');
          assert.equal(home.menu.props.actionLabel, `Remove from ${planned ? 'Planned' : 'My list'}`);
          home.menu.props.onRemove();
          if (planned) {
            assert(!home.hidden(), 'Planned waits for confirmation of profile removal');
            assert.match(home.alerts[0][1], /ratings, reviews, viewing history/);
            home.alerts[0][2][1].onPress();
          } else assert.equal(home.alerts.length, 0);
          assert(home.hidden(), 'Home deletion hides the source membership immediately');
          await settle();
          assert.deepEqual(home.requests, [kind], 'Home sends deletion to the selected source list and media type');
          home.finishRequest(); await settle();
          assert.equal(home.hidden(), !fail, 'a failed Home deletion restores the title');
          assert.equal(home.toasts.length, fail ? 1 : 0, 'only failed Home deletions show a toast');
          assert.equal(home.changed.flat().includes('profile'), planned && !fail);
        }
      }
    }
    for (const kind of ['profile', 'personal', 'shared']) {
      for (const fail of [false, true]) {
        const slow = mount({ contentType, kind, fail, deferred: true });
        if (kind === 'profile') {
          slow.menu.props.onRemove();
          assert.equal(slow.hidden(), false, 'opening confirmation does not hide the title');
          slow.alerts[0][2][1].onPress();
        } else slow.drop();
        assert.equal(slow.hidden(), true, 'the title disappears before token retrieval or server response');
        await settle();
        assert.equal(slow.hidden(), true, 'a slow server cannot make the title reappear');
        assert.equal(slow.removedFromList(), 0, 'server-backed data remains intact until confirmation');
        slow.finishRequest(); await settle();
        assert.equal(slow.hidden(), !fail, 'only a failed request restores the title');
        assert.equal(slow.toasts.length, fail ? 1 : 0, 'only failed profile or watchlist deletions show a toast');
      }
    }
  }
  console.log('Profile and watchlist removal QA passed: menu actions, confirmation, ownership, retained lists, errors and refresh.');
}
void run().catch((error) => { console.error(error); process.exitCode = 1; });
