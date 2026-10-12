// @ts-expect-error QA executes under Node, outside the Expo runtime types.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under Node, outside the Expo runtime types.
import { readFileSync } from 'node:fs';
// @ts-expect-error QA executes under Node, outside the Expo runtime types.
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const platform = { OS: 'android' };
const exported: any = {};
const jsx = (type: unknown, props: unknown) => ({ type, props });
runInNewContext(ts.transpileModule(readFileSync(new URL('./MediaLogo.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText, { exports: exported, require: (name: string) => ({
  'react/jsx-runtime': { jsx, jsxs: jsx },
  'react-native': { Image: 'image', View: 'view', Platform: platform },
  'react-native-svg': { SvgUri: 'svg' },
}[name]) });
const props = { source: { uri: 'https://image.tmdb.org/t/p/w500/matrix.svg' }, style: { height: 86, aspectRatio: 5.96 }, accessible: false, resizeMode: 'contain' };
const logo = exported.MediaLogo(props);
assert.equal(logo.type, 'view');
assert.equal(logo.props.children.type, 'svg', 'Android SVG logos must use the existing SVG renderer.');
assert.equal(logo.props.children.props.uri, props.source.uri);
assert.equal(logo.props.children.props.preserveAspectRatio, 'xMidYMid meet');
assert.equal(logo.props.style, props.style, 'Keep the existing logo dimensions.');
assert.equal(logo.props.accessible, false, 'Do not duplicate the enclosing title accessibility label.');
assert.equal(exported.MediaLogo({ ...props, source: { uri: 'https://image.test/title.SVG?version=1' } }).type, 'view');
assert.equal(exported.MediaLogo({ ...props, source: { uri: 'https://image.test/title.png' } }).type, 'image', 'Raster logos keep the native image renderer.');
platform.OS = 'ios';
const ios = exported.MediaLogo(props);
assert.equal(ios.type, 'image', 'Do not change iOS rendering.');
assert.equal(ios.props.source, props.source);
assert.equal(ios.props.style, props.style);
assert.equal(ios.props.resizeMode, props.resizeMode);
console.log('Android media logo QA passed.');
