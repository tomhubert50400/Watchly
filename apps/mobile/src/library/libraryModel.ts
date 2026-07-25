import type { ReleaseAlertSummary } from '../api/notifications';
import type { SeriesProgressSummary } from '../api/progress';
import type { MovieRating } from '../api/ratings';
import type { TrackingState } from '../api/tracking';

export type LibraryItemBase = {
  contentType: TrackingState['contentType'];
  favorite: boolean;
  hasReleaseAlert: boolean;
  inferredWatchingFromProgress: boolean;
  key: string;
  lastWatchedAt: string | null;
  ratingScore: number | null;
  resumeEpisodeNumber: number | null;
  resumeSeasonNumber: number | null;
  status: TrackingState['status'];
  tmdbId: number;
  updatedAt: string;
  watchedEpisodeCount: number;
};

export type LibrarySummary = {
  averageRating: number | null;
  listCount: number;
  ratedTitleCount: number;
  trackedTitleCount: number;
  watchedEpisodeCount: number;
};

export function mergeLibraryItems(
  states: TrackingState[],
  ratings: MovieRating[],
  progress: SeriesProgressSummary[],
  releaseAlerts: ReleaseAlertSummary[],
): LibraryItemBase[] {
  const byContent = new Map<string, LibraryItemBase>();
  const ensure = (contentType: TrackingState['contentType'], tmdbId: number, updatedAt: string) => {
    const key = `${contentType}:${tmdbId}`;
    const existing = byContent.get(key);
    if (existing) return existing;
    const item: LibraryItemBase = {
      contentType, favorite: false, hasReleaseAlert: false, inferredWatchingFromProgress: false,
      key, lastWatchedAt: null, ratingScore: null, resumeEpisodeNumber: null, resumeSeasonNumber: null,
      status: null, tmdbId, updatedAt, watchedEpisodeCount: 0,
    };
    byContent.set(key, item);
    return item;
  };

  states.forEach((state) => {
    const item = ensure(state.contentType, state.tmdbId, state.updatedAt);
    Object.assign(item, {
      favorite: state.favorite,
      lastWatchedAt: state.status === 'watched'
        ? maxOptionalDate(item.lastWatchedAt, state.updatedAt)
        : item.lastWatchedAt,
      status: state.status,
      updatedAt: maxDate(item.updatedAt, state.updatedAt),
    });
  });
  ratings.forEach((rating) => {
    const item = ensure('movie', rating.tmdbId, rating.updatedAt);
    Object.assign(item, { ratingScore: rating.score, updatedAt: maxDate(item.updatedAt, rating.updatedAt) });
  });
  progress.forEach((summary) => {
    const item = ensure('series', summary.seriesTmdbId, summary.updatedAt);
    const hadExplicitState = byContent.has(item.key) && states.some((state) => `${state.contentType}:${state.tmdbId}` === item.key);
    Object.assign(item, {
      inferredWatchingFromProgress: !hadExplicitState,
      lastWatchedAt: summary.watchedEpisodeCount > 0
        ? maxOptionalDate(item.lastWatchedAt, summary.updatedAt)
        : item.lastWatchedAt,
      resumeEpisodeNumber: summary.latestEpisodeNumber,
      resumeSeasonNumber: summary.latestSeasonNumber,
      status: item.status ?? 'watching',
      updatedAt: maxDate(item.updatedAt, summary.updatedAt),
      watchedEpisodeCount: summary.watchedEpisodeCount,
    });
  });
  releaseAlerts.forEach((alert) => {
    const item = ensure(alert.contentType, alert.tmdbId, alert.updatedAt);
    Object.assign(item, { hasReleaseAlert: true, updatedAt: maxDate(item.updatedAt, alert.updatedAt) });
  });
  return [...byContent.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getLastWatchedLibraryItem<T extends Pick<LibraryItemBase, 'lastWatchedAt'>>(
  items: readonly T[],
): T | null {
  let latest: T | null = null;

  for (const item of items) {
    if (
      item.lastWatchedAt
      && (!latest?.lastWatchedAt || item.lastWatchedAt > latest.lastWatchedAt)
    ) {
      latest = item;
    }
  }

  return latest;
}

export function calculateResumeEpisode(
  seasons: Array<{ episodeCount: number | null; seasonNumber: number }>,
  latestSeasonNumber: number | null,
  latestEpisodeNumber: number | null,
) {
  if (!latestSeasonNumber || !latestEpisodeNumber) return null;
  const ordered = seasons.filter((season) => season.seasonNumber > 0 && (season.episodeCount ?? 0) > 0)
    .sort((a, b) => a.seasonNumber - b.seasonNumber);
  const current = ordered.find((season) => season.seasonNumber === latestSeasonNumber);
  if (current && latestEpisodeNumber < (current.episodeCount ?? 0)) {
    return { episodeNumber: latestEpisodeNumber + 1, seasonNumber: latestSeasonNumber };
  }
  const next = ordered.find((season) => season.seasonNumber > latestSeasonNumber);
  return next ? { episodeNumber: 1, seasonNumber: next.seasonNumber } : null;
}

export function shouldShowTrackedTitle(item: Pick<LibraryItemBase, 'hasReleaseAlert' | 'inferredWatchingFromProgress' | 'resumeEpisodeNumber' | 'resumeSeasonNumber' | 'status'>) {
  if (item.hasReleaseAlert) return true;
  if (item.status !== 'watching' && item.status !== 'watchlisted' && item.status !== 'watched') return false;
  if (!item.inferredWatchingFromProgress) return true;
  return item.resumeSeasonNumber !== null && item.resumeEpisodeNumber !== null;
}

export function buildLibrarySummary(
  items: Array<Pick<LibraryItemBase, 'ratingScore' | 'watchedEpisodeCount'>>,
  listCount: number,
): LibrarySummary {
  const ratings = items.flatMap((item) => item.ratingScore === null ? [] : [item.ratingScore]);
  return {
    averageRating: ratings.length ? ratings.reduce((sum, score) => sum + score, 0) / ratings.length : null,
    listCount,
    ratedTitleCount: ratings.length,
    trackedTitleCount: items.length,
    watchedEpisodeCount: items.reduce((sum, item) => sum + item.watchedEpisodeCount, 0),
  };
}

export function mapLibrarySourceErrors(errors: Record<string, unknown | null | undefined>) {
  const failures = Object.entries(errors).flatMap(([name, error]) => error ? [`${name} (${error instanceof Error ? error.message : 'unknown error'})`] : []);
  return failures.length ? `Some library data could not update: ${failures.join(', ')}.` : null;
}

function maxDate(left: string, right: string) {
  return left.localeCompare(right) >= 0 ? left : right;
}

function maxOptionalDate(left: string | null, right: string) {
  return left ? maxDate(left, right) : right;
}
