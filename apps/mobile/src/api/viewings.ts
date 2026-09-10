import { apiGet, apiPost, apiPut } from './client';

export type ViewingHistoryItem = { id: string; watchedAt: string | null };
export type ViewingHistoryDate = { id: string; watchedDate: string | null };
export type ViewingTarget = { contentType: 'movie'; tmdbId: number } | {
  contentType: 'episode'; tmdbId: number; seasonNumber: number; episodeNumber: number;
};

export function saveViewingHistory(token: string, target: ViewingTarget, previous: ViewingHistoryItem[], entries: ViewingHistoryDate[]) {
  return apiPut<{ items: ViewingHistoryItem[] }>('/viewings/history', {
    ...target, previous, entries, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }, { token });
}

export type ViewingStats = {
  highlights: Array<{
    artworkUrl: string | null;
    contentType: 'movie' | 'series';
    minutes: number;
    title: string;
    tmdbId: number;
    views: number;
  }>;
  more: {
    averageRating: number | null;
    favoriteWatchDay: string | null;
    mostUsedRating: number | null;
    ratingCount: number;
    rewatchCount: number;
  };
  summary: {
    episodeCount: number;
    movieCount: number;
    seriesCount: number;
    totalViewCount: number;
    watchMinutes: number;
    watchTimeIsEstimated: boolean;
  };
  taste: Array<{
    count: number;
    genre: string;
  }>;
};

export type MovieViewingSummary = {
  latestLoggedAt?: string | null;
  history?: ViewingHistoryItem[];
  tmdbId: number;
  viewCount: number;
};

export type EpisodeViewingSummary = {
  history?: ViewingHistoryItem[];
  episodeNumber: number;
  seasonNumber: number;
  seriesTmdbId: number;
  viewCount: number;
};

export type SeriesViewingSummary = {
  episodes?: Array<{ seasonNumber: number; episodeNumber: number; viewCount: number; latestLoggedAt: string }>;
  rewatchCount: number;
  seriesTmdbId: number;
  totalViewCount: number;
  watchedEpisodeCount: number;
};

export type JournalViewing = {
  contentType: 'episode' | 'movie';
  episodeNumber: number | null;
  id: string;
  seasonNumber: number | null;
  tmdbId: number;
  watchedAt: string;
};

export function listJournalViewings(token: string) {
  return apiGet<{ items: JournalViewing[] }>('/viewings/journal', { token });
}

export function getViewingStats(token: string) {
  return apiGet<ViewingStats>('/viewings/stats', { token, timeoutMs: 30_000 });
}

export function getMovieViewingSummary(token: string, tmdbId: number) {
  return apiGet<MovieViewingSummary>(`/viewings/movies/${tmdbId}`, { token });
}

export function logMovieViewing(token: string, tmdbId: number) {
  return apiPost<MovieViewingSummary>(`/viewings/movies/${tmdbId}`, {}, { token });
}

export function getSeriesViewingSummary(token: string, seriesTmdbId: number) {
  return apiGet<SeriesViewingSummary>(`/viewings/series/${seriesTmdbId}`, { token });
}

export function getEpisodeViewingSummary(
  token: string,
  seriesTmdbId: number,
  seasonNumber: number,
  episodeNumber: number,
) {
  return apiGet<EpisodeViewingSummary>(
    `/viewings/episodes/${seriesTmdbId}/seasons/${seasonNumber}/episodes/${episodeNumber}`,
    { token },
  );
}

export function logEpisodeViewing(
  token: string,
  seriesTmdbId: number,
  seasonNumber: number,
  episodeNumber: number,
) {
  return apiPost<EpisodeViewingSummary>(
    `/viewings/episodes/${seriesTmdbId}/seasons/${seasonNumber}/episodes/${episodeNumber}`,
    {},
    { token },
  );
}
