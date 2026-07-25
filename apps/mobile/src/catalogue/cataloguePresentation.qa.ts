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
const atmosphereSource = readFileSync(new URL('../components/SpotlightAtmosphere.tsx', import.meta.url), 'utf8');
const homeSource = readFileSync(new URL('../home/HomeScreen.tsx', import.meta.url), 'utf8');
const librarySource = readFileSync(new URL('../library/LibraryScreen.tsx', import.meta.url), 'utf8');
const screenSource = readFileSync(new URL('../components/Screen.tsx', import.meta.url), 'utf8');
const atmosphereStyle = atmosphereSource.match(/atmosphere: \{([\s\S]*?)\n  \},/)?.[1];

assert.match(ratingSource, /color: colors\.rating/, 'catalogue ratings must use Watchly pink');
assert.match(
  ratingSource,
  /<Star color=\{colors\.rating\} fill=\{colors\.rating\}/,
  'catalogue ratings must include the pink star icon',
);
assert.match(exploreCardSource, /<Text numberOfLines=\{1\} style=\{styles\.title\}>/);
assert.match(homeSource, /<Text numberOfLines=\{1\} style=\{styles\.posterTitle\}>/);
assert(atmosphereStyle, 'Home must define the Spotlight atmosphere layer');
assert.match(
  atmosphereStyle,
  /\.\.\.StyleSheet\.absoluteFillObject/,
  'the Spotlight atmosphere must fill the available screen',
);
assert.doesNotMatch(
  atmosphereStyle,
  /\bheight:/,
  'the Spotlight atmosphere must not stop at a fixed height',
);
assert.doesNotMatch(
  atmosphereSource,
  /spotlightAtmosphereFade/,
  'the Spotlight backdrop must not fade completely to the solid page background',
);
assert.match(
  homeSource,
  /const atmosphereUrl = catalogue\.data\?\.hero\?\.posterUrl \?\? catalogue\.data\?\.hero\?\.backdropUrl \?\? null;/,
  'Home must prefer the vertical Spotlight poster and fall back to its backdrop',
);
assert.match(
  homeSource,
  /background=\{atmosphereUrl \? <SpotlightAtmosphere/,
  'Home must mount the Spotlight artwork at screen level',
);
assert.match(
  atmosphereSource,
  /blurRadius=\{8\}/,
  'the Spotlight poster must stay recognizable behind the page content',
);
assert.match(
  exploreSource,
  /const atmosphereUrl = visibleItems\[0\]\?\.posterUrl \?\? null;/,
  'Explore must use the leading visible poster for its atmosphere',
);
assert.match(
  exploreSource,
  /<SpotlightAtmosphere imageUrl=\{atmosphereUrl\} \/>/,
  'Explore must render the shared atmosphere behind its content',
);
assert.match(
  librarySource,
  /const lastWatchedItem = getLastWatchedLibraryItem\(data\?\.items \?\? \[\]\);/,
  'Library must resolve its atmosphere from the last watched item',
);
assert.match(
  librarySource,
  /const atmosphereUrl = lastWatchedItem\?\.posterUrl \?\? lastWatchedItem\?\.backdropUrl \?\? null;/,
  'Library must prefer the last watched poster and fall back to its backdrop',
);
assert.match(
  librarySource,
  /background=\{atmosphereUrl \? <SpotlightAtmosphere imageUrl=\{atmosphereUrl\} \/> : null\}/,
  'Library must mount the last watched artwork at screen level',
);
assert.match(screenSource, /background\?: ReactNode/, 'Screen must expose a background layer');
assert.match(
  screenSource,
  /background \? styles\.transparentHeader/,
  'the Home header must reveal the screen-level backdrop',
);

for (const [file, source] of [
  ['ExploreMediaCard.tsx', exploreCardSource],
  ['ExploreScreen.tsx', exploreSource],
  ['HomeScreen.tsx', homeSource],
] as const) {
  assert.match(source, /<CatalogueRating\b/, `${file} must use the shared pink rating`);
  assert.doesNotMatch(source, /TMDB \$\{.*voteAverage/, `${file} must not prefix ratings with TMDB`);
}

console.log('Catalogue presentation QA passed.');
