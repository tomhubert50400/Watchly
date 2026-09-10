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

export function getReleaseDaysRemaining(item: ReleaseCalendarItem, now = new Date()) {
  if (!item.releaseDate || item.precision !== 'date') return null;
  const releaseDay = Date.parse(`${item.releaseDate}T00:00:00.000Z`);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Number.isNaN(releaseDay) ? null : Math.round((releaseDay - today) / 86_400_000);
}

export function getUpcomingReleases(items: ReleaseCalendarItem[], now = new Date()) {
  const upcoming = items.filter((item) => {
    const days = getReleaseDaysRemaining(item, now);
    return days === null || days >= 0;
  });
  const seasonsWithEpisodes = new Set(upcoming.filter((item) => item.type === 'episode_release')
    .map((item) => `${item.tmdbId}:${item.seasonNumber}`));
  return upcoming.filter((item) => item.type !== 'season_release' || !seasonsWithEpisodes.has(`${item.tmdbId}:${item.seasonNumber}`))
    .sort((left, right) => {
    const leftDays = getReleaseDaysRemaining(left, now);
    const rightDays = getReleaseDaysRemaining(right, now);
    if (leftDays === null) return rightDays === null ? left.title.localeCompare(right.title) : 1;
    if (rightDays === null) return -1;
    return leftDays - rightDays || left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
    });
}

export function getReleaseDisplay(item: ReleaseCalendarItem) {
  const marker = item.type === 'episode_release'
    ? `: S${item.seasonNumber}E${item.episodeNumber} `
    : item.type === 'season_release' ? `: Season ${item.seasonNumber}` : null;
  const markerIndex = marker ? item.title.lastIndexOf(marker) : -1;
  return {
    title: markerIndex >= 0 ? item.title.slice(0, markerIndex) : item.title,
    episodeName: item.type === 'episode_release' && markerIndex >= 0
      ? item.title.slice(markerIndex + marker!.length) : null,
    detail: item.type === 'episode_release'
      ? `S${String(item.seasonNumber ?? '?').padStart(2, '0')} · E${String(item.episodeNumber ?? '?').padStart(2, '0')}`
      : item.type === 'season_release' ? `Season ${item.seasonNumber ?? '?'}` : 'Movie',
  };
}
