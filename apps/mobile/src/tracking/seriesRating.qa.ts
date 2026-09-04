// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

const apiSource = source('../api/ratings.ts');
const controlSource = source('./SeriesRatingControl.tsx');
const opinionSheetSource = source('../opinions/OpinionSheet.tsx');
const seriesDetailSource = source('../catalogue/SeriesDetailScreen.tsx');

assert.match(apiSource, /getSeriesRating[\s\S]*`\/ratings\/series\/\$\{seriesTmdbId\}`/);
assert.match(apiSource, /upsertSeriesRating[\s\S]*`\/ratings\/series\/\$\{seriesTmdbId\}`/);
assert.match(apiSource, /deleteSeriesRating[\s\S]*`\/ratings\/series\/\$\{seriesTmdbId\}`/);
assert.match(controlSource, /reviewsEnabled=\{false\}/);
assert.match(controlSource, /resourceKey=\{`series:\$\{seriesTmdbId\}`\}/);
assert.match(opinionSheetSource, /reviewsEnabled \? 'Your opinion' : 'Your rating'/);
assert.match(opinionSheetSource, /reviewsEnabled \? \([\s\S]*Optional written review[\s\S]*\) : null/);
assert.match(
  seriesDetailSource,
  /<TrackingControls[\s\S]*<SeriesRatingControl[\s\S]*<SeriesProgressSummary/,
  'series rating must appear in Your activity without replacing episode progress',
);

console.log('Series rating mobile QA passed.');
