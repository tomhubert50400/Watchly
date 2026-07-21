import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { TmdbCatalogueService } from './tmdb-catalogue.service';

async function main() {
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
