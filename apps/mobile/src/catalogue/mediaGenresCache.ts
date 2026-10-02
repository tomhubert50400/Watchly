import {
  createMemoryResourceCache,
  getOrCreateResourceRequest,
  isMemoryResourceFresh,
} from '../cache/memoryResourceCache';

export type MediaGenresItem = { contentType: 'movie' | 'series'; tmdbId: number };

const GENRES_STALE_TIME_MS = 24 * 60 * 60 * 1000;
const cache = createMemoryResourceCache(2000);

export function getMediaGenresKey(item: MediaGenresItem) {
  return `${item.contentType}:${item.tmdbId}`;
}

export function getCachedMediaGenres(item: MediaGenresItem) {
  const cached = cache.get<string[]>(getMediaGenresKey(item));
  return cached && isMemoryResourceFresh(cached.savedAt, GENRES_STALE_TIME_MS)
    ? cached.data
    : null;
}

export function seedMediaGenres(item: MediaGenresItem, genres: string[]) {
  const key = getMediaGenresKey(item);
  // Existing expired entries must refresh instead of being reseeded from old details.
  if (!cache.get(key)) cache.set(key, genres, new Date(Date.now()).toISOString());
}

export async function loadCachedMediaGenres(
  item: MediaGenresItem,
  load: () => Promise<string[]>,
): Promise<string[]> {
  const cached = getCachedMediaGenres(item);
  if (cached !== null) return cached;

  return getOrCreateResourceRequest(`watchly:public:genres:${getMediaGenresKey(item)}`, async () => {
    const genres = await load();
    cache.set(getMediaGenresKey(item), genres, new Date(Date.now()).toISOString());
    return genres;
  });
}
