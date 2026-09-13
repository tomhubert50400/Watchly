import type { SeasonDetails, SeriesDetails } from '../api/catalogue';
import type { SeriesProgress } from '../api/progress';
import type { SeriesViewingSummary } from '../api/viewings';
import { findNextSeriesEpisode, getSeriesRewatchAnchor } from '../catalogue/whatsNextModel';
import type { LibraryMediaItem } from './useLibraryData';

export type ProgressFilter = 'progress' | 'caughtUp' | 'completed';
export const progressFilters = [
  { label: 'In progress', value: 'progress' },
  { label: 'Up to date', value: 'caughtUp' },
  { label: 'Completed', value: 'completed' },
] as const;
export type ProgressItem = {
  media: LibraryMediaItem;
  series: Pick<SeriesDetails, 'seasons' | 'status' | 'numberOfEpisodes'>;
  watched: SeriesProgress['episodes'];
  viewings: NonNullable<SeriesViewingSummary['episodes']>;
  next: { seasonNumber: number; episodeNumber: number } | null;
  state: ProgressFilter;
  error: string | null;
};

export function isProgressCandidate(item: LibraryMediaItem) {
  return item.contentType === 'series' && (item.status === 'watching' || item.status === 'watched' || item.watchedEpisodeCount > 0);
}

export function selectRecentProgress(items: ProgressItem[]) {
  return items.filter((item) => item.next && !item.error && item.media.watchedEpisodeCount > 0)
    .sort((a, b) => (b.media.lastWatchedAt ?? '').localeCompare(a.media.lastWatchedAt ?? ''))
    .slice(0, 6);
}

export async function resolveProgressItem(
  item: Omit<ProgressItem, 'next' | 'state' | 'error'>,
  loadSeason: (seasonNumber: number) => Promise<SeasonDetails>,
  today?: string,
): Promise<ProgressItem> {
  const anchor = getSeriesRewatchAnchor(item.viewings);
  const watched = anchor ? item.viewings.filter((episode) => episode.latestLoggedAt >= anchor.latestLoggedAt) : item.watched;
  const next = await findNextSeriesEpisode(item.series.seasons, watched, loadSeason, today, anchor);
  const ended = item.series.status === 'Ended' || item.series.status === 'Canceled';
  return { ...item, next, state: next ? 'progress' : ended ? 'completed' : 'caughtUp', error: null };
}
