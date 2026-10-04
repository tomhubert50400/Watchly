import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { CatalogueController } from './catalogue.controller';
import { homeCategories, homeCategoryQuery, selectHomeCategories } from './home-categories';
import { TmdbCatalogueService } from './tmdb-catalogue.service';
import type { PrismaService } from '../database/prisma.service';

async function main() {
  const now = new Date('2026-10-04T12:00:00Z');
  const selection = selectHomeCategories('KR', now);
  assert.equal(selection.length, 9);
  assert.deepEqual(selection, selectHomeCategories('KR', new Date('2026-10-05T12:00:00Z')));
  assert.notDeepEqual(selection, selectHomeCategories('KR', new Date('2026-10-07T12:00:00Z')));
  assert.equal(selectHomeCategories(undefined, now).length, 9);
  assert(!selectHomeCategories(undefined, now).some(category => category.id === 'local'));
  const seen = new Set<string>();
  for (let cycle = 0; cycle < 13; cycle += 1) {
    const categories = selectHomeCategories('KR', new Date(now.getTime() + cycle * 3 * 86400000));
    assert.equal(new Set(categories.map(category => category.id)).size, 9);
    assert(categories.some(category => category.id === 'local'));
    categories.forEach(category => seen.add(category.id));
  }
  assert.equal(seen.size, homeCategories.length, 'Every supported category participates in rotation.');
  assert.equal(homeCategoryQuery('local', 'movie', 1, 'KR', now).params.with_origin_country, 'KR');
  assert.equal(homeCategoryQuery('local', 'movie', 1, 'KR', now).params['vote_count.gte'], '100');
  assert.equal(homeCategoryQuery('all-time', 'movie', 1, undefined, now).params['vote_count.gte'], '2000');
  assert.equal(homeCategoryQuery('all-time', 'series', 1, undefined, now).params['vote_count.gte'], '500');
  assert.equal(homeCategoryQuery('recent', 'series', 1, undefined, now).params['first_air_date.gte'], '2026-04-04');
  assert.equal(homeCategoryQuery('1990s', 'movie', 1, undefined, now).params['primary_release_date.lte'], '1999-12-31');
  assert.equal(homeCategoryQuery('2000s', 'series', 1, undefined, now).params['first_air_date.lte'], '2009-12-31');
  assert.equal(homeCategoryQuery('short', 'movie', 1, undefined, now).params['with_runtime.lte'], '89');
  assert.equal(homeCategoryQuery('blockbusters', 'movie', 1, undefined, now).params.sort_by, 'revenue.desc');
  assert.equal(homeCategoryQuery('sci-fi', 'movie', 1, undefined, now).params.with_genres, '878|14');
  assert.equal(homeCategoryQuery('sci-fi', 'series', 1, undefined, now).params.with_genres, '10765');

  const originalFetch = globalThis.fetch;
  const urls: URL[] = [];
  let failedType: string | undefined;
  try {
    globalThis.fetch = (async input => {
      const url = new URL(String(input));
      urls.push(url);
      if (failedType && url.pathname.includes(failedType)) throw new Error('offline');
      const series = url.pathname.includes('/tv');
      const page = Number(url.searchParams.get('page'));
      return new Response(JSON.stringify({ total_pages: 3, results: Array.from({ length: 20 }, (_, index) => ({
        id: page * 100 + index, ...(series ? { name: `Series ${index}` } : { title: `Movie ${index}` }),
        poster_path: '/poster.jpg', release_date: '2005-01-01', first_air_date: '2005-01-01',
      })) }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    const service = new TmdbCatalogueService(new ConfigService({ TMDB_ACCESS_TOKEN: 'test' }), {} as PrismaService);
    const pages = await Promise.all([1, 2, 3].map(page => service.homeCategory('comedy', page)));
    assert(pages.every(page => page.items.length === 20));
    assert(pages.every(page => page.items.filter(item => item.mediaType === 'series').length === 10));
    const ids = pages.flatMap(page => page.items.map(item => item.id));
    assert.equal(new Set(ids).size, 60, 'Pagination must not repeat or skip the second half of a TMDB page.');
    assert.deepEqual(pages[1].items.filter(item => item.mediaType === 'movie').map(item => item.tmdbId), Array.from({ length: 10 }, (_, index) => 110 + index));
    assert.equal(urls.length, 4, 'Adjacent logical pages reuse cached/coalesced TMDB pages.');
    assert.equal((await service.homeCategory('comedy', 6)).hasMore, false);
    const local = await service.homeCategory('local', 1, 'KR');
    assert.equal(local.items.length, 20);
    assert(local.items.every(item => item.mediaType === 'movie'));
    assert(urls.some(url => url.searchParams.get('with_origin_country') === 'KR'));
    const france = await service.homeCategory('local', 1, 'FR');
    assert.equal(france.items.length, 20);
    assert(urls.some(url => url.searchParams.get('with_origin_country') === 'FR'), 'Country changes must not reuse another country query.');
    const count = urls.length;
    assert.equal((await service.homeCategory('local')).items.length, 0);
    assert.equal(urls.length, count, 'An unknown country must not default to another country.');
    const home = await service.homeCategories('KR');
    assert.equal(home.items.length, 9);
    assert(home.items.every(category => category.items.length === 20));
    failedType = '/tv';
    const partialService = new TmdbCatalogueService(new ConfigService({ TMDB_ACCESS_TOKEN: 'test' }), {} as PrismaService);
    const partial = await partialService.homeCategory('animation');
    assert.equal(partial.partial, true);
    assert.equal(partial.items.length, 20, 'A working format remains usable.');
    failedType = '/';
    const failedService = new TmdbCatalogueService(new ConfigService({ TMDB_ACCESS_TOKEN: 'test' }), {} as PrismaService);
    await assert.rejects(() => failedService.homeCategories(), /temporarily unavailable/);
    const controller = new CatalogueController(service);
    await assert.rejects(() => controller.homeCategory('unknown'));
    await assert.rejects(() => controller.homeCategory('comedy', '0'));
    await assert.rejects(() => controller.homeCategory('comedy', '501'));
    await assert.rejects(() => controller.homeCategories('Korea'));
  } finally { globalThis.fetch = originalFetch; }
  console.log('Home categories QA passed: rotation, country, filters, 20 titles, pagination, cache and failures.');
}
void main();
