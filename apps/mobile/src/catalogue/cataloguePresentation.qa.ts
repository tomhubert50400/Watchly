// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';
import { formatCatalogueRating } from './catalogueRatingModel';

assert.equal(formatCatalogueRating(null), null);
assert.equal(formatCatalogueRating(8), '8.0/10');
assert.equal(formatCatalogueRating(5.24), '5.2/10');

const ratingSource = readFileSync(new URL('CatalogueRating.tsx', import.meta.url), 'utf8');
const exploreCardSource = readFileSync(new URL('ExploreMediaCard.tsx', import.meta.url), 'utf8');
const exploreSource = readFileSync(new URL('ExploreScreen.tsx', import.meta.url), 'utf8');
const homeSource = readFileSync(new URL('../home/HomeScreen.tsx', import.meta.url), 'utf8');

assert.match(ratingSource, /color: colors\.rating/, 'catalogue ratings must use Watchly pink');
assert.match(
  ratingSource,
  /<Star color=\{colors\.rating\} fill=\{colors\.rating\}/,
  'catalogue ratings must include the pink star icon',
);
assert.match(exploreCardSource, /<Text numberOfLines=\{1\} style=\{styles\.title\}>/);
assert.match(homeSource, /<Text numberOfLines=\{1\} style=\{styles\.posterTitle\}>/);

for (const [file, source] of [
  ['ExploreMediaCard.tsx', exploreCardSource],
  ['ExploreScreen.tsx', exploreSource],
  ['HomeScreen.tsx', homeSource],
] as const) {
  assert.match(source, /<CatalogueRating\b/, `${file} must use the shared pink rating`);
  assert.doesNotMatch(source, /TMDB \$\{.*voteAverage/, `${file} must not prefix ratings with TMDB`);
}

console.log('Catalogue presentation QA passed.');
