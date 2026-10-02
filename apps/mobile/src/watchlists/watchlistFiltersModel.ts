export type WatchlistMediaType = 'all' | 'movie' | 'series';

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
