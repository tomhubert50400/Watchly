import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { DiscoverController } from './discover.controller';
import { DiscoverService } from './discover.service';
import { TmdbCatalogueService } from './tmdb-catalogue.service';
import { discoverMoods, moodSelections, rankDiscoverTitles, type DiscoverTitle } from './discover-model';
import type { PrismaService } from '../database/prisma.service';

const title = (tmdbId: number, mediaType: 'movie' | 'series' = 'movie'): DiscoverTitle => ({
  id: `${mediaType}:${tmdbId}`, tmdbId, mediaType, title: `Title ${tmdbId}`, overview: '', posterUrl: '/poster', backdropUrl: '/backdrop', releaseDate: '2005-01-01', voteAverage: 8, genreIds: [18],
});

async function main() {
  assert.equal(discoverMoods.length, 8);
  for (const mood of discoverMoods) for (const type of ['movie', 'series'] as const) assert(moodSelections[mood][type].length >= 3);
  const ranked = rankDiscoverTitles([title(3), title(2), title(2), title(2, 'series'), title(4)], [{ item: title(1), recommendations: [title(2)] }], new Set(['movie:4']), null);
  assert.equal(ranked[0].tmdbId, 2);
  assert.equal(ranked[0].reason, 'Because you liked Title 1');
  assert.equal(ranked[1].mediaType, 'series');
  assert(!ranked[1].reason.startsWith('Because'), 'Movie preference must not produce a false TV explanation.');
  assert.equal(ranked.length, 3, 'Deduplicate by type and ID, and exclude watched titles.');

  const queries: unknown[] = [];
  const db = {
    withConnectionRetry: (fn: () => unknown) => fn(),
    user: { findUnique: async (query: unknown) => { queries.push(query); return { id: 'user-a' }; } },
    userContentState: { findMany: async () => [{ contentType: 'MOVIE', tmdbId: 1, favorite: true, status: 'WATCHED' }, { contentType: 'MOVIE', tmdbId: 9, favorite: true, status: 'DROPPED' }] },
    userMovieRating: { findMany: async () => [{ tmdbId: 1, scoreHalfSteps: 9 }, { tmdbId: 9, scoreHalfSteps: 2 }] },
    userSeriesRating: { findMany: async () => [] },
    userEpisodeProgress: { findMany: async () => [{ seriesTmdbId: 3 }] },
    viewingEvent: { findMany: async () => [{ contentType: 'MOVIE', tmdbId: 4 }] },
  } as unknown as PrismaService;
  const requestedSeeds: number[] = [];
  const catalogue = {
    discoverTitle: async (type: 'movie' | 'series', id: number) => { requestedSeeds.push(id); return { item: title(id, type), recommendations: [title(2, type)] }; },
    discoverCandidates: async (type: 'movie' | 'series') => [1, 2, 3, 4, 9].map(id => title(id, type)),
  } as unknown as TmdbCatalogueService;
  const service = new DiscoverService(db, catalogue);
  const guest = await service.home();
  assert.equal(queries.length, 0, 'Anonymous discovery must not read a user.');
  assert.equal(guest.personalized, false);
  const personal = await service.home('firebase-a');
  assert.deepEqual(queries[0], { where: { firebaseUid: 'firebase-a' }, select: { id: true } });
  assert.deepEqual(requestedSeeds, [1], 'Deduplicate positive seeds and reject a low-rated favorite.');
  assert(personal.personalized);
  for (const id of ['movie:1', 'movie:4', 'movie:9', 'series:3']) assert(!personal.items.some(item => item.id === id));
  assert(personal.items.some(item => item.id === 'movie:2' && item.reason.includes('Title 1')));
  const mood = await service.home(undefined, 'comfort');
  assert(mood.items.every(item => moodSelections.comfort[item.mediaType].includes(item.tmdbId)), 'Recommendations must never broaden an editorial mood silently.');
  const controller = new DiscoverController(service);
  assert.throws(() => controller.home({ headers: {} }, 'invalid'));
  assert.throws(() => controller.collection('2000s', '0'));
  assert.throws(() => controller.collection('unknown'));

  const originalFetch = globalThis.fetch;
  const urls: URL[] = [];
  try {
    globalThis.fetch = (async (input: string | URL | Request) => {
      urls.push(new URL(String(input)));
      return new Response(JSON.stringify({ results: [{ id: 2, title: 'Example', release_date: '2005-01-01' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    const tmdb = new TmdbCatalogueService(new ConfigService({ TMDB_ACCESS_TOKEN: 'test' }), db);
    await Promise.all([tmdb.discoverCandidates('movie', '2000s'), tmdb.discoverCandidates('movie', '2000s')]);
    assert.equal(urls.length, 1, 'Coalesce concurrent catalogue calls.');
    await tmdb.discoverCandidates('movie', '2000s');
    assert.equal(urls.length, 1, 'Cache only public TMDB data.');
    assert.equal(urls[0].searchParams.get('primary_release_date.gte'), '2000-01-01');
    assert.equal(urls[0].searchParams.get('primary_release_date.lte'), '2009-12-31');
    await tmdb.discoverCandidates('series', '1990s', 2);
    assert.equal(urls[1].searchParams.get('first_air_date.gte'), '1990-01-01');
    assert.equal(urls[1].searchParams.get('page'), '2');
  } finally { globalThis.fetch = originalFetch; }
  const failed = new DiscoverService(db, { discoverCandidates: async () => { throw new Error('offline'); } } as unknown as TmdbCatalogueService);
  await assert.rejects(() => failed.home(), /temporarily unavailable/);
  console.log('Discover QA passed: ranking, formats, exclusions, moods, identity scope, validation, caching and failures.');
}
void main();
