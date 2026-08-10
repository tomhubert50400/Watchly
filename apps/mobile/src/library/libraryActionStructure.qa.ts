// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';

for (const file of ['ReleaseAlertRow.tsx', 'WatchlistRail.tsx']) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const tokens = source.match(/<Pressable\b|<\/Pressable>/g) ?? [];
  let depth = 0;
  let maximumDepth = 0;
  for (const token of tokens) {
    depth += token === '</Pressable>' ? -1 : 1;
    maximumDepth = Math.max(maximumDepth, depth);
  }
  assert.equal(depth, 0, `${file} Pressable tags must be balanced`);
  assert.ok(maximumDepth <= 1, `${file} must expose sibling actions instead of nested Pressables`);
}

const watchlistSource = readFileSync(new URL('WatchlistRail.tsx', import.meta.url), 'utf8');
assert.doesNotMatch(
  watchlistSource,
  /Trash2|itemCount|memberCount|Private/,
  'watchlist covers must not show actions or metadata',
);
assert.match(
  watchlistSource,
  /const fourArtworkLayers = \[[\s\S]*imageX: -70, imageY: -39[\s\S]*imageX: 70, imageY: -39[\s\S]*imageX: -70, imageY: 39[\s\S]*imageX: 70, imageY: 39/,
  'watchlist covers must move each artwork focal point toward a different corner',
);
assert.match(
  watchlistSource,
  /source=\{\{ uri: shown\[0\] \}\}/,
  'a watchlist with one artwork must still render a full native cover',
);
assert.match(
  watchlistSource,
  /<RadialGradient[\s\S]*rx=\{layer\.rx\}[\s\S]*ry=\{layer\.ry\}[\s\S]*<Mask[\s\S]*shown\.map\(\(url, index\)[\s\S]*height=\{ARTWORK_HEIGHT\}[\s\S]*width=\{ARTWORK_WIDTH\}[\s\S]*x=\{layer\.imageX\}[\s\S]*y=\{layer\.imageY\}/,
  'watchlist covers must use oversized shifted artwork with soft corner masks',
);
assert.doesNotMatch(
  watchlistSource,
  /BlurView|MaskedView|from 'expo-linear-gradient'/,
  'watchlist covers must not render a visible center seam or require an additional native masking module',
);
assert.doesNotMatch(
  watchlistSource,
  /blendLayers|artworkImage|artworkBase|ArtworkFrames|width: 150|height: 90/,
  'watchlist covers must not use stacked native images or a rectangular grid',
);

const watchlistOptionSource = readFileSync(
  new URL('../watchlists/WatchlistOptionRow.tsx', import.meta.url),
  'utf8',
);
assert.match(
  watchlistOptionSource,
  /import \{ WatchlistCard \} from '\.\.\/library\/WatchlistRail'/,
  'the add-to-list sheet must reuse the Library watchlist card',
);
assert.doesNotMatch(
  watchlistOptionSource,
  /LockKeyhole|Users|kindIcon/,
  'the add-to-list sheet must not recreate the old generic option row',
);

const addToWatchlistSource = readFileSync(
  new URL('../watchlists/AddToWatchlistControl.tsx', import.meta.url),
  'utf8',
);
assert.match(
  addToWatchlistSource,
  /Personal lists[\s\S]*<BottomActionSheetScrollView[\s\S]*horizontal[\s\S]*personalOptions\.map[\s\S]*Shared lists[\s\S]*<BottomActionSheetScrollView[\s\S]*horizontal[\s\S]*sharedOptions\.map/,
  'the add-to-list sheet must use a separate horizontal rail for each labelled section',
);
assert.doesNotMatch(
  addToWatchlistSource,
  /Shared lists:|voting becomes available|voteNote/,
  'the grouped rails must not restore the shared-list tip',
);

const libraryDataSource = readFileSync(new URL('useLibraryData.ts', import.meta.url), 'utf8');
const watchlistPreviewSource = readFileSync(
  new URL('../watchlists/watchlistPreview.ts', import.meta.url),
  'utf8',
);
assert.match(
  watchlistPreviewSource,
  /details\.items\.slice\(0, 4\)/,
  'watchlist previews must hydrate up to four titles',
);
assert.match(
  libraryDataSource,
  /details\.backdropUrl \?\? details\.posterUrl/,
  'watchlist previews should prefer landscape artwork',
);

const librarySource = readFileSync(new URL('LibraryScreen.tsx', import.meta.url), 'utf8');
assert.match(
  librarySource,
  /accessibilityLabel: 'In progress', label: 'Progress'/,
  'the constrained Library segment must keep the full accessible name while using a non-truncating visible label',
);

console.log('Library action structure QA passed.');
