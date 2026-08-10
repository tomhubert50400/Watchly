import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { parseImportFile } from './import-file.parser';

const letterboxdZip = Buffer.from(zipSync({
  'diary.csv': strToU8([
    'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review',
    '2026-01-02,"Paris, Texas",1984,https://boxd.it/2b8O,4.5,false,"A patient, beautiful film."',
    '2026-02-03,"Paris, Texas",1984,https://boxd.it/2b8O,5,true,"<strong>Even better</strong><br>on a rewatch."',
  ].join('\n')),
  'ratings.csv': strToU8('Date,Name,Year,Letterboxd URI,Rating\n2026-02-03,"Paris, Texas",1984,https://boxd.it/2b8O,5'),
  'watchlist.csv': strToU8('Date,Name,Year,Letterboxd URI\n2026-01-01,Heat,1995,https://boxd.it/2bg8'),
  'deleted/reviews.csv': strToU8('Name,Year,Review\nDeleted film,2001,Do not import'),
}));
const letterboxd = parseImportFile('letterboxd', 'letterboxd-export.zip', letterboxdZip);

assert.equal(letterboxd.items.length, 2);
assert.equal(letterboxd.ignoredFileCount, 1);
const parisTexas = letterboxd.items.find((item) => item.sourceTitle === 'Paris, Texas');
const heat = letterboxd.items.find((item) => item.sourceTitle === 'Heat');
assert.deepEqual(parisTexas, {
  activityDate: '2026-02-03',
  contentHint: 'movie',
  imdbId: null,
  rating: 5,
  review: 'Even better\non a rewatch.',
  sourceKey: 'letterboxd:https://boxd.it/2b8o',
  sourceTitle: 'Paris, Texas',
  sourceYear: 1984,
  tmdbId: null,
  watched: true,
  watchedDates: ['2026-01-02', '2026-02-03'],
  watchlisted: false,
  warnings: [],
});
assert.equal(heat?.watchlisted, true);

const imdb = parseImportFile(
  'imdb',
  'ratings.csv',
  Buffer.from([
    'Const,Your Rating,Date Rated,Title,Title Type,Year',
    'tt0113277,8,2025-04-03,Heat,movie,1995',
    'tt0903747,10,2025-04-04,Breaking Bad,tvSeries,2008',
  ].join('\n')),
);

assert.equal(imdb.items.length, 2);
assert.equal(imdb.items[0].imdbId, 'tt0113277');
assert.equal(imdb.items[0].activityDate, '2025-04-03');
assert.equal(imdb.items[0].rating, 4);
assert.equal(imdb.items[0].watched, true);
assert.deepEqual(imdb.items[0].watchedDates, []);
assert.equal(imdb.items[1].contentHint, 'series');

console.log('Import file parser QA passed.');
