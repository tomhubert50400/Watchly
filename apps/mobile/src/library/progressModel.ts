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
  releasedEpisodeCount?: number;
  watchedReleasedEpisodeCount?: number;
  viewingCycle?: number;
  nextSeasonAirDate?: string | null;
  remainingEpisodes?: Array<{ seasonNumber: number; episodeNumber: number }>;
};

export function isProgressCandidate(item: LibraryMediaItem) {
  return item.contentType === 'series' && (item.status === 'watching' || item.status === 'watched' || item.watchedEpisodeCount > 0);
}

export function selectRecentProgress(items: ProgressItem[]) {
  return items.filter((item) => (item.next || (item.error && item.state === 'progress')) && item.media.watchedEpisodeCount > 0)
    .sort((a, b) => (b.media.lastWatchedAt ?? '').localeCompare(a.media.lastWatchedAt ?? ''))
    .slice(0, 6);
}

export function retainProgressOnError(previous: ProgressItem | undefined, incoming: ProgressItem): ProgressItem {
  return incoming.error && previous ? { ...previous, error: incoming.error } : incoming;
}

export function advanceProgressItem(item: ProgressItem, viewingId: string, now: string): ProgressItem | null {
  const episode = item.next;
  const first = item.remainingEpisodes?.[0];
  if (!episode || !first || first.seasonNumber !== episode.seasonNumber || first.episodeNumber !== episode.episodeNumber) return null;
  const matches = (entry: { seasonNumber: number; episodeNumber: number }) => entry.seasonNumber === episode.seasonNumber && entry.episodeNumber === episode.episodeNumber;
  const watched = [...item.watched.filter((entry) => !matches(entry)), { ...episode, id: viewingId, seriesTmdbId: item.media.tmdbId, updatedAt: now, watchedAt: now }];
  const viewCount = (item.viewings.find(matches)?.viewCount ?? 0) + 1;
  const viewings = [...item.viewings.filter((entry) => !matches(entry)), { ...episode, viewCount, latestLoggedAt: now }];
  const remainingEpisodes = item.remainingEpisodes!.slice(1);
  const next = remainingEpisodes[0] ?? null;
  const ended = item.series.status === 'Ended' || item.series.status === 'Canceled';
  return {
    ...item, watched, viewings, remainingEpisodes, next, error: null,
    media: { ...item.media, watchedEpisodeCount: watched.length, lastWatchedAt: now },
    watchedReleasedEpisodeCount: (item.watchedReleasedEpisodeCount ?? 0) + 1,
    state: next ? 'progress' : ended ? 'completed' : 'caughtUp',
  };
}

export async function resolveProgressItem(
  item: Omit<ProgressItem, 'next' | 'state' | 'error'>,
  loadSeason: (seasonNumber: number) => Promise<SeasonDetails>,
  today = new Date().toISOString().slice(0, 10),
): Promise<ProgressItem> {
  const seasons = new Map<number, Promise<SeasonDetails>>();
  const cachedSeason = (number: number) => {
    if (!seasons.has(number)) seasons.set(number, loadSeason(number));
    return seasons.get(number)!;
  };
  const anchor = getSeriesRewatchAnchor(item.viewings);
  const watched = anchor ? item.viewings.filter((episode) => episode.latestLoggedAt >= anchor.latestLoggedAt) : item.watched;
  const watchedKeys = new Set(watched.map((episode) => `${episode.seasonNumber}:${episode.episodeNumber}`));
  let releasedEpisodeCount = 0;
  let watchedReleasedEpisodeCount = 0;
  const remainingEpisodes: NonNullable<ProgressItem['remainingEpisodes']> = [];
  const regularSeasons = item.series.seasons.filter((season) => season.seasonNumber > 0);
  for (const season of regularSeasons) {
    if (season.airDate && season.airDate > today) continue;
    const details = await cachedSeason(season.seasonNumber);
    for (const episode of details.episodes) {
      if (!episode.airDate || episode.airDate > today) continue;
      releasedEpisodeCount++;
      // Match the position used by findNextSeriesEpisode for the current viewing cycle.
      const beforeAnchor = anchor && (season.seasonNumber < anchor.seasonNumber
        || season.seasonNumber === anchor.seasonNumber && episode.episodeNumber <= anchor.episodeNumber);
      if (beforeAnchor || watchedKeys.has(`${season.seasonNumber}:${episode.episodeNumber}`)) watchedReleasedEpisodeCount++;
      else if (season.airDate) remainingEpisodes.push({ seasonNumber: season.seasonNumber, episodeNumber: episode.episodeNumber });
    }
  }
  const upcomingSeason = regularSeasons.filter((season) => season.airDate && season.airDate > today)
    .sort((a, b) => a.seasonNumber - b.seasonNumber)[0];
  let nextSeasonAirDate: string | null = null;
  if (upcomingSeason) {
    // An unavailable future season must not hide already resolved viewing progress.
    const details = await cachedSeason(upcomingSeason.seasonNumber).catch(() => null);
    const premiere = details?.episodes.find((episode) => episode.episodeNumber === 1)?.airDate;
    if (premiere && premiere > today) nextSeasonAirDate = premiere;
  }
  const next = await findNextSeriesEpisode(item.series.seasons, watched, cachedSeason, today, anchor);
  const ended = item.series.status === 'Ended' || item.series.status === 'Canceled';
  remainingEpisodes.sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber);
  return { ...item, remainingEpisodes, releasedEpisodeCount, watchedReleasedEpisodeCount, viewingCycle: anchor?.viewCount ?? 1, nextSeasonAirDate, next, state: next ? 'progress' : ended ? 'completed' : 'caughtUp', error: null };
}
