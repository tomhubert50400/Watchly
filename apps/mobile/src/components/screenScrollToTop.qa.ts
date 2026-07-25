import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./Screen.tsx', import.meta.url), 'utf8');

assert.match(source, /useScrollToTop\(scrollViewRef\)/, 'Screen must register its vertical scroller with tab navigation');
assert.match(source, /<ScrollView[\s\S]*ref=\{scrollViewRef\}/, 'Screen must pass the registered ref to its ScrollView');

console.log('Screen scroll-to-top QA passed.');
