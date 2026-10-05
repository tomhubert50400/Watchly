// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';
import type { MovieDetails } from '../api/catalogue';
import { getCachedMovieDetail, retainCatalogueDetail, type CatalogueDetailCache } from './catalogueDetailCache';
import {
  catalogueArtworkSnapshot,
  catalogueMediaSnapshot,
  catalogueSnapshotKey,
  isCurrentCatalogueSnapshotDataset,
  retainCatalogueSnapshots,
  type CatalogueArtworkSnapshot,
  type CatalogueMediaSnapshot,
  type CatalogueSnapshotItem,
  type CatalogueSnapshots,
} from './catalogueMediaSnapshots';

const items: CatalogueSnapshotItem[] = Array.from({ length: 600 }, (_, index) => ({ contentType: 'movie', tmdbId: index + 1 }));
let details: CatalogueDetailCache = new Map();
let calendar: CatalogueSnapshots<CatalogueArtworkSnapshot> = { scope: '', items: new Map() };
let votes: CatalogueSnapshots<CatalogueMediaSnapshot> = { scope: '', items: new Map() };

for (const item of items) {
  const loaded: MovieDetails = {
    backdropUrl: null, cast: [], genres: ['Drama'], id: `movie:${item.tmdbId}`,
    keywords: [], logoAspectRatio: null, logoUrl: null, originalTitle: null,
    overview: 'Full detail data must not be retained by rows.', posterUrl: `https://image.test/${item.tmdbId}.jpg`,
    productionCompanies: [], recommendations: [], status: null, tagline: null,
    title: `Title ${item.tmdbId}`, tmdbId: item.tmdbId, videos: [], voteAverage: null,
    mediaType: 'movie', budget: null, directors: [], displayRating: null, releaseDate: null,
    revenue: null, runtimeMinutes: null, writers: [],
  };
  details = retainCatalogueDetail(details, item.tmdbId, loaded);
  calendar = retainCatalogueSnapshots(calendar, 'owner-a:calendar', items, [[item, catalogueArtworkSnapshot(loaded)]]);
  votes = retainCatalogueSnapshots(votes, 'owner-a:vote-a', items, [[item, catalogueMediaSnapshot(loaded)]]);
}

assert.equal(details.size, 120);
assert.equal(getCachedMovieDetail(details, 1), null, 'the full details must actually be evicted');
assert.equal(calendar.items.size, 600);
assert.equal(votes.items.size, 600);
assert.deepEqual(calendar.items.get('movie:1'), { title: 'Title 1', posterUrl: 'https://image.test/1.jpg' },
  'calendar artwork must survive more than 120 unique loads');
assert.deepEqual(votes.items.get('movie:1'), { title: 'Title 1', posterUrl: 'https://image.test/1.jpg', genres: ['Drama'] },
  'vote title, poster and genres must survive full-detail eviction');
assert.deepEqual(Object.keys(calendar.items.get('movie:1')!).sort(), ['posterUrl', 'title']);
assert.deepEqual(Object.keys(votes.items.get('movie:1')!).sort(), ['genres', 'posterUrl', 'title']);

const originalGenres = ['Drama'];
const projected = catalogueMediaSnapshot({ title: 'Title', posterUrl: null, genres: originalGenres });
assert.notEqual(projected.genres, originalGenres, 'row snapshots must own their small genre lists');
const existing = votes.items.get('movie:1')!;
assert.equal(retainCatalogueSnapshots(votes, 'owner-a:vote-a', items, [[items[0]!, { ...existing, genres: [...existing.genres] }]]), votes,
  'equivalent cache notifications must not cause another state update');
const pruned = retainCatalogueSnapshots(votes, 'owner-a:vote-a', items.slice(0, 2));
assert.equal(pruned.items.size, 2, 'removed dataset entries must be released');
assert.equal(votes.items.size, 600, 'pruning must not mutate prior state');
assert.equal(retainCatalogueSnapshots(votes, 'owner-b:vote-a', items).items.size, 0, 'another owner must not inherit snapshots');
assert.equal(retainCatalogueSnapshots(votes, 'owner-a:vote-b', items).items.size, 0, 'another voting session must not inherit snapshots');
assert.equal(retainCatalogueSnapshots(votes, 'owner-a:vote-a', []).items.size, 0, 'an empty dataset must release all snapshots');

const series = { contentType: 'series' as const, tmdbId: 1 };
const both = retainCatalogueSnapshots(pruned, 'owner-a:vote-a', [items[0]!, series], [[series, { title: 'TV title', posterUrl: null, genres: [] }]]);
assert.equal(both.items.size, 2);
assert.equal(both.items.get(catalogueSnapshotKey(items[0]!))?.title, 'Title 1');
assert.equal(both.items.get(catalogueSnapshotKey(series))?.title, 'TV title');

const initialDataset = { scope: 'owner-a:calendar', items };
assert.equal(isCurrentCatalogueSnapshotDataset(initialDataset, 'owner-a:calendar', items), true);
assert.equal(isCurrentCatalogueSnapshotDataset({ scope: 'owner-b:calendar', items }, 'owner-a:calendar', items), false,
  'an owner change must reject completion before effect cleanup');
assert.equal(isCurrentCatalogueSnapshotDataset({ scope: 'owner-a:calendar', items: [...items] }, 'owner-a:calendar', items), false,
  'a replaced dataset must reject completion even with the same IDs');
const failedUpdate = { ...existing, title: 'Stale completion' };
const nextDataset = { scope: 'owner-b:calendar', items: [items[0]!] };
const afterLateCompletion = isCurrentCatalogueSnapshotDataset(nextDataset, initialDataset.scope, initialDataset.items)
  ? retainCatalogueSnapshots(pruned, initialDataset.scope, items, [[items[0]!, failedUpdate]]) : pruned;
assert.equal(afterLateCompletion, pruned, 'a stale batch must leave current state untouched');

const calendarSource = readFileSync(new URL('../notifications/ReleaseCalendarScreen.tsx', import.meta.url), 'utf8');
const voteSource = readFileSync(new URL('../watchlists/SharedVoteScreen.tsx', import.meta.url), 'utf8');
assert.match(calendarSource, /JSON\.stringify\(\[ownerId, items\.map\(catalogueSnapshotKey\)\]\)/,
  'calendar state must be tagged with its owner and dataset');
assert.match(calendarSource, /artwork\.scope === artworkScope \? artwork\.items\.get/,
  'rendering must reject another owner/dataset synchronously');
assert.match(calendarSource, /setArtwork\(\(current\) => isCurrent\(\) \? retainCatalogueSnapshots/,
  'queued updates must recheck owner/dataset liveness');
assert.match(calendarSource, /offset \+= 3/, 'existing request concurrency must stay unchanged');
assert.match(voteSource, /candidateSnapshots\.scope === cacheKey \? candidateSnapshots\.items\.get/,
  'vote rendering must reject another owner/session synchronously');
assert.match(voteSource, /preloadCatalogueItems\(session\.candidates\.map/,
  'snapshot retention must preserve the existing preload path');
console.log('Catalogue row snapshots, eviction, pruning and owner/dataset isolation QA passed.');
