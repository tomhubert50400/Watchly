import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';
import { formatCompactHours, formatViewCount, formatWatchTime } from './viewingStatsModel';

assert.equal(formatCompactHours(90), '1.5');
assert.equal(formatCompactHours(36_750), '612');
assert.equal(formatWatchTime(125, false), '2 h 5 min');
assert.equal(formatWatchTime(120, true), '~2 h');
assert.equal(formatViewCount(1), '1 view');
assert.equal(formatViewCount(4), '4 views');

const highlightCardSource = readFileSync(
  new URL('./ViewingHighlightCard.tsx', import.meta.url),
  'utf8',
);
assert(
  highlightCardSource.includes('<SvgLinearGradient')
    && highlightCardSource.includes('styles.gradientOverlay'),
  'highlight artwork must use a continuous horizontal gradient behind its copy',
);
assert.equal(
  highlightCardSource.includes('styles.leftShade'),
  false,
  'highlight artwork must not use a hard-edged fixed-width shade',
);

console.log('Viewing stats mobile model QA passed.');
