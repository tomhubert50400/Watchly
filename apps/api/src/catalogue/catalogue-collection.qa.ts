import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { BadGatewayException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CatalogueController } from './catalogue.controller';
import { TmdbCatalogueService } from './tmdb-catalogue.service';

async function main() {
  const originalFetch = globalThis.fetch;
  const requested: string[] = [];
  let status = 200;
  let ratingCount = 0;
  const service = new TmdbCatalogueService({ get: () => 'test-token' } as unknown as ConfigService, {
    userMovieRating: { aggregate: async () => ({ _avg: { scoreHalfSteps: ratingCount ? 9 : null }, _count: { _all: ratingCount } }) },
    withConnectionRetry: async <T>(operation: () => Promise<T>) => operation(),
  } as unknown as PrismaService);
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    requested.push(url);
    const payload = url.includes('/collection/') ? {
      name: 'Test collection',
      parts: [
        { id: 2, title: 'Second film', release_date: '2022-01-01', poster_path: '/second.jpg' },
        { id: 1, title: 'First film', release_date: '2021-01-01', poster_path: null },
        { id: 3, title: 'Undated film', release_date: '' },
        { id: 4 },
      ],
    } : { id: 1, title: 'First film', vote_average: 8.2, vote_count: 12000, belongs_to_collection: { id: 10, name: 'Test collection' } };
    return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    const movie = await service.getMovie(1);
    assert.deepEqual(movie.item.collection, { id: 10, name: 'Test collection' });
    const result = await new CatalogueController(service).collectionDetails(10);
    assert.equal(result.provider, 'tmdb');
    assert.deepEqual(result.items.map((item) => item.tmdbId), [2, 1, 3]);
    assert.equal(result.items[1].posterUrl, null, 'missing artwork must not drop a film from a saga');
    assert.equal(result.items[2].releaseDate, null);
    assert.match(requested[1], /\/collection\/10\?language=en-US/);
    assert.deepEqual(movie.item.displayRating, { average: 8.2, count: 12000, scale: 10, source: 'tmdb' });
    ratingCount = 99;
    assert.equal((await service.getMovie(2)).item.displayRating?.source, 'tmdb');
    ratingCount = 100;
    assert.deepEqual((await service.getMovie(3)).item.displayRating, { average: 4.5, count: 100, scale: 5, source: 'watchly' });
    status = 404;
    await assert.rejects(service.getCollection(999), NotFoundException);
    status = 503;
    await assert.rejects(service.getCollection(10), BadGatewayException);
    console.log('Catalogue collection QA passed.');
  } finally {
    globalThis.fetch = originalFetch;
  }
}
void main();
