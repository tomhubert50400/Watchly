import assert from 'node:assert/strict';
import { BadGatewayException, BadRequestException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../database/prisma.service';
import { CatalogueController } from './catalogue.controller';
import { TmdbCatalogueService } from './tmdb-catalogue.service';

export async function testActorSearch() {
  const originalFetch = globalThis.fetch;
  const service = new TmdbCatalogueService({ get: () => 'test-token' } as unknown as ConfigService, {} as PrismaService);
  const controller = new CatalogueController(service);
  let status = 200;
  let empty = false;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get('language'), 'en-US');
    if (url.pathname.endsWith('/search/person')) {
      assert.equal(url.searchParams.get('query'), 'John Carter');
      assert.equal(url.searchParams.get('include_adult'), 'false');
      return Response.json({ results: empty ? [] : [
        { id: 1, name: 'John Carter', known_for_department: 'Acting', profile_path: '/john.jpg' },
        { id: 2, name: 'John Carter', known_for_department: 'Acting', profile_path: null },
        { id: 3, name: 'John Carter', known_for_department: 'Directing' },
      ] }, { status });
    }
    if (url.pathname.includes('/search/')) {
      return Response.json({ results: [{ id: 1, title: 'John Carter', name: 'John Carter', poster_path: '/film.jpg' }] });
    }
    assert.equal(url.pathname, '/3/person/1');
    assert.equal(url.searchParams.get('append_to_response'), 'combined_credits');
    return Response.json({ id: 1, name: 'John Carter', biography: '', profile_path: null, combined_credits: { cast: [
      { id: 1, media_type: 'movie', title: 'John Carter', popularity: 10 },
      { id: 1, media_type: 'movie', title: 'John Carter', popularity: 10 },
      { id: 1, media_type: 'tv', name: 'Same ID, different title', popularity: 20 },
      { id: 2, media_type: 'movie', title: 'Adult credit', adult: true },
      { id: 3, media_type: 'person', name: 'Invalid credit' },
    ] } }, { status });
  }) as typeof fetch;
  try {
    await assert.rejects(controller.searchActors(' a '), BadRequestException);
    await assert.rejects(controller.actorDetails(0), BadRequestException);
    const actors = await controller.searchActors(' John Carter ');
    assert.deepEqual(actors.items.map(item => item.tmdbId), [1, 2], 'homonymous actors stay distinct; crew is excluded');
    assert.equal(actors.items[0].profileUrl, 'https://image.tmdb.org/t/p/w342/john.jpg');
    assert.equal(actors.items[1].profileUrl, null, 'actors without portraits remain searchable');
    const titles = await service.search('John Carter', 'all');
    assert.equal(titles.items.length, 2, 'actor match must not replace movie or TV matches');
    const detail = await controller.actorDetails(1);
    assert.deepEqual(detail.item.credits.map(item => item.id), ['series:1', 'movie:1']);
    assert.equal(detail.item.credits[1].posterUrl, null, 'filmography keeps credits without posters');
    assert.equal(detail.item.biography, '');
    empty = true;
    assert.deepEqual((await controller.searchActors('John Carter')).items, []);
    status = 503;
    await assert.rejects(controller.searchActors('John Carter'), BadGatewayException);
    assert.equal((await service.search('John Carter', 'movie')).items.length, 1, 'actor failure leaves title search available');
    status = 404;
    await assert.rejects(controller.actorDetails(1), NotFoundException);
    console.log('Actor search and filmography QA passed.');
  } finally {
    globalThis.fetch = originalFetch;
  }
}
