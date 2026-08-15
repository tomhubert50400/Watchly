import type { LibraryMediaItem } from '../library/useLibraryData';

export type ProfileMediaFilter = 'favorites' | 'movies' | 'series';
export type ProfileMediaStatus = 'completed' | 'inProgress' | 'planned';

export const PROFILE_MEDIA_PREVIEW_LIMIT = 10;

export function getProfileMediaStatus(
  item: Pick<
    LibraryMediaItem,
    | 'contentType'
    | 'favorite'
    | 'hasReleaseAlert'
    | 'numberOfEpisodes'
    | 'status'
    | 'watchedEpisodeCount'
  >,
): ProfileMediaStatus | null {
  const completedSeries = item.contentType === 'series'
    && item.numberOfEpisodes !== null
    && item.numberOfEpisodes > 0
    && item.watchedEpisodeCount >= item.numberOfEpisodes;

  if (item.status === 'watched' || completedSeries) return 'completed';
  if (
    item.contentType === 'series'
    && (
      item.status === 'watching'
      || (item.status !== 'dropped' && item.watchedEpisodeCount > 0)
    )
  ) {
    return 'inProgress';
  }
  if (item.status === 'watchlisted' || item.favorite || item.hasReleaseAlert) return 'planned';

  return null;
}

export function isProfileBackdropCandidate(item: LibraryMediaItem) {
  if (item.favorite || item.hasReleaseAlert || item.status === 'watched') return true;
  if (item.contentType === 'movie') return false;

  return item.status === 'watching' || item.watchedEpisodeCount > 0;
}

export function getProfileMediaItems(
  items: readonly LibraryMediaItem[],
  filter: ProfileMediaFilter,
) {
  return [...items]
    .filter((item) => {
      if (getProfileMediaStatus(item) === null) return false;
      if (filter === 'favorites') return item.favorite;
      return item.contentType === (filter === 'movies' ? 'movie' : 'series');
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function getProfileMediaPreviews(items: readonly LibraryMediaItem[]) {
  return {
    favorites: getProfileMediaItems(items, 'favorites').slice(0, PROFILE_MEDIA_PREVIEW_LIMIT),
    movies: getProfileMediaItems(items, 'movies').slice(0, PROFILE_MEDIA_PREVIEW_LIMIT),
    series: getProfileMediaItems(items, 'series').slice(0, PROFILE_MEDIA_PREVIEW_LIMIT),
  };
}

export function groupProfileMediaByStatus(items: readonly LibraryMediaItem[]) {
  const groups: Record<ProfileMediaStatus, LibraryMediaItem[]> = {
    completed: [],
    inProgress: [],
    planned: [],
  };

  items.forEach((item) => {
    const status = getProfileMediaStatus(item);
    if (status) groups[status].push(item);
  });

  return groups;
}

export function dedupeProfileMediaItems(items: readonly LibraryMediaItem[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}
