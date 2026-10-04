// @ts-expect-error QA executes under tsx/Node.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as tokens from '../design/tokens';

// Exercise the actual press callbacks without loading React Native in Node.
const code = ts.transpileModule(readFileSync(new URL('./WatchlistActionsMenu.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
}).outputText;

function mount(nativeAvailable: boolean) {
  const presentations: Array<{ options: { cancelButtonIndex: number; disabledButtonIndices: number[] }; close: (index: number) => void }> = [];
  let nativeImports = 0;
  const exports: Record<string, Function> = {};
  const modules: Record<string, unknown> = {
    react: { useRef: (current: unknown) => ({ current }) },
    'react/jsx-runtime': { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) },
    'lucide-react-native': { Menu: 'Menu' },
    'react-native-safe-area-context': {},
    '../design/tokens': tokens,
    'react-native': {
      Platform: { OS: 'ios' },
      UIManager: { getViewManagerConfig: () => nativeAvailable ? {} : null },
      StyleSheet: { create: (value: unknown) => value },
      Pressable: 'Pressable', View: 'View',
      ActionSheetIOS: { showActionSheetWithOptions: (options: typeof presentations[number]['options'], close: (index: number) => void) => presentations.push({ options, close }) },
    },
  };
  runInNewContext(code, { exports, require: (name: string) => {
    if (name === '@react-native-menu/menu') {
      nativeImports += 1;
      return { MenuView: 'NativeMenuView' };
    }
    assert(name in modules, `Unexpected import: ${name}`);
    return modules[name];
  } });
  let selected = 0;
  const props = { actions: [
    { label: 'Filters', nativeIcon: 'line.3.horizontal.decrease', active: true, onPress: () => { selected += 1; } },
    { label: 'Create a section', disabled: true, onPress: () => { throw new Error('Disabled action ran'); } },
  ] };
  const element = exports.WatchlistActionsMenu(props);
  const button = typeof element.type === 'function' ? element.type(element.props) : element;
  return { button, presentations, nativeImports, selected: () => selected };
}

const legacy = mount(false);
legacy.button.props.onPress();
legacy.button.props.onPress();
assert.equal(legacy.presentations.length, 1, 'two rapid taps must open only one action sheet');
assert.equal(legacy.nativeImports, 0, 'older builds must never load the absent native component');
legacy.presentations[0].close(legacy.presentations[0].options.cancelButtonIndex);
legacy.button.props.onPress();
assert.equal(legacy.presentations.length, 2, 'Cancel must allow the menu to reopen');
legacy.presentations[1].close(0);
assert.equal(legacy.selected(), 1, 'selecting a menu action must run it once');
legacy.button.props.onPress();
assert.equal(legacy.presentations.length, 3, 'selecting an action must allow the menu to reopen');
legacy.presentations[2].close(1);
assert.equal(legacy.selected(), 1, 'disabled actions must remain unavailable');

const native = mount(true);
assert.equal(native.button.type, 'NativeMenuView');
assert.equal(native.button.props.shouldOpenOnLongPress, false);
assert.equal(native.button.props.actions[0].state, 'on');
assert.equal(native.button.props.actions[1].attributes.disabled, true);
native.button.props.onPressAction({ nativeEvent: { event: '0' } });
assert.equal(native.selected(), 1);
assert.equal(native.presentations.length, 0, 'the native button must not stack imperative action sheets');
console.log('Watchlist menu QA passed: rapid taps, cancel/reopen, action/reopen, disabled actions and native availability.');
