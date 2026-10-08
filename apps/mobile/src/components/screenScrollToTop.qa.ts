import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./Screen.tsx', import.meta.url), 'utf8');

assert.match(source, /useScrollToTop\(scrollViewRef\)/, 'Screen must register its vertical scroller with tab navigation');
assert.match(source, /<ScrollView[\s\S]*ref=\{scrollViewRef\}/, 'Screen must pass the registered ref to its ScrollView');
assert.match(source, /contentInsetAdjustmentBehavior=\{topInset > 0 \? 'never' : contentInsetAdjustmentBehavior\}/,
  'Screens with manual safe-area padding must keep the initial scroll origin at zero');
assert.match(source, /paddingTop: topInset/,
  'Screen must retain its initial safe-area spacing when returning to the top');

for (const path of [
  'src/unstable/NativeBottomTabView.native.tsx',
  'lib/module/unstable/NativeBottomTabView.native.js',
]) {
  const nativeTabs = readFileSync(new URL(`../../node_modules/@react-navigation/bottom-tabs/${path}`, import.meta.url), 'utf8');
  assert.match(nativeTabs, /overrideScrollViewContentInsetAdjustmentBehavior(?:=\{false\}|: false)/,
    `${path}: native tabs must not replace Screen's manual insets with automatic insets on reselection`);
  assert.doesNotMatch(nativeTabs, /scrollToTop(?:=\{false\}|: false)/,
    'Repeated tab selection must still return scrolled content to the top');
}

console.log('Screen scroll-to-top QA passed.');
