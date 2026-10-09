export type WatchlistMediaType = 'all' | 'movie' | 'series';
export type WatchlistSort = 'original' | 'newest' | 'oldest' | 'title';

export function searchAndSortWatchlistItems<T extends { title?: string | null; createdAt?: string }>(
  items: readonly T[], query: string, sort: WatchlistSort,
) {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
  const search = normalize(query.trim());
  const result = items.filter(item => !search || normalize(item.title ?? '').includes(search));
  if (sort === 'title') result.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '', undefined, { sensitivity: 'base', numeric: true }));
  if (sort === 'newest' || sort === 'oldest') {
    result.sort((a, b) => {
      const first = Date.parse(a.createdAt ?? '');
      const second = Date.parse(b.createdAt ?? '');
      if (!Number.isFinite(first)) return Number.isFinite(second) ? 1 : 0;
      if (!Number.isFinite(second)) return -1;
      return (first - second) * (sort === 'newest' ? -1 : 1);
    });
  }
  return result;
}

export function filterWatchlistItems<T extends { contentType: 'movie' | 'series'; tmdbId: number }>(
  items: readonly T[],
  mediaType: WatchlistMediaType,
  genre: string | null,
  genresByKey: Record<string, string[]>,
) {
  return items.filter((item) => (
    (mediaType === 'all' || item.contentType === mediaType)
    && (!genre || genresByKey[`${item.contentType}:${item.tmdbId}`]?.includes(genre))
  ));
}
