import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function mount({ owner = true, fail = false } = {}) {
  const state: any[] = [];
  const refs: any[] = [];
  let stateIndex = 0, refIndex = 0;
  let userId = 'owner';
  const changed: string[][] = [];
  const toasts: string[] = [];
  const removed: string[] = [];
  const opened: unknown[] = [];
  let finish!: () => void;
  const waiting = new Promise<void>((resolve) => { finish = resolve; });
  const data = { visibility: 'public', opinions: [], items: [
    { id: 'movie-first', contentType: 'movie', tmdbId: 10, title: 'Movie', watchedAt: '2026-10-01', posterUrl: null },
    { id: 'movie-rewatch', contentType: 'movie', tmdbId: 10, title: 'Movie', watchedAt: '2026-10-02', posterUrl: null },
    { id: 'episode', contentType: 'episode', tmdbId: 20, title: 'Series', seasonNumber: 1, episodeNumber: 2, watchedAt: '2026-10-03', posterUrl: null },
  ] };
  const modules: Record<string, any> = {
    react: {
      useCallback: (callback: Function) => callback, useMemo: (callback: Function) => callback(),
      useRef: (value: unknown) => { const index = refIndex++; return refs[index] ??= { current: value }; },
      useState: (value: unknown) => {
        const index = stateIndex++;
        state[index] ??= value;
        return [state[index], (update: any) => { state[index] = typeof update === 'function' ? update(state[index]) : update; }];
      },
    },
    'react/jsx-runtime': { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) },
    'react-native': { ImageBackground: 'ImageBackground', Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View', StyleSheet: { create: (styles: unknown) => styles } },
    'react-native-svg': { default: 'Svg', Defs: 'Defs', LinearGradient: 'LinearGradient', Rect: 'Rect', Stop: 'Stop' },
    'lucide-react-native': { Globe: 'Globe', Lock: 'Lock' },
    '@react-navigation/native': { useFocusEffect: () => {}, useNavigation: () => ({ navigate: (...args: unknown[]) => opened.push(args) }) },
    '../auth/AuthSessionContext': { useAuthSession: () => ({ currentUser: { id: userId }, getFirebaseIdToken: async () => 'token' }) },
    '../api/client': { ApiError: Error },
    '../api/profile': { getProfileHistory: async () => data },
    '../api/viewings': { removeViewing: async (token: string, id: string) => {
      assert.equal(token, 'token'); removed.push(id); await waiting; if (fail) throw new Error('Offline');
    } },
    '../cache/useCachedResource': { useCachedResource: () => ({ data, revalidate: () => {} }) },
    '../cache/persistedCache': { getPrivateCacheKey: (id: string, key: string) => `${id}:${key}` },
    '../design/tokens': { colors: {}, radii: {}, spacing: {}, typography: {} },
    '../sync/userDataEvents': { useUserDataRevision: () => 0, notifyUserDataChanged: (...domains: string[]) => changed.push(domains) },
    '../sync/titleRemovalUpdates': { useTitleRemovalUpdates: () => 0, isTitleRemoved: () => false },
    '../notifications/ToastContext': { useToast: () => ({ showToast: (message: string) => toasts.push(message) }) },
  };
  for (const name of ['HorizontalScrollFade', 'PosterActionsMenu', 'StarRatingDisplay']) modules[`../components/${name}`] = { [name]: name };
  const exports: Record<string, any> = {};
  const source = readFileSync(new URL('./RecentViewingActivity.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
  runInNewContext(code, { exports, require: (name: string) => { assert(name in modules, name); return modules[name]; } });
  function findMenus(node: any): any[] {
    if (!node) return [];
    if (Array.isArray(node)) return node.flatMap(findMenus);
    if (node.type === 'PosterActionsMenu') return [node.props];
    return findMenus(node.props?.children);
  }
  const render = () => {
    stateIndex = 0; refIndex = 0;
    return findMenus(exports.RecentViewingActivity({ userId: 'owner', owner }));
  };
  return { render, finish, removed, opened, changed, toasts, switchAccount: () => { userId = 'other'; render(); } };
}

const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
async function run() {
  for (const fail of [false, true]) {
    const screen = mount({ fail });
    const menus = screen.render();
    assert.equal(menus.length, 3);
    assert.equal(menus[0].actionLabel, 'Remove viewing');
    menus[0].onOpen();
    assert.equal(screen.opened.length, 1);
    menus[0].onRemove(); menus[0].onRemove();
    assert.equal(screen.render().length, 2, 'the selected viewing disappears immediately while its rewatch remains');
    await settle();
    assert.deepEqual(screen.removed, ['movie-first'], 'duplicate taps send one deletion');
    screen.finish(); await settle();
    assert.equal(screen.render().length, fail ? 3 : 2, 'a failed deletion restores the card');
    assert.equal(screen.toasts.length, fail ? 1 : 0);
    assert.equal(screen.changed.length, fail ? 0 : 1);
    if (!fail) assert(screen.changed[0].includes('viewings') && screen.changed[0].includes('episodeProgress'));
  }
  const visitor = mount({ owner: false });
  assert(visitor.render().every((menu) => !menu.enabled));
  visitor.render()[0].onRemove(); await settle();
  assert.equal(visitor.removed.length, 0, 'a visitor cannot delete activity');
  const changedAccount = mount();
  const staleMenu = changedAccount.render()[0];
  changedAccount.switchAccount(); staleMenu.onRemove(); await settle();
  assert.equal(changedAccount.removed.length, 0, 'a stale card cannot delete after switching accounts');
  console.log('Recent viewing activity QA passed: shared menu, single viewing, optimistic removal, rollback and ownership.');
}
void run().catch((error) => { console.error(error); process.exitCode = 1; });
