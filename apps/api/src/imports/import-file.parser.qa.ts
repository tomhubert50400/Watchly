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
  favorite: false,
  imdbId: null,
  rating: 5,
  review: 'Even better\non a rewatch.',
  sourceKey: 'letterboxd:https://boxd.it/2b8o',
  sourceTitle: 'Paris, Texas',
  sourceYear: 1984,
  tmdbId: null,
  tvdbId: null,
  watched: true,
  watchedDates: ['2026-01-02', '2026-02-03'],
  watching: false,
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

const tvTimeZip = Buffer.from(zipSync({
  'access_token.csv': strToU8('access_token\ndo-not-parse-or-import'),
  'device_token.csv': strToU8('device_token\ndo-not-parse-or-import'),
  'tracking-prod-records.csv': strToU8([
    'uuid,type,entity_type,movie_name,release_date,watch_date,user_id',
    'movie-watched,follow,movie,Heat,1995-12-15,,private-user-id',
    'movie-watched,watch,movie,Heat,1995-12-15,2025-04-03,private-user-id',
    'movie-planned,follow,movie,Dune: Part Two,2024-02-27,,private-user-id',
    'movie-planned,towatch,movie,Dune: Part Two,2024-02-27,,private-user-id',
  ].join('\n')),
  'user_tv_show_data.csv': strToU8([
    'tv_show_id,is_followed,is_favorited,nb_episodes_seen,tv_show_name,user_id',
    '81189,1,1,12,Breaking Bad,private-user-id',
    '70682,1,0,0,Oz,private-user-id',
  ].join('\n')),
}));
const tvTime = parseImportFile('tv-time', 'gdpr-data.zip', tvTimeZip);

assert.equal(tvTime.ignoredFileCount, 2, 'sensitive and unrelated CSV files must be ignored before parsing');
assert.equal(tvTime.items.length, 4);
const tvTimeSeries = tvTime.items.find((item) => item.tvdbId === 81189);
assert.equal(tvTimeSeries?.watching, true);
assert.equal(tvTimeSeries?.favorite, true);
assert.equal(tvTime.items.find((item) => item.sourceTitle === 'Oz')?.watchlisted, true);
assert.equal(tvTime.items.find((item) => item.sourceTitle === 'Heat')?.watched, true);
assert.deepEqual(
  tvTime.items.find((item) => item.sourceTitle === 'Heat')?.watchedDates,
  ['2025-04-03'],
);
assert.equal(tvTime.items.find((item) => item.sourceTitle === 'Dune: Part Two')?.watchlisted, true);

console.log('Import file parser QA passed.');

const episodeExport = Buffer.from(zipSync({
  'user_tv_show_data.csv': strToU8('tv_show_id,tv_show_name,nb_episodes_seen\n81189,Breaking Bad,62\n371980,Severance,0'),
  'tracking-prod-records.csv': strToU8('type,entity_type,series_id,series_name,season_number,episode_number\nwatch,episode,81189,Breaking Bad,1,1'),
  'tracking-prod-records-v2.csv': strToU8([
    'key,s_id,series_name,s_no,ep_no,created_at',
    'watch-episode-a,81189,Breaking Bad,5,16,2025-01-02',
    'watch-episode-b,81189,Breaking Bad,5,16,2025-01-03',
    'watch-episode-c,371980,Severance,2,10,2025-02-02',
    'watch-episode-d,371980,Severance,0,1,2025-02-02',
    'watch-episode-invalid,371980,Severance,-1,1,2025-02-02',
  ].join('\n')),
}));
const detailed = parseImportFile('tv-time', 'export.zip', episodeExport);
assert.equal(detailed.ignoredFileCount, 0);
assert.deepEqual(detailed.items.find((item) => item.tvdbId === 81189)?.episodes, [
  { seasonNumber: 5, episodeNumber: 16, watchedDate: '2025-01-02' },
], 'V2 must take precedence over stale V1 history and deduplicate episodes');
assert.equal(detailed.items.find((item) => item.tvdbId === 371980)?.episodes?.length, 2, 'episode-only series and specials must be retained');
const legacy = parseImportFile('tv-time', 'tracking-prod-records.csv', Buffer.from(
  'type,entity_type,series_id,series_name,season_number,episode_number,watch_date\nwatch,episode,81189,Breaking Bad,1,2,2024-01-01',
));
assert.deepEqual(legacy.items[0].episodes, [{ seasonNumber: 1, episodeNumber: 2, watchedDate: '2024-01-01' }]);

const contradictory = parseImportFile('tv-time', 'export.zip', Buffer.from(zipSync({
  'user_tv_show_data.csv': strToU8('tv_show_id,tv_show_name,nb_episodes_seen\n10000000,Original series,2\n81189,Breaking Bad,62'),
  'tracking-prod-records-v2.csv': strToU8([
    'key,s_id,series_name,s_no,ep_no,ep_id',
    'watch-episode-a,10000000,Nature Reserve Special Forces,1,32,10003263',
    'watch-episode-b,400317,Nature Reserve Special Forces,2,20,10003263',
    'watch-episode-c,81189,Breaking Bad,1,1,349232',
    'watch-episode-d,400318,Unknown series,1,1,9999',
  ].join('\n')),
})));
assert.equal(contradictory.items.find((item) => item.tvdbId === 81189)?.episodes?.length, 1);
for (const id of [10000000, 400317, 400318]) {
  const item = contradictory.items.find((entry) => entry.tvdbId === id)!;
  assert.equal(item.episodes?.length ?? 0, 0, 'contradictory or uncorroborated rows must not create progress');
  assert.ok(item.identityIssue, 'unsafe rows must be blocked and reported in the preview');
}
const largeLibrary = Array.from({ length: 10_000 }, (_, index) =>
  `2025-01-01,Movie ${index},2000,https://boxd.it/test${index}`);
const largeCsv = `Date,Name,Year,Letterboxd URI\n${largeLibrary.join('\n')}`;
const largeExport = parseImportFile('letterboxd', 'export.zip', Buffer.from(zipSync({
  'watched.csv': strToU8(largeCsv),
  'watchlist.csv': strToU8(largeCsv),
})));
assert.equal(largeExport.items.length, 10_000, 'large libraries must be retained and deduplicated across files');
assert.ok(largeExport.items.every((item) => item.watched && !item.watchlisted), 'watched state must still take precedence over watchlist');
assert.ok(largeExport.items.every((item) => item.watchlistKeys?.includes('watchlist')), 'watched films must retain list membership');

const namedLists = parseImportFile('letterboxd', 'export.zip', Buffer.from(zipSync({
  'watched.csv': strToU8('Name,Year,Letterboxd URI\nHeat,1995,https://letterboxd.com/film/heat-1995/'),
  'lists/crime.csv': strToU8('Letterboxd list export v7\nDate,Name,Tags,URL,Description\n2026-01-01,"Crime, classics",,https://letterboxd.com/me/list/crime/,"Two lines\nof description"\n\nPosition,Name,Year,URL,Description\n1,Heat,1995,https://letterboxd.com/film/heat-1995/,\n2,Thief,1981,https://letterboxd.com/film/thief/,\n'),
  'lists/favorites.csv': strToU8('Position,Name,Year,Letterboxd URI\n1,Heat,1995,https://letterboxd.com/film/heat-1995/'),
  'lists/empty.csv': strToU8('Position,Name,Year,URL\n'),
  'profile.csv': strToU8('Name\nPrivate profile name'),
  'deleted/lists/old.csv': strToU8('Position,Name,Year\n1,Deleted,2000'),
})));
assert.deepEqual(namedLists.watchlists.map((list) => list.name), ['Crime, classics', 'favorites', 'empty']);
assert.equal(namedLists.ignoredFileCount, 2);
assert.equal(namedLists.items.length, 2, 'metadata must not become film rows');
assert.equal(namedLists.items[0].watched, true);
assert.equal(namedLists.items[0].watchlistKeys?.length, 2, 'one film must belong to every original list');
assert.equal(namedLists.items[1].watched, false, 'list membership must not invent viewing history');
assert.equal(parseImportFile('letterboxd', 'watchlist.csv', Buffer.from('Name,Year\n')).watchlists.length, 1);
assert.throws(() => parseImportFile('letterboxd', 'profile.csv', Buffer.from('Name\nPrivate')), /supported/);

const imdbLists = parseImportFile('imdb', 'export.zip', Buffer.from(zipSync({
  'Movie night.csv': strToU8('Position,Const,Title,Year,Your Rating,Date Rated\n1,tt0113277,Heat,1995,8,2026-01-01\n2,tt0083190,Thief,1981,,'),
  'Watchlist.csv': strToU8('Position,Const,Title,Year,Your Rating\n1,tt0113277,Heat,1995,8'),
})));
assert.deepEqual(imdbLists.watchlists.map((list) => list.name), ['Movie night', 'Watchlist IMDb']);
assert.equal(imdbLists.items[0].rating, 4);
assert.equal(imdbLists.items[0].watchlistKeys?.length, 2);
assert.equal(imdbLists.items[1].watched, false);
assert.deepEqual(tvTime.watchlists, [{ key: 'watchlist', name: 'Watchlist TV Time' }]);
assert.deepEqual(tvTime.items.find((item) => item.sourceTitle === 'Dune: Part Two')?.watchlistKeys, ['watchlist']);
const manyLists = parseImportFile('letterboxd', 'export.zip', Buffer.from(zipSync(Object.fromEntries(
  Array.from({ length: 10 }, (_, index) => [`lists/list-${index}.csv`, strToU8('Position,Name,Year\n1,Heat,1995')]),
))));
assert.equal(manyLists.watchlists.length, 10);
assert.equal(manyLists.items[0].watchlistKeys?.length, 10);
