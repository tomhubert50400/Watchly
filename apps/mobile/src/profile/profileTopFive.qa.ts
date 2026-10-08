import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { buildTopFiveItems } from './profileTopFiveModel';
import { moveFavorite } from './profileMediaModel';

const selection = [{ contentType: 'series' as const, tmdbId: 42 }, { contentType: 'movie' as const, tmdbId: 42 },
  { contentType: 'movie' as const, tmdbId: 603 }, { contentType: 'series' as const, tmdbId: 1399 },
  { contentType: 'movie' as const, tmdbId: 550 }];
assert.deepEqual(buildTopFiveItems(selection.slice(0, 2)).map((item) => item.key), ['series:42', 'movie:42']);
const slots: any[] = [];
let cursor = 0;
const modules: Record<string, unknown> = {
  react: {
    useMemo: (compute: Function) => compute(), useEffect: () => {},
    useRef: (current: unknown) => { const index = cursor++; slots[index] ??= { current }; return slots[index]; },
    useState: (initial: unknown) => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (value: unknown) => { slots[index] = value; }];
    },
  },
  'react/jsx-runtime': { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) },
  'react-native': { View: 'view', Text: 'text', Pressable: 'pressable', StyleSheet: { create: (styles: unknown) => styles } },
  'lucide-react-native': { Crown: 'crown' },
  'react-native-svg': { __esModule: true, default: 'svg', Defs: 'defs', Ellipse: 'ellipse', LinearGradient: 'linearGradient', Path: 'path', RadialGradient: 'radialGradient', Rect: 'rect', Stop: 'stop' },
  '../catalogue/CatalogueTitlePicker': { CatalogueTitlePicker: 'picker' },
  '../components/BottomActionSheet': { BottomActionSheet: 'sheet', BottomActionSheetScrollView: 'scroll' },
  '../components/Button': { Button: 'button' }, '../components/MediaPoster': { MediaPoster: 'poster' },
  '../design/tokens': { colors: {}, radii: {}, spacing: {}, typography: {} },
  './profileMediaModel': { moveFavorite }, './profileTopFiveModel': { buildTopFiveItems },
  './useHydratedProfileMediaItems': {
    useHydratedProfileMediaItems: (items: ReturnType<typeof buildTopFiveItems>) => items.map((item) => ({ ...item, title: `${item.contentType} ${item.tmdbId}` })),
    getProfileMediaDisplayTitle: (item: { title: string }) => item.title,
  },
};
const exported: Record<string, Function> = {};
runInNewContext(ts.transpileModule(readFileSync(new URL('./ProfileTopFive.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: exported, Error, require: (name: string) => { assert.ok(name in modules, name); return modules[name]; } });
function nodes(node: any): any[] {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children), ...nodes(node.props?.footer)];
}

async function run() {
  let calls = 0;
  let saved: unknown;
  let release!: () => void;
  let fail = false;
  const props = { selection, candidates: Array.from({ length: 5000 }, (_, index) => ({ ...buildTopFiveItems(selection)[0], key: `movie:${index + 1}`, contentType: 'movie', tmdbId: index + 1 })), onOpen: () => {}, onSave: async (items: unknown) => {
    calls++;
    saved = items;
    await new Promise<void>((resolve) => { release = resolve; });
    if (fail) throw new Error('Offline');
    return items;
  } };
  const render = () => { cursor = 0; return nodes(exported.ProfileTopFive(props)); };
  const button = (label: string) => render().find((node) => node.props?.label === label || node.props?.accessibilityLabel === label);
  const sheet = () => render().find((node) => node.type === 'sheet');
  button('Edit').props.onPress();
  assert.equal(render().find((node) => node.type === 'picker').props.limit, 5);
  assert.equal(render().find((node) => node.type === 'picker').props.items.length, 25, 'Only 25 profile titles are passed to the modal picker');
  assert.equal(button('Move series 42 up').props.disabled, true);
  button('Move movie 42 up').props.onPress();
  const save = button('Save Top 5').props.onPress;
  save(); save();
  assert.equal(calls, 1, 'duplicate taps cannot start concurrent saves');
  assert.deepEqual(JSON.parse(JSON.stringify(saved)), [selection[1], selection[0], ...selection.slice(2)]);
  sheet().props.onClose();
  assert.equal(sheet().props.visible, true, 'saving keeps the draft until the result arrives');
  release(); await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(sheet().props.visible, false);
  button('Edit').props.onPress();
  button('Remove movie 42 from Top 5').props.onPress();
  assert.equal(button('Save Top 5').props.disabled, true);
  button('Save Top 5').props.onPress();
  assert.equal(calls, 1, 'incomplete drafts cannot save even if the handler is called');
  sheet().props.onClose();
  button('Edit').props.onPress();
  assert.equal(render().find((node) => node.type === 'picker').props.selected.length, 5, 'closing discards unsaved edits');
  fail = true;
  button('Move series 42 up').props.onPress();
  button('Save Top 5').props.onPress();
  release(); await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(sheet().props.visible, true);
  assert.ok(render().some((node) => node.props?.children === 'Offline'), 'errors keep the editor available for retry');
  slots.length = 0; cursor = 0;
  const opened: string[] = [];
  const publicTree = nodes(exported.ProfileTopFive({ selection, onOpen: (item: { key: string }) => opened.push(item.key) }));
  assert.ok(!publicTree.some((node) => node.props?.label === 'Edit' || node.props?.accessibilityLabel === 'Edit'));
  assert.equal(publicTree.filter((node) => node.type === 'pressable').length, 5, 'public cards open titles without edit controls');
  const crown = publicTree.find((node) => node.type === 'crown');
  const crownBadge = publicTree.find((node) => Array.isArray(node.props?.children) && node.props.children.includes(crown));
  const badgeStyle = Object.assign({}, ...crownBadge.props.style.filter(Boolean));
  assert.equal(badgeStyle.borderWidth, 0, 'The crown replaces the circular first-place badge');
  assert.equal(badgeStyle.backgroundColor, 'transparent');
  const winnerNumber = crownBadge.props.children.find((node: any) => node?.type === 'text');
  const numberStyle = Object.assign({}, ...winnerNumber.props.style.filter(Boolean));
  assert.equal(winnerNumber.props.children, 1);
  assert.equal(crown.props.fill, '#000000', 'The crown has a black background');
  assert.equal(numberStyle.color, crown.props.color, 'The number matches the crown outline');
  assert.ok(numberStyle.top >= 0 && numberStyle.top + numberStyle.lineHeight <= crown.props.size,
    'The first-place number sits inside the crown');
  assert.deepEqual(publicTree.filter((node) => node.type === 'pressable').map((node) => node.props.accessibilityLabel),
    ['Number 4: series 1399', 'Number 2: movie 42', 'Number 1: series 42', 'Number 3: movie 603', 'Number 5: movie 550'],
    'The podium centers first place without changing the saved ranks');
  publicTree.filter((node) => node.type === 'pressable').forEach((node) => node.props.onPress());
  assert.deepEqual(opened, ['series:1399', 'movie:42', 'series:42', 'movie:603', 'movie:550'],
    'Each podium position opens its corresponding title');
  publicTree.filter((node) => node.type === 'pressable').forEach((card) => {
    const title = card.props.accessibilityLabel.replace(/^Number \d+: /, '');
    assert.ok(nodes(card).some((node) => node.type === 'text' && node.props.children === title),
      'Each podium includes its own title inside the tappable card');
  });
  for (let count = 0; count < 5; count++) {
    slots.length = 0; cursor = 0;
    assert.equal(exported.ProfileTopFive({ selection: selection.slice(0, count), onOpen: props.onOpen }), null);
    slots.length = 0; cursor = 0;
    const ownerTree = nodes(exported.ProfileTopFive({ ...props, selection: selection.slice(0, count) }));
    assert.ok(ownerTree.some((node) => node.props?.children === 'Your favorites, your story'));
    assert.ok(ownerTree.some((node) => node.props?.children === 'Add the movies and shows that define you.'));
    assert.ok(!ownerTree.some((node) => node.type === 'poster'), 'incomplete profiles show no poster slots');
    ownerTree.find((node) => node.props?.accessibilityLabel === 'Create your Top 5').props.onPress();
    cursor = 0;
    const draftTree = nodes(exported.ProfileTopFive({ ...props, selection: selection.slice(0, count) }));
    assert.equal(draftTree.find((node) => node.props?.label === 'Save Top 5').props.disabled, true);
    assert.equal(draftTree.find((node) => node.type === 'picker').props.emptyLabel, '');
  }
  const source = readFileSync(new URL('./ProfileTopFive.tsx', import.meta.url), 'utf8');
  assert.ok(!source.includes('Your all-time favorites') && !source.includes('Move them into your preferred order'));
  const body = readFileSync(new URL('./ProfileBody.tsx', import.meta.url), 'utf8');
  assert.ok(body.indexOf('{topFive}') < body.indexOf('<ViewingStatsSummaryCard'));
  console.log('Profile Top 5 mobile QA passed: ordering, cancellation, save errors, duplicate submits and public display.');
}
void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
