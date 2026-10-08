import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { posterMenuPosition } from './posterMenuPosition';

const viewport = { width: 390, height: 844, fontScale: 1 };
const insets = { top: 59, bottom: 34, left: 0, right: 0 };
const anchor = { x: 140, y: 200, width: 124, height: 186 };
const below = posterMenuPosition(anchor, viewport, insets, 56);
assert.equal(below.placement, 'below');
assert.equal(below.y, anchor.y + anchor.height * 0.98 + 10);
assert.equal(below.x + below.width / 2, anchor.x + anchor.width / 2);
const above = posterMenuPosition({ ...anchor, y: 610 }, viewport, insets, 90);
assert.equal(above.placement, 'above');
assert.equal(above.y + 90, 610 + anchor.height * 0.02 - 10);
for (const x of [-35, 0, 280, 330]) {
  const positioned = posterMenuPosition({ ...anchor, x }, viewport, insets, 56);
  assert(positioned.x >= 12 && positioned.x + positioned.width <= 378);
  assert(positioned.arrowX >= 16 && positioned.arrowX <= positioned.width - 16);
}
const landscape = { width: 844, height: 390 };
const landscapeInsets = { top: 0, bottom: 21, left: 59, right: 59 };
const largeText = posterMenuPosition({ x: 320, y: 100, width: 124, height: 186 }, landscape, landscapeInsets, 180);
assert(largeText.maxHeight < 180, 'large text is scrollable when neither side fits');
assert(largeText.y >= 12 && largeText.y + largeText.maxHeight <= 357);

function mount({ enabled = true, disabled = false, platform = 'ios', reduceMotion = false } = {}) {
  const slots: any[] = [];
  let cursor = 0;
  let tree: any;
  let effects: Array<() => void> = [];
  let opened = 0;
  let removed = 0;
  let measured = 0;
  let haptics = 0;
  let finishMeasure: (() => void) | null = null;
  const animations: any[] = [];
  const dimensions = { ...viewport };
  class Value {
    constructor(public value: number) {}
    setValue(value: number) { this.value = value; }
    stopAnimation() {}
    interpolate(config: unknown) { return config; }
  }
  const modules: Record<string, any> = {
    react: {
      useRef: (value: unknown) => { const i = cursor++; return slots[i] ??= { current: value }; },
      useState: (value: unknown) => { const i = cursor++; slots[i] ??= { value }; return [slots[i].value, (next: unknown) => { slots[i].value = next; }]; },
      useEffect: (effect: () => (() => void) | void, deps: unknown[]) => {
        const i = cursor++;
        if (slots[i] && deps.every((value, index) => Object.is(value, slots[i].deps[index]))) return;
        effects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: effect() }; });
      },
    },
    'react/jsx-runtime': { Fragment: 'Fragment', jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) },
    'react-native': {
      Platform: { OS: platform }, useWindowDimensions: () => dimensions,
      View: 'View', Pressable: 'Pressable', Modal: 'Modal', Text: 'Text', ScrollView: 'ScrollView',
      StyleSheet: { create: (value: unknown) => value, absoluteFill: {} },
      AccessibilityInfo: { isReduceMotionEnabled: async () => reduceMotion, addEventListener: () => ({ remove() {} }) },
      Easing: { cubic: 'cubic', out: (value: unknown) => value },
      Animated: { View: 'Animated.View', Value, timing: (value: Value, config: any) => ({ start: (callback?: Function) => {
        animations.push(config); value.setValue(config.toValue); callback?.({ finished: true });
      } }) },
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => insets },
    'lucide-react-native': { Trash2: 'Trash2' },
    '../design/tokens': { colors: {}, radii: {}, shadows: {}, spacing: {}, typography: {} },
    '../feedback/haptics': { hapticSelection: () => { haptics += 1; } },
    './posterMenuPosition': { posterMenuPosition },
  };
  const exports: any = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL('./PosterActionsMenu.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: (name: string) => { assert(name in modules, name); return modules[name]; } });
  const props = { enabled, disabled, children: 'poster', title: 'Title', label: 'Open title', actionLabel: 'Remove from Planned', width: 124,
    onOpen: () => { opened += 1; }, onRemove: () => { removed += 1; } };
  function render() {
    cursor = 0;
    tree = exports.PosterActionsMenu(props);
    const next = effects; effects = []; next.forEach((effect) => effect());
  }
  function find(type: string, label?: string, node = tree): any {
    if (!node) return null;
    if (Array.isArray(node)) return node.map((child) => find(type, label, child)).find(Boolean);
    if (node.type === type && (!label || node.props.accessibilityLabel === label)) return node;
    return find(type, label, node.props?.children ?? null);
  }
  render();
  find('View').props.ref.current = { measureInWindow: (callback: Function) => {
    measured += 1;
    finishMeasure = () => callback(anchor.x, anchor.y, anchor.width, anchor.height);
  } };
  const card = () => find('Pressable', 'Open title');
  function open() {
    card().props.onPressIn(); card().props.onLongPress();
    finishMeasure?.(); render();
    find('ScrollView').props.onContentSizeChange(260, 56); render();
  }
  return { render, find, card, open, props, dimensions, animations, finishMeasure: () => finishMeasure?.(),
    counts: () => ({ opened, removed, measured, haptics }), unmount: () => slots.forEach((slot) => slot.cleanup?.()) };
}

async function run() {
  for (const platform of ['ios', 'android']) {
    const menu = mount({ platform });
    menu.card().props.onPressIn();
    assert(menu.animations.some((entry) => entry.toValue === 0.96 && entry.duration === 180 && entry.useNativeDriver));
    menu.card().props.onPressOut(); menu.card().props.onPress();
    assert.equal(menu.counts().opened, 1);
    menu.open();
    menu.card().props.onPressOut(); menu.card().props.onPress(); menu.card().props.onLongPress();
    assert.equal(menu.counts().opened, 1, 'long press never navigates');
    assert.equal(menu.counts().measured, 1, 'one gesture opens only one menu');
    assert.equal(menu.counts().haptics, 1);
    assert(menu.find('Modal').props.visible);
    assert(menu.animations.some((entry) => entry.toValue === 1 && entry.duration === 160));
    const action = menu.find('Pressable', 'Remove from Planned, Title');
    action.props.onPress(); action.props.onPress(); menu.render();
    if (platform === 'ios') assert.equal(menu.counts().removed, 0, 'iOS must dismiss the modal before presenting confirmation');
    menu.find('Modal').props.onDismiss(); menu.find('Modal').props.onDismiss();
    assert.equal(menu.counts().removed, 1);
    assert(!menu.find('Modal').props.visible);
  }
  const cancelled = mount();
  cancelled.open(); cancelled.find('Pressable', 'Close title menu').props.onPress(); cancelled.render();
  cancelled.find('Modal').props.onDismiss();
  assert.equal(cancelled.counts().removed, 0);
  assert(cancelled.animations.some((entry) => entry.toValue === 1 && entry.duration === 180), 'cancel restores the card smoothly');
  const rotated = mount();
  rotated.open(); rotated.dimensions.width = 844; rotated.render(); rotated.render();
  assert(!rotated.find('Modal').props.visible, 'rotation cannot leave a bubble at stale coordinates');
  const stale = mount();
  stale.card().props.onLongPress(); stale.unmount(); stale.finishMeasure();
  assert.equal(stale.counts().haptics, 0, 'a late measurement cannot open a detached card');
  for (const options of [{ enabled: false }, { disabled: true }]) {
    const blocked = mount(options);
    blocked.card().props.onAccessibilityAction({ nativeEvent: { actionName: 'remove' } });
    assert.equal(blocked.counts().measured, 0);
  }
  const reduced = mount({ reduceMotion: true });
  await Promise.resolve(); reduced.open();
  assert(reduced.animations.every((entry) => entry.duration === 0), 'reduced motion disables the scale and popup transitions');
  console.log('Poster menu QA passed: animated hold, measured above/below placement, edge bounds, modal dismissal, cancellation and reduced motion.');
}
void run().catch((error) => { console.error(error); process.exitCode = 1; });
