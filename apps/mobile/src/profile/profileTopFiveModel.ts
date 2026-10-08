import type { ProfileBackdropSelection } from '../api/profile';
import type { LibraryMediaItem } from '../library/useLibraryData';

export function buildTopFiveItems(selections: readonly ProfileBackdropSelection[]): LibraryMediaItem[] {
  return selections.map((item) => ({
    ...item, key: `${item.contentType}:${item.tmdbId}`, title: `TMDB ${item.tmdbId}`,
    posterUrl: null, backdropUrl: null, numberOfEpisodes: null,
    favorite: false, hasReleaseAlert: false, inferredWatchingFromProgress: false,
    lastWatchedAt: null, ratingScore: null, resumeEpisodeNumber: null,
    resumeSeasonNumber: null, status: null, updatedAt: '', watchedEpisodeCount: 0,
  }));
}
