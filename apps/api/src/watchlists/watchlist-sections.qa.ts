import 'reflect-metadata';
import assert from 'node:assert/strict';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { AuthenticatedIdentity } from '../auth/auth.types';
import { CreateWatchlistSectionDto, MoveWatchlistItemDto } from './watchlists.dto';
import { WatchlistsService } from './watchlists.service';

type SectionRecord = {
  createdAt: Date;
  id: string;
  name: string;
  position: number;
  updatedAt: Date;
  watchlistId: string;
};

async function run() {
  assert.ok((await validate(Object.assign(new CreateWatchlistSectionDto(), { name: '' }))).length);
  assert.equal((await validate(Object.assign(new CreateWatchlistSectionDto(), { name: 'Horror' }))).length, 0);
  assert.equal((await validate(Object.assign(new MoveWatchlistItemDto(), { sectionId: null }))).length, 0);
  assert.ok((await validate(Object.assign(new MoveWatchlistItemDto(), { sectionId: 'wrong' }))).length);
  assert.ok((await validate(new MoveWatchlistItemDto())).length);

  const now = new Date();
  const sections: SectionRecord[] = [];
  const items = [{
    contentType: 'MOVIE', createdAt: now, id: 'item', sectionId: null as string | null, tmdbId: 1, watchlistId: 'list',
  }];
  let nextId = 0;
  const transaction = {
    $queryRaw: async (_strings: TemplateStringsArray, watchlistId: string, userId: string) => (
      watchlistId === 'list' && userId === 'owner' ? [{ id: 'list' }] : []
    ),
    personalWatchlist: { update: async () => ({}) },
    personalWatchlistSection: {
      count: async ({ where }: { where: { watchlistId: string } }) => sections.filter((section) => section.watchlistId === where.watchlistId).length,
      create: async ({ data }: { data: { name: string; position: number; watchlistId: string } }) => {
        const section = { ...data, id: `section-${++nextId}`, createdAt: now, updatedAt: now };
        sections.push(section);
        return section;
      },
      deleteMany: async ({ where }: { where: { id: string; watchlistId: string } }) => {
        const index = sections.findIndex((section) => section.id === where.id && section.watchlistId === where.watchlistId);
        if (index < 0) return { count: 0 };
        sections.splice(index, 1);
        items.forEach((item) => { if (item.sectionId === where.id) item.sectionId = null; });
        return { count: 1 };
      },
      findFirst: async ({ orderBy, where }: { orderBy?: object; where: Record<string, unknown> }) => {
        let matches = sections.filter((section) => section.watchlistId === where.watchlistId);
        if (where.id && typeof where.id === 'string') matches = matches.filter((section) => section.id === where.id);
        if (where.id && typeof where.id === 'object') matches = matches.filter((section) => section.id !== (where.id as { not: string }).not);
        if (where.name) {
          const expected = (where.name as { equals: string }).equals.toLowerCase();
          matches = matches.filter((section) => section.name.toLowerCase() === expected);
        }
        return orderBy ? matches.sort((a, b) => b.position - a.position)[0] ?? null : matches[0] ?? null;
      },
      update: async ({ data, where }: { data: { name: string }; where: { id: string } }) => {
        const section = sections.find((candidate) => candidate.id === where.id)!;
        section.name = data.name;
        return section;
      },
    },
    personalWatchlistItem: {
      findFirst: async ({ where }: { where: { id: string; watchlistId: string } }) => items.find((item) => item.id === where.id && item.watchlistId === where.watchlistId) ?? null,
      update: async ({ data, where }: { data: { sectionId: string | null }; where: { id: string } }) => {
        const item = items.find((candidate) => candidate.id === where.id)!;
        item.sectionId = data.sectionId;
        return item;
      },
    },
  };
  const prisma = {
    $transaction: <T>(operation: (client: typeof transaction) => Promise<T>) => operation(transaction),
    withConnectionRetry: <T>(operation: () => Promise<T>) => operation(),
  };
  const auth = { getOrCreateUser: async (identity: { subject: string }) => ({ id: identity.subject }) };
  const service = new WatchlistsService(auth as never, prisma as never);
  const identity = (subject: string) => ({ subject }) as unknown as AuthenticatedIdentity;

  const horror = await service.createSection(identity('owner'), 'list', '  Horror  ');
  assert.equal(horror.name, 'Horror');
  await assert.rejects(service.createSection(identity('owner'), 'list', 'horror'), BadRequestException);
  const renamed = await service.updateSection(identity('owner'), 'list', horror.id, 'Rewatch');
  assert.equal(renamed.name, 'Rewatch');
  await assert.rejects(service.createSection(identity('stranger'), 'list', 'Hidden'), NotFoundException);
  await assert.rejects(service.moveItemToSection(identity('owner'), 'list', 'item', 'foreign'), BadRequestException);
  const moved = await service.moveItemToSection(identity('owner'), 'list', 'item', horror.id);
  assert.equal(moved.sectionId, horror.id);
  await service.deleteSection(identity('owner'), 'list', horror.id);
  assert.equal(items[0].sectionId, null, 'deleting a section must return its titles to Unsectioned');

  while (sections.length < 12) await service.createSection(identity('owner'), 'list', `Section ${sections.length}`);
  await assert.rejects(service.createSection(identity('owner'), 'list', 'Thirteenth'), BadRequestException);

  console.log('Watchlist section API QA passed: validation, ownership, duplicate names, moves, deletion fallback and section limit.');
}

void run();
