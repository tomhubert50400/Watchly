import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { CatalogueController } from './catalogue.controller';
import {
  chooseWeeklySpotlight,
  getSpotlightExpiry,
  isSpotlightActive,
  SPOTLIGHT_DURATION_MS,
} from './catalogue-spotlight';
import {
  buildDiscoveryEndpoint,
  buildGenreMovieEndpoint,
  buildPopularEndpoint,
  compareAnnouncedCandidates,
  isAnnouncedReleaseDate,
  selectTmdbLogoAsset,
  TmdbCatalogueService,
} from './tmdb-catalogue.service';

async function main() {
  testCatalogueDetailRateLimits();
  testAnnouncedSelection();
  testDiscoveryEndpoints();
  testGenreMovieEndpoints();
  testPopularEndpoints();
  testLogoSelection();
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

    if (url.includes('/genre/movie/list?')) {
      return jsonResponse({
        genres: [
          { id: 18, name: 'Drama' },
          { id: 28, name: 'Action' },
        ],
      });
    }

    if (url.includes('/genre/tv/list?')) {
      return jsonResponse({
        genres: [
          { id: 18, name: 'Drama' },
          { id: 35, name: 'Comedy' },
        ],
      });
    }

    if (url.includes('/trending/movie/day?')) {
      return jsonResponse({
        results: [{ genre_ids: [18], id: 10, release_date: '2020-01-01', title: 'Trending Film' }],
      });
    }

    if (url.includes('/trending/movie/week?')) {
      return jsonResponse({
        results: [{ backdrop_path: '/spotlight.jpg', id: 11, release_date: '2020-01-01', title: 'Spotlight Film' }],
      });
    }

    if (url.includes('/trending/tv/day?')) {
      return jsonResponse({
        results: [{ first_air_date: '2025-01-01', genre_ids: [18, 35], id: 12, name: 'Trending Series' }],
      });
    }

    if (url.includes('/movie/popular?')) {
      const page = Number(new URL(url).searchParams.get('page') ?? '1');

      return jsonResponse({
        results: Array.from({ length: 20 }, (_, index) => ({
          id: page * 1000 + index,
          poster_path: `/popular-movie-${page}-${index}.jpg`,
          release_date: '2000-01-01',
          title: `Popular Movie ${page}-${index}`,
        })),
      });
    }

    if (url.includes('/tv/popular?')) {
      const page = Number(new URL(url).searchParams.get('page') ?? '1');

      return jsonResponse({
        results: Array.from({ length: 20 }, (_, index) => ({
          first_air_date: '2000-01-01',
          id: page * 2000 + index,
          name: `Popular Series ${page}-${index}`,
          poster_path: `/popular-series-${page}-${index}.jpg`,
        })),
      });
    }

    if (url.includes('/discover/tv?')) {
      return jsonResponse({
        results: [{ first_air_date: '2099-01-01', genre_ids: [18], id: 13, name: 'Upcoming Series' }],
      });
    }

    if (url.includes('/discover/movie?') && new URL(url).searchParams.has('with_genres')) {
      const page = Number(new URL(url).searchParams.get('page') ?? '1');

      return jsonResponse({
        results: Array.from({ length: 20 }, (_, index) => ({
          genre_ids: [18],
          id: page * 3000 + index,
          poster_path: `/genre-movie-${page}-${index}.jpg`,
          release_date: '2000-01-01',
          title: `Drama Movie ${page}-${index}`,
        })),
      });
    }

    if (url.includes('/discover/movie?')) {
      return jsonResponse({
        results: [{ genre_ids: [18], id: 14, release_date: '2099-01-01', title: 'Upcoming Film' }],
      });
    }

    if (url.includes('/movie/upcoming?')) {
      return jsonResponse({
        results: [{ genre_ids: [18], id: 14, release_date: '2099-01-01', title: 'Upcoming Film' }],
      });
    }

    if (url.includes('/tv/1396/season/1/episode/2?')) {
      return jsonResponse({
        credits: {
          cast: [
            {
              character: 'Second actor',
              id: 2,
              name: 'Actor Two',
              order: 1,
              profile_path: null,
            },
            {
              character: 'Lead',
              id: 1,
              name: 'Actor One',
              order: 0,
              profile_path: '/actor-one.jpg',
            },
          ],
          crew: [
            {
              department: 'Production',
              id: 13,
              job: 'Producer',
              name: 'Crew Three',
              profile_path: null,
            },
            {
              department: 'Writing',
              id: 12,
              job: 'Writer',
              name: 'Crew Two',
              profile_path: '/crew-two.jpg',
            },
            {
              department: 'Directing',
              id: 11,
              job: 'Director',
              name: 'Crew One',
              profile_path: '/crew-one.jpg',
            },
            {
              department: 'Writing',
              id: 11,
              job: 'Writer',
              name: 'Crew One',
              profile_path: '/crew-one.jpg',
            },
          ],
          guest_stars: [
            {
              character: 'Duplicate guest credit',
              id: 2,
              name: 'Actor Two',
              order: 500,
              profile_path: null,
            },
            {
              character: 'Guest',
              id: 3,
              name: 'Actor Three',
              order: 501,
              profile_path: '/actor-three.jpg',
            },
            {
              character: 'Unknown',
              id: 4,
              order: 502,
              profile_path: null,
            },
          ],
        },
        episode_number: 2,
        id: 102,
        name: 'Cat in the Bag...',
        season_number: 1,
      });
    }

    if (url.includes('/tv/1396/season/1?')) {
      return jsonResponse({
        episodes: [],
        id: 101,
        name: 'Season 1',
        season_number: 1,
      });
    }

    if (url.includes('/movie/603?')) {
      return jsonResponse({
        budget: 63000000,
        credits: {
          cast: [
            { character: 'Neo', id: 1, name: 'Keanu Reeves', order: 0, profile_path: '/neo.jpg' },
          ],
          crew: [
            { department: 'Directing', id: 2, job: 'Director', name: 'Lana Wachowski' },
            { department: 'Writing', id: 3, job: 'Screenplay', name: 'Lilly Wachowski' },
          ],
        },
        id: 603,
        images: { logos: [] },
        keywords: { keywords: [{ id: 4, name: 'artificial reality' }] },
        original_title: 'The Matrix',
        production_companies: [{ id: 5, logo_path: '/warner.png', name: 'Warner Bros.' }],
        recommendations: {
          results: [{ id: 604, poster_path: '/matrix-reloaded.jpg', release_date: '2003-05-15', title: 'The Matrix Reloaded' }],
        },
        revenue: 463517383,
        title: 'The Matrix',
        videos: {
          results: [{ id: 'trailer-1', key: 'vKQi3bBA1y8', name: 'Official Trailer', official: true, published_at: '1999-01-01T00:00:00.000Z', site: 'YouTube', type: 'Trailer' }],
        },
      });
    }

    if (url.includes('/tv/1396?')) {
      return jsonResponse({
        created_by: [{ id: 1, name: 'Vince Gilligan', profile_path: '/vince.jpg' }],
        credits: {
          cast: [{ character: 'Walter White', id: 2, name: 'Bryan Cranston', order: 0, profile_path: '/bryan.jpg' }],
        },
        id: 1396,
        images: {
          logos: [
            {
              file_path: '/breaking-bad.png',
              height: 300,
              iso_639_1: 'en',
              vote_average: 8,
              width: 900,
            },
          ],
        },
        keywords: { results: [{ id: 3, name: 'new mexico' }] },
        last_air_date: '2013-09-29',
        name: 'Breaking Bad',
        networks: [{ id: 4, logo_path: '/amc.png', name: 'AMC' }],
        original_name: 'Breaking Bad',
        production_companies: [{ id: 5, logo_path: null, name: 'Sony Pictures Television' }],
        recommendations: {
          results: [{ first_air_date: '2015-02-08', id: 60059, name: 'Better Call Saul', poster_path: '/saul.jpg' }],
        },
        videos: {
          results: [{ id: 'tv-trailer-1', key: 'HhesaQXLuRY', name: 'Series Trailer', official: true, site: 'YouTube', type: 'Trailer' }],
        },
      });
    }

    return jsonResponse({
      results: [{ id: 5, media_type: 'tv', name: 'New School Breakin' }],
    });
  }) as typeof fetch;

  const config = { get: () => 'test-token' } as unknown as ConfigService;
  const prisma = {
    catalogueSpotlight: {
      findUnique: async () => null,
      upsert: async () => null,
    },
    userMovieRating: {
      aggregate: async () => ({ _avg: { scoreHalfSteps: null }, _count: { _all: 0 } }),
    },
    withConnectionRetry: async <T>(operation: () => Promise<T>) => operation(),
  } as unknown as PrismaService;
  const service = new TmdbCatalogueService(config, prisma);

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
    assertEnglishTmdbRequests(requestedUrls, 'catalogue search');

    requestedUrls.length = 0;
    await service.trending();
    assertEnglishTmdbRequests(requestedUrls, 'daily trending');

    requestedUrls.length = 0;
    const sections = await service.movieSections();
    assert.equal(requestedUrls.length, 9);
    assert.deepEqual(sections.trendingSeries.map((item) => item.title), ['Trending Series']);
    assert.deepEqual(sections.announcedSeries.map((item) => item.title), ['Upcoming Series']);
    assertEnglishTmdbRequests(requestedUrls, 'movie sections');

    requestedUrls.length = 0;
    const discovery = await service.discovery('trending', 'series');
    assert.equal(requestedUrls.length, 4);
    assert.deepEqual(discovery.items, [
      {
        genres: ['Drama', 'Comedy'],
        id: 'series:12',
        mediaType: 'series',
        overview: '',
        posterUrl: null,
        releaseDate: '2025-01-01',
        title: 'Trending Series',
        tmdbId: 12,
        voteAverage: null,
      },
    ]);
    assertEnglishTmdbRequests(requestedUrls, 'extended catalogue discovery');

    requestedUrls.length = 0;
    const tasteOptions = await service.onboardingTasteOptions();
    assert.equal(tasteOptions.movies.length, 21);
    assert.equal(tasteOptions.series.length, 21);
    assert.deepEqual(tasteOptions.movieGenres, [
      { id: 28, name: 'Action' },
      { id: 18, name: 'Drama' },
    ]);
    assert.equal(tasteOptions.movies[0]?.title, 'Popular Movie 1-0');
    assert.equal(tasteOptions.series[20]?.title, 'Popular Series 2-0');
    assert.deepEqual(
      requestedUrls
        .filter((url) => url.includes('/popular?'))
        .map((url) => new URL(url).searchParams.get('page'))
        .sort(),
      ['1', '1', '2', '2'],
      'taste options must load two pages for each media type to produce 21 cards',
    );
    assertEnglishTmdbRequests(requestedUrls, 'onboarding taste options');

    requestedUrls.length = 0;
    const dramaTasteOptions = await service.onboardingTasteOptions(18);
    assert.equal(dramaTasteOptions.movies.length, 21);
    assert.equal(dramaTasteOptions.movies[0]?.title, 'Drama Movie 1-0');
    assert.equal(dramaTasteOptions.series.length, 21);
    assert.equal(
      requestedUrls.filter((url) => url.includes('/discover/movie?')).length,
      2,
      'genre Taste options must load two discover pages for 21 movie cards',
    );
    assert(
      requestedUrls
        .filter((url) => url.includes('/discover/movie?'))
        .every((url) => new URL(url).searchParams.get('with_genres') === '18'),
      'genre Taste options must apply the selected TMDB genre to every movie page',
    );
    assertEnglishTmdbRequests(requestedUrls, 'genre onboarding taste options');

    requestedUrls.length = 0;
    const movieDetails = await service.getMovie(603);
    assert.equal(movieDetails.item.budget, 63000000);
    assert.deepEqual(movieDetails.item.directors, ['Lana Wachowski']);
    assert.deepEqual(movieDetails.item.writers, ['Lilly Wachowski']);
    assert.equal(movieDetails.item.cast[0]?.character, 'Neo');
    assert.equal(movieDetails.item.videos[0]?.key, 'vKQi3bBA1y8');
    assert.equal(movieDetails.item.recommendations[0]?.title, 'The Matrix Reloaded');
    assertEnglishTmdbRequests(requestedUrls, 'movie details');
    assertEnglishLogoRequest(requestedUrls[0]!, 'movie details');
    assert.equal(
      new URL(requestedUrls[0]!).searchParams.get('append_to_response'),
      'images,credits,videos,keywords,recommendations',
      'movie details must append its lower-page catalogue data in one TMDB request',
    );

    requestedUrls.length = 0;
    await service.getSeason(1396, 1);
    assertEnglishTmdbRequests(requestedUrls, 'season details');

    requestedUrls.length = 0;
    const episode = await service.getEpisode(1396, 1, 2);

    assert.deepEqual(episode.item.cast, [
      {
        character: 'Lead',
        id: 1,
        name: 'Actor One',
        profileUrl: 'https://image.tmdb.org/t/p/w342/actor-one.jpg',
      },
      {
        character: 'Second actor',
        id: 2,
        name: 'Actor Two',
        profileUrl: null,
      },
      {
        character: 'Guest',
        id: 3,
        name: 'Actor Three',
        profileUrl: 'https://image.tmdb.org/t/p/w342/actor-three.jpg',
      },
    ]);
    assert.deepEqual(episode.item.crew, [
      {
        id: 11,
        jobs: ['Director', 'Writer'],
        name: 'Crew One',
        profileUrl: 'https://image.tmdb.org/t/p/w342/crew-one.jpg',
      },
      {
        id: 12,
        jobs: ['Writer'],
        name: 'Crew Two',
        profileUrl: 'https://image.tmdb.org/t/p/w342/crew-two.jpg',
      },
      {
        id: 13,
        jobs: ['Producer'],
        name: 'Crew Three',
        profileUrl: null,
      },
    ]);
    assert.equal(requestedUrls.length, 1);
    assert.equal(
      new URL(requestedUrls[0]!).searchParams.get('append_to_response'),
      'credits',
      'episode details must append credits without a second TMDB request',
    );
    assertEnglishTmdbRequests(requestedUrls, 'episode details');

    requestedUrls.length = 0;
    const seriesDetails = await service.getSeries(1396);

    assert.equal(
      seriesDetails.item.logoUrl,
      'https://image.tmdb.org/t/p/w500/breaking-bad.png',
      'series details must expose the selected TMDB title logo',
    );
    assert.equal(seriesDetails.item.logoAspectRatio, 3);
    assert.deepEqual(seriesDetails.item.createdBy, ['Vince Gilligan']);
    assert.equal(seriesDetails.item.cast[0]?.name, 'Bryan Cranston');
    assert.equal(seriesDetails.item.videos[0]?.type, 'Trailer');
    assert.equal(seriesDetails.item.recommendations[0]?.title, 'Better Call Saul');
    assert.equal(requestedUrls.length, 1);
    assert.equal(
      new URL(requestedUrls[0]!).searchParams.get('append_to_response'),
      'images,credits,videos,keywords,recommendations',
      'series details must append title artwork and lower-page data without a second TMDB request',
    );
    assert.equal(
      new URL(requestedUrls[0]!).searchParams.get('include_image_language'),
      'en,null',
      'series details must request English and language-neutral artwork',
    );
    assertEnglishTmdbRequests(requestedUrls, 'series details');
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log('Catalogue search QA passed.');
}

function testCatalogueDetailRateLimits() {
  for (const handler of [
    CatalogueController.prototype.movieDetails,
    CatalogueController.prototype.seriesDetails,
  ]) {
    assert.equal(
      Reflect.getMetadata('THROTTLER:LIMITdefault', handler),
      600,
      'catalogue detail hydration must have its own higher request budget',
    );
    assert.equal(Reflect.getMetadata('THROTTLER:TTLdefault', handler), 60_000);
  }
}

function testLogoSelection() {
  assert.deepEqual(
    selectTmdbLogoAsset([
      { file_path: '/english.png', height: 300, iso_639_1: 'en', vote_average: 5, width: 1200 },
      { file_path: '/neutral.png', height: 300, iso_639_1: null, vote_average: 10, width: 900 },
      { file_path: '/french.png', height: 300, iso_639_1: 'fr', vote_average: 10, width: 900 },
    ]),
    { aspectRatio: 4, path: '/english.png' },
    'English title artwork wins before language-neutral artwork',
  );
  assert.deepEqual(
    selectTmdbLogoAsset([
      { file_path: '/french.png', height: 200, iso_639_1: 'fr', vote_average: 10, width: 800 },
      { file_path: '/neutral.png', height: 200, iso_639_1: null, vote_average: 7, width: 600 },
    ]),
    { aspectRatio: 3, path: '/neutral.png' },
    'language-neutral artwork is used instead of unsupported localized artwork',
  );
  assert.equal(
    selectTmdbLogoAsset([
      { file_path: '/french.png', iso_639_1: 'fr' },
      { file_path: '/spanish.png', iso_639_1: 'es' },
    ]),
    null,
    'unsupported localized artwork is omitted',
  );
  assert.equal(selectTmdbLogoAsset([{ file_path: null, iso_639_1: 'en' }]), null);
}

function assertEnglishTmdbRequests(urls: readonly string[], label: string) {
  assert(urls.length > 0, `${label} must issue at least one TMDB request`);
  urls.forEach((url) => {
    assert.equal(
      new URL(url).searchParams.get('language'),
      'en-US',
      `${label} must request English metadata`,
    );
  });
}

function assertEnglishLogoRequest(url: string, label: string) {
  assert.equal(
    new URL(url).searchParams.get('include_image_language'),
    'en,null',
    `${label} must request English and language-neutral artwork`,
  );
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

function testDiscoveryEndpoints() {
  const baseUrl = 'https://api.themoviedb.org/3';
  const trendingSeries = new URL(buildDiscoveryEndpoint(baseUrl, 'trending', 'series', 2));
  const upcomingMovies = new URL(buildDiscoveryEndpoint(baseUrl, 'announced', 'movie', 3));
  const upcomingSeries = new URL(buildDiscoveryEndpoint(baseUrl, 'announced', 'series', 1));

  assert.equal(trendingSeries.pathname, '/3/trending/tv/day');
  assert.equal(trendingSeries.searchParams.get('page'), '2');
  assert.equal(upcomingMovies.pathname, '/3/discover/movie');
  assert.equal(upcomingMovies.searchParams.get('page'), '3');
  assert.equal(upcomingMovies.searchParams.get('sort_by'), 'popularity.desc');
  assert(upcomingMovies.searchParams.get('primary_release_date.gte'));
  assert.equal(upcomingSeries.pathname, '/3/discover/tv');
  assert.equal(upcomingSeries.searchParams.get('sort_by'), 'first_air_date.asc');
  assert(upcomingSeries.searchParams.get('first_air_date.gte'));
}

function testPopularEndpoints() {
  const baseUrl = 'https://api.themoviedb.org/3';
  const movie = new URL(buildPopularEndpoint(baseUrl, 'movie', 1));
  const series = new URL(buildPopularEndpoint(baseUrl, 'series', 2));

  assert.equal(movie.pathname, '/3/movie/popular');
  assert.equal(movie.searchParams.get('page'), '1');
  assert.equal(series.pathname, '/3/tv/popular');
  assert.equal(series.searchParams.get('page'), '2');
}

function testGenreMovieEndpoints() {
  const endpoint = new URL(buildGenreMovieEndpoint('https://api.themoviedb.org/3', 18, 2));

  assert.equal(endpoint.pathname, '/3/discover/movie');
  assert.equal(endpoint.searchParams.get('include_adult'), 'false');
  assert.equal(endpoint.searchParams.get('include_video'), 'false');
  assert.equal(endpoint.searchParams.get('page'), '2');
  assert.equal(endpoint.searchParams.get('sort_by'), 'popularity.desc');
  assert.equal(endpoint.searchParams.get('with_genres'), '18');
  assert(endpoint.searchParams.get('primary_release_date.lte'));
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
