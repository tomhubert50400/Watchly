import { colors } from './tokens';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const tokenColors = colors as Record<string, string>;

assert(colors.rating === colors.accent, 'Filled rating stars must use Watchly raspberry.');
assert(colors.ratingSoft === colors.accentSoft, 'Rating surfaces must use the raspberry soft tone.');
assert('segmentSelectedBorder' in colors, 'Segmented controls need an explicit neutral selected border.');
assert(
  tokenColors.segmentSelectedBorder !== colors.accentBorder,
  'Selected segmented buttons must not use a raspberry border.',
);

console.log('Design token QA passed.');
