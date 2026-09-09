import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SaveViewingHistoryDto } from './viewing-history.dto';
import { historyMatches, resolveViewingHistory } from './viewing-history';
import { ViewingsService } from './viewings.service';

async function run() {
  const now = new Date('2026-09-08T16:00:00Z');
  const first = randomUUID();
  const input: SaveViewingHistoryDto = {
    contentType: 'movie', tmdbId: 51876, timeZone: 'Asia/Seoul',
    previous: [{ id: first, watchedAt: '2026-09-03T21:34:00.000Z' }],
    entries: [{ id: first, watchedDate: '2026-09-03' }, { id: randomUUID(), watchedDate: '2026-09-06' },
      ...Array.from({ length: 3 }, () => ({ id: randomUUID(), watchedDate: null }))],
  };
  const resolved = resolveViewingHistory(input, now);
  assert.equal(resolved.length, 5);
  assert.equal(resolved[0]!.watchedAt.toISOString(), input.previous[0]!.watchedAt);
  assert.equal(resolved.filter((item) => item.watchedAt.toISOString().startsWith('2026-09-09')).length, 3, 'today follows the user time zone');
  assert.equal(resolveViewingHistory({ ...input, timeZone: 'America/Los_Angeles' }, now)[4]!.watchedAt.toISOString().slice(0, 10), '2026-09-08');
  for (const date of ['2026-02-30', '2026-09-10', '2026-9-01', 'bad']) {
    assert.throws(() => resolveViewingHistory({ ...input, entries: [{ id: first, watchedDate: date }] }, now));
  }
  assert.throws(() => resolveViewingHistory({ ...input, timeZone: 'not-a-zone' }, now));
  assert.throws(() => resolveViewingHistory({ ...input, contentType: 'episode' }, now));
  assert.throws(() => resolveViewingHistory({ ...input, entries: [] }, now));
  assert.throws(() => resolveViewingHistory({ ...input, entries: [input.entries[0]!, input.entries[0]!] }, now));
  assert.equal((await validate(plainToInstance(SaveViewingHistoryDto, input))).length, 0);
  assert.ok((await validate(plainToInstance(SaveViewingHistoryDto, { ...input, entries: [{ id: 'bad', watchedDate: '2026-01-01' }] }))).length);
  assert.ok((await validate(plainToInstance(SaveViewingHistoryDto, { ...input, entries: Array(1001).fill(input.entries[0]) }))).length);
  assert.equal(historyMatches([{ id: first, watchedAt: new Date(input.previous[0]!.watchedAt!) }], input.previous), true);

  type Row = { id: string; userId: string; tmdbId: number; contentType: string; seasonNumber: number | null; episodeNumber: number | null; watchedAt: Date | null; createdAt?: Date };
  let rows: Row[] = [{ id: first, userId: 'owner', tmdbId: 51876, contentType: 'MOVIE', seasonNumber: null, episodeNumber: null, watchedAt: new Date(input.previous[0]!.watchedAt!), createdAt: new Date('2026-09-04') },
    { id: randomUUID(), userId: 'other-owner', tmdbId: 51876, contentType: 'MOVIE', seasonNumber: null, episodeNumber: null, watchedAt: null }];
  const originalCreatedAt = rows[0]!.createdAt;
  let movieStateWrites = 0, episodeWrites = 0;
  const matches = (row: Row, where: Record<string, unknown>) => Object.entries(where).every(([field, value]) => field === 'id' && typeof value === 'object'
    ? !(value as { notIn: string[] }).notIn.includes(row.id) : row[field as keyof Row] === value);
  const tx = {
    viewingEvent: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => rows.filter((row) => matches(row, where)),
      findFirst: async ({ where }: { where: Record<string, unknown> }) => rows.find((row) => matches(row, where)) ?? null,
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => { rows = rows.filter((row) => !matches(row, where)); },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: { watchedAt: Date } }) => { rows.forEach((row) => { if (matches(row, where)) row.watchedAt = data.watchedAt; }); },
      createMany: async ({ data }: { data: Row[] }) => {
        if (data.some((item) => rows.some((row) => row.id === item.id))) throw { code: 'P2002' };
        rows.push(...data);
      },
    },
    userContentState: { upsert: async () => { movieStateWrites += 1; } },
    userEpisodeProgress: { upsert: async () => { episodeWrites += 1; } },
  };
  const prisma = { ...tx, $transaction: async (fn: (value: typeof tx) => Promise<unknown>) => {
    const before = structuredClone(rows);
    try { return await fn(tx); } catch (error) { rows = before; throw error; }
  } };
  const service = new ViewingsService({ getOrCreateUser: async () => ({ id: 'owner' }) } as never, prisma as never,
    { getMovie: async () => ({ item: { title: 'Limitless', genres: [] } }), getSeries: async () => ({ item: { title: 'Series', genres: [] } }), getSeason: async () => ({ item: { episodes: [] } }) } as never);
  const saved = await service.saveHistory({} as never, input);
  assert.equal(saved.items.length, 5);
  assert.equal(rows.filter((row) => row.userId === 'other-owner').length, 1);
  assert.equal(rows.find((row) => row.id === first)?.createdAt, originalCreatedAt, 'editing dates must preserve event identity and creation time');
  assert.equal(movieStateWrites, 0, 'editing history does not change an existing tracking status');
  await service.saveHistory({} as never, input);
  assert.equal(rows.length, 6, 'retrying the same save must not duplicate viewings');
  await assert.rejects(service.saveHistory({} as never, { ...input, entries: input.entries.slice(0, 2) }), /history changed/);
  const reduced = { ...input, previous: saved.items, entries: input.entries.slice(0, 2) };
  assert.equal((await service.saveHistory({} as never, reduced)).items.length, 2);
  const foreignId = rows.find((row) => row.userId === 'other-owner')!.id;
  await assert.rejects(service.saveHistory({} as never, { ...reduced, previous: (await service.saveHistory({} as never, reduced)).items, entries: [{ id: foreignId, watchedDate: '2026-01-01' }] }), /history changed/);
  assert.equal(rows.filter((row) => row.userId === 'owner').length, 2, 'a failed transaction must preserve all prior rows');
  await service.saveHistory({} as never, { ...input, tmdbId: 99, previous: [], entries: [{ id: randomUUID(), watchedDate: '2026-01-01' }] });
  assert.equal(movieStateWrites, 1);
  await service.saveHistory({} as never, { ...input, contentType: 'episode', seasonNumber: 1, episodeNumber: 2, previous: [], entries: [{ id: randomUUID(), watchedDate: '2026-01-01' }] });
  assert.equal(episodeWrites, 1);
  console.log('Viewing history API QA passed.');
}

void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
