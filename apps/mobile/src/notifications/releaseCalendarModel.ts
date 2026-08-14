export type ReleaseCalendarFilter = 'all' | 'movies' | 'series';

export type ReleaseCalendarItem = {
  contentType: 'movie' | 'series';
  episodeNumber: number | null;
  id: string;
  precision: 'date' | 'unknown';
  releaseDate: string | null;
  seasonNumber: number | null;
  title: string;
  tmdbId: number;
  type: 'movie_release' | 'season_release' | 'episode_release';
};

export function filterReleaseCalendarItems(
  items: ReleaseCalendarItem[],
  filter: ReleaseCalendarFilter,
) {
  if (filter === 'movies') return items.filter((item) => item.contentType === 'movie');
  if (filter === 'series') return items.filter((item) => item.contentType === 'series');
  return items;
}

export function filterReleaseCalendarItemsByDate(
  items: ReleaseCalendarItem[],
  dateKey: string,
) {
  return items.filter((item) => item.releaseDate === dateKey);
}

export function getReleaseMonthItems(items: ReleaseCalendarItem[], monthKey: string) {
  return items.filter((item) => item.releaseDate?.slice(0, 7) === monthKey);
}

export function getReleaseMonthKeys(items: ReleaseCalendarItem[]) {
  return [...new Set(items.flatMap((item) => {
    const monthKey = item.releaseDate?.match(/^\d{4}-\d{2}/)?.[0];
    return monthKey ? [monthKey] : [];
  }))].sort();
}

export function getInitialReleaseMonthKey(items: ReleaseCalendarItem[]) {
  return getReleaseMonthKeys(items)[0] ?? null;
}
