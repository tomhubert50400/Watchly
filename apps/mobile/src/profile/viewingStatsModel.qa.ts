import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';
import { formatCompactHours, formatStoryTime, formatViewCount } from './viewingStatsModel';

assert.equal(formatCompactHours(108), '1h48');
assert.equal(formatCompactHours(45), '45m');
assert.equal(formatCompactHours(36_750), '612h30');
assert.equal(formatStoryTime(533), '8 hours watching stories and making memories');
assert.equal(formatStoryTime(60), '1 hour watching stories and making memories');
assert.equal(formatStoryTime(45), '45 minutes watching stories and making memories');
assert.equal(formatViewCount(1), '1 view');
assert.equal(formatViewCount(4), '4 views');

const highlightCardSource = readFileSync(
  new URL('./ViewingHighlightCard.tsx', import.meta.url),
  'utf8',
);
const allTimeSource = readFileSync(new URL('./AllTimeStatsScreen.tsx', import.meta.url), 'utf8');
assert(
  allTimeSource.includes('minimumFontScale={0.5}')
    && allTimeSource.includes('fontSize: 64'),
  'The All Time watch duration must remain within the screen for triple and quadruple digit hours.',
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
