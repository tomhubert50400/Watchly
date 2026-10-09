// @ts-expect-error QA executes under tsx/Node.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync(new URL('./HorizontalScrollFade.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;
const slots: any[] = [];
let cursor = 0;
let available = true;
const forwarded: unknown[] = [];
const child = { type: 'scroll', props: {
  style: { marginHorizontal: -24 }, horizontal: true,
  onLayout: (event: unknown) => forwarded.push(event),
  onContentSizeChange: (...size: number[]) => forwarded.push(size),
  onScroll: (event: unknown) => forwarded.push(event),
} };
const exported: Record<string, Function> = {};
const jsx = (type: unknown, props: any) => ({ type, props });
const modules: Record<string, unknown> = {
  react: {
    cloneElement: (element: typeof child, props: unknown) => ({ ...element, props: { ...element.props, ...(props as object) } }),
    useRef: (current: unknown) => { const index = cursor++; return slots[index] ??= { current }; },
    useState: (initial: unknown) => {
      const index = cursor++; slots[index] ??= initial;
      return [slots[index], (update: Function) => { slots[index] = update(slots[index]); }];
    },
  },
  'react/jsx-runtime': { jsx, jsxs: jsx },
  'react-native': { StyleSheet: { create: (value: unknown) => value }, UIManager: { hasViewManagerConfig: () => available } },
  '@react-native-masked-view/masked-view': { default: 'masked' },
  'react-native-svg': { default: 'svg', Defs: 'defs', LinearGradient: 'gradient', Rect: 'rect', Stop: 'stop' },
};
runInNewContext(code, { exports: exported, require: (name: string) => modules[name] });
const render = () => { cursor = 0; return exported.HorizontalScrollFade({ children: child }); };
const layout = (width: number, height: number) => render().props.children.props.onLayout({ nativeEvent: { layout: { width, height } } });
const size = (width: number, height: number) => render().props.children.props.onContentSizeChange(width, height);
const scroll = (x: number) => render().props.children.props.onScroll({ nativeEvent: { contentOffset: { x } } });
const stops = () => render().props.maskElement.props.children[0].props.children.props.children;

layout(360, 16);
size(0, 16);
size(1400, 206);
layout(360, 206);
assert.equal(render().props.maskElement.props.height, 206,
  'the mask must expand when asynchronous cards replace an empty rail without a width change');
assert.equal(render().props.maskElement.props.children[1].props.height, 206);
assert.equal(render().props.maskElement.props.width, 360);
assert.equal(stops()[0].props.stopOpacity, 1);
assert.equal(stops()[3].props.stopOpacity, 0);
scroll(520);
assert.equal(stops()[0].props.stopOpacity, 0);
assert.equal(stops()[3].props.stopOpacity, 0);
scroll(2000);
assert.equal(stops()[3].props.stopOpacity, 1, 'the end stays visible during overscroll');
scroll(-40);
assert.equal(stops()[0].props.stopOpacity, 1, 'the start stays visible during overscroll');
layout(360, 250);
assert.equal(render().props.maskElement.props.height, 250, 'text growth must resize the mask too');
layout(700, 180);
assert.equal(render().props.maskElement.props.width, 700);
assert.equal(render().props.style, child.props.style, 'the outer rail retains its original layout');
assert.equal(forwarded.length, 9, 'existing layout, content-size and scroll callbacks must still run');
available = false;
assert.equal(render(), child, 'clients without masking keep the original scroll view');
console.log('Horizontal fade QA passed: async height, text growth, resizing, edges, overscroll, callbacks and native fallback.');
