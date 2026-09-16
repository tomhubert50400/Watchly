import { createHash } from 'node:crypto';
import { Prisma } from '../generated/prisma/client';
import { TrackedContentType } from '../generated/prisma/enums';
import { ImportSourceValue, ParsedImportWatchlist } from './import-file.parser';
import type { PreparedImportItem } from './imports.service';

export type ImportedWatchlistIds = Record<string, string | null>;

export async function commitImportWatchlists(
  transaction: Prisma.TransactionClient,
  userId: string,
  source: ImportSourceValue,
  watchlists: ParsedImportWatchlist[],
  items: PreparedImportItem[],
  previous?: ImportedWatchlistIds,
) {
  const ids: ImportedWatchlistIds = { ...previous };
  if (watchlists.length === 0) return { ids, items };

  // Share the creation lock with manual watchlist creation, including concurrent imports.
  await transaction.$queryRaw`SELECT id FROM "users" WHERE id = ${userId}::uuid FOR UPDATE`;
  const existing = await transaction.personalWatchlist.findMany({ where: { userId }, select: { id: true } });
  const existingIds = new Set(existing.map((list) => list.id));
  let count = existing.length;
  for (const list of watchlists) {
    if (Object.hasOwn(ids, list.key)) continue;
    const id = importedWatchlistId(userId, source, list.key);
    if (existingIds.has(id)) {
      ids[list.key] = id;
    } else if (count < 5) {
      await transaction.personalWatchlist.create({ data: { id, userId, name: list.name } });
      ids[list.key] = id;
      existingIds.add(id);
      count += 1;
    } else {
      ids[list.key] = null;
    }
  }

  const rows: Prisma.PersonalWatchlistItemCreateManyInput[] = [];
  const includedItems = items.map((item) => {
    const listIds = (item.watchlistKeys ?? []).flatMap((key) => ids[key] && existingIds.has(ids[key]) ? [ids[key]] : []);
    if (item.status === 'ready' && item.match) {
      for (const watchlistId of listIds) {
        rows.push({ watchlistId, tmdbId: item.match.tmdbId,
          contentType: item.match.contentType === 'movie' ? TrackedContentType.MOVIE : TrackedContentType.SERIES });
      }
    }
    return item.watchlistKeys?.length && listIds.length === 0 ? { ...item, watchlisted: false } : item;
  }).filter((item) => !item.watchlistKeys?.length || item.watched || item.watching || item.watchlisted
    || item.favorite || item.rating !== null || item.review !== null);
  if (rows.length > 0) {
    await transaction.personalWatchlistItem.createMany({ data: rows, skipDuplicates: true });
    await transaction.personalWatchlist.updateMany({
      where: { userId, id: { in: [...new Set(rows.map((row) => row.watchlistId))] } },
      data: { updatedAt: new Date() },
    });
  }
  return { ids, items: includedItems };
}

function importedWatchlistId(userId: string, source: ImportSourceValue, key: string) {
  // Stable per owner and source list so retries and reimports reuse the same private list.
  const bytes = createHash('sha1').update(JSON.stringify(['watchly-import-watchlist', userId, source, key])).digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
