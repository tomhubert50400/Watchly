import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import {
  chooseWeeklySpotlight,
  getSpotlightExpiry,
  isSpotlightActive,
  SPOTLIGHT_DURATION_MS,
} from './catalogue-spotlight';
import {
  compareAnnouncedCandidates,
  isAnnouncedReleaseDate,
  TmdbCatalogueService,
} from './tmdb-catalogue.service';

async function main() {
  testAnnouncedSelection();
  testWeeklySpotlightSelection();

  const requestedUrls: string[] = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    requestedUrls.push(url);

    if (url.includes('/search/movie?')) {
      return jsonResponse({
        results: [
          { id: 1, title: 'Breaking News' },
          { id: 2, title: "Breakin'" },
        ],
      });
    }

    if (url.includes('/search/tv?')) {
      return jsonResponse({
        results: [
          { id: 3, name: 'Breaking Bad' },
          { id: 4, name: 'Breaking News' },
        ],
      });
    }

    return jsonResponse({
      results: [{ id: 5, media_type: 'tv', name: 'New School Breakin' }],
    });
  }) as typeof fetch;

  const config = { get: () => 'test-token' } as unknown as ConfigService;
  const service = new TmdbCatalogueService(config, {} as PrismaService);

  try {
    const series = await service.search('breakin', 'series');

    assert.deepEqual(series.items.map((item) => item.title), ['Breaking Bad', 'Breaking News']);
    assert(series.items.every((item) => item.mediaType === 'series'));
    assert.deepEqual(requestedPaths(requestedUrls), ['/3/search/tv']);

    requestedUrls.length = 0;
    const movies = await service.search('breakin', 'movie');

    assert.deepEqual(movies.items.map((item) => item.title), ['Breaking News', "Breakin'"]);
    assert(movies.items.every((item) => item.mediaType === 'movie'));
    assert.deepEqual(requestedPaths(requestedUrls), ['/3/search/movie']);

    requestedUrls.length = 0;
    const all = await service.search('breakin', 'all');

    assert.deepEqual(
      all.items.map((item) => `${item.mediaType}:${item.title}`),
      [
        'movie:Breaking News',
        'series:Breaking Bad',
        "movie:Breakin'",
        'series:Breaking News',
      ],
      'all search interleaves the provider-ranked film and series results',
    );
    assert.deepEqual(requestedPaths(requestedUrls).sort(), ['/3/search/movie', '/3/search/tv']);
    assert(
      requestedUrls.every((url) => new URL(url).searchParams.get('query') === 'breakin'),
      'each specialized search receives the complete query',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log('Catalogue search QA passed.');
}

function testAnnouncedSelection() {
  const duringGrace = new Date('2026-07-26T04:00:00.000Z');
  const afterGrace = new Date('2026-07-26T07:00:00.000Z');

  assert.equal(
    isAnnouncedReleaseDate('2026-07-25', duringGrace),
    true,
    'a release from the previous UTC date remains announced during the six-hour grace period',
  );
  assert.equal(
    isAnnouncedReleaseDate('2026-07-25', afterGrace),
    false,
    'the previous release date leaves Coming soon after the six-hour grace period',
  );
  assert.equal(
    isAnnouncedReleaseDate('2026-07-26', afterGrace),
    true,
    'a release from the current UTC date remains in Coming soon',
  );

  const candidates = [
    { id: 1, popularity: 5, release_date: '2026-07-26' },
    { id: 2, popularity: 300, release_date: '2026-08-10' },
    { id: 3, popularity: 300, release_date: '2026-08-01' },
  ];

  assert.deepEqual(
    candidates.sort(compareAnnouncedCandidates).map((candidate) => candidate.id),
    [3, 2, 1],
    'Coming soon ranks by popularity before using the nearest release date as a tie-breaker',
  );
}

function testWeeklySpotlightSelection() {
  const selectedAt = new Date('2026-07-25T05:00:00.000Z');
  const candidates = [
    {
      backdrop_path: '/future.jpg',
      id: 1,
      release_date: '2026-07-28',
      title: 'Future release',
    },
    {
      backdrop_path: null,
      id: 2,
      release_date: '2026-07-24',
      title: 'Missing backdrop',
    },
    {
      backdrop_path: '/weekly-number-one.jpg',
      id: 3,
      release_date: '2026-07-15',
      title: 'Weekly number one',
    },
    {
      backdrop_path: '/lower-ranked.jpg',
      id: 4,
      release_date: '2026-06-10',
      title: 'Lower ranked',
    },
  ];

  assert.equal(
    chooseWeeklySpotlight(candidates, selectedAt)?.id,
    3,
    'the first released weekly trend with a backdrop becomes the spotlight',
  );

  const expiresAt = getSpotlightExpiry(selectedAt);

  assert.equal(expiresAt.getTime() - selectedAt.getTime(), SPOTLIGHT_DURATION_MS);
  assert.equal(
    isSpotlightActive(expiresAt, new Date(expiresAt.getTime() - 1)),
    true,
    'the spotlight stays active before its expiry',
  );
  assert.equal(
    isSpotlightActive(expiresAt, expiresAt),
    false,
    'the spotlight can be replaced once its full seven-day window has elapsed',
  );
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status: 200,
  });
}

function requestedPaths(urls: readonly string[]) {
  return urls.map((url) => new URL(url).pathname);
}

void main();
